# Quantization Tradeoff Study — Phi-4-mini-instruct

## Problem

Everyone quantizes their local/small LLMs to fit them on limited GPU memory, but how much
accuracy that actually costs you, and whether it costs the same across different kinds of
tasks, isn't something I'd seen measured directly for a current model. So I picked one small
instruct model, ran it at three precisions, and tested it on two very different benchmark
types to see what happens.

## Setup

- Model: microsoft/Phi-4-mini-instruct, 3.8B params, via HF Transformers
- GPU: single free-tier Colab T4 (16GB)
- Benchmarks: GSM8K (200 random questions, math word problems, scored by exact match on final
  number) and MMLU (200 random questions, multiple choice across a bunch of academic subjects,
  scored by exact match on the letter)
- Variants: fp16 (baseline), bitsandbytes 8-bit, bitsandbytes 4-bit NF4 with double quant
- Same prompts, same scoring code, same 200 questions across all three variants — only the
  quantization config changes between runs

Prompts go through `apply_chat_template()` since this is an instruct model and needs that
formatting to actually respond properly (see debugging notes below, this bit me early on).

## Results

| Task | fp16 | 8-bit | 4-bit NF4 |
|---|---|---|---|
| GSM8K acc | 86.5% | 90.0% | 85.0% |
| MMLU acc | 65.5% | 65.0% | 58.0% |
| Peak mem | 7.28-7.34GB | 4.28-4.36GB | 5.48GB |
| tok/s | 18.2-19.9 | 8.8-8.9 | 13.6-15.2 |

### Accuracy

4-bit drop vs fp16: GSM8K only -1.5pp, MMLU -7.5pp. That's about a 5x bigger hit on MMLU than
GSM8K.

I actually expected this backwards before running it — my assumption was that GSM8K, with its
multi-step reasoning, would be more fragile under quantization since a small rounding error
early in a chain of steps could throw off everything after it. Instead the opposite happened.
Best guess at why: GSM8K-style arithmetic might rely on more general, reused patterns in the
weights (basic math "know-how" gets applied over and over across different problems), so it's
somewhat robust to coarse rounding. MMLU questions often need one specific fact, and that fact
might live in a narrow, specific set of weights that gets wrecked more easily when you only
have 16 representable values per weight instead of 65k. This is a guess based on the pattern in
the data, I didn't verify it with anything like activation analysis or ablations, so take it as
a hypothesis not a proven explanation.

8-bit barely moved accuracy at all on either task (even slightly beat fp16 on GSM8K, which is
probably just noise from only testing 200 questions, not a real improvement from quantizing).

### Memory

fp16 -> 8bit dropped about in half like you'd expect. NF4 was actually a bit *higher* than
8bit even though it's fewer bits per weight, which surprised me. My guess is that at this small
a model size (3.8B), stuff like the KV cache and activation buffers that don't shrink with
weight quantization make up a big enough chunk of total memory that the weight savings don't
translate directly. Worth noting since "4-bit = way less memory" isn't universally true, at
least not at this scale on this hardware.

### Speed

This was the most surprising part honestly. 8-bit was the *slowest* of the three, not the
fastest — about half the tok/s of fp16. NF4 was in between. Turns out this is a known thing
with bitsandbytes 8-bit: it does mixed-precision decomposition (handling "outlier" weights
separately in higher precision) on every matmul, and that extra work costs more on an older
GPU like the T4 than it saves in memory bandwidth. I confirmed this wasn't a bug on my end —
initially I thought something was broken because a 10-question test took 30+ minutes, but it
turned out to be a dtype mismatch causing bitsandbytes to spam warnings on every single matmul
call (thousands of print statements), which was itself slowing things down on top of the real
underlying slowness. Fixed by forcing dtype=torch.float16 explicitly on load and suppressing
the bitsandbytes logger. After that fix, 8-bit was still slower than fp16, just not absurdly
so — confirming the slowdown was real, just exaggerated by the warning spam bug.

## What I couldn't get working

### AWQ

autoawq needs an older transformers version to import correctly (something about a missing
`LossKwargs` import). But Phi-4-mini's config needs a newer transformers to load without
throwing a rope_scaling validation error. I tried pinning transformers back to satisfy AWQ,
and that broke loading the model. There isn't a transformers version that works for both, at
least not one I found in the time I had. Ended up skipping AWQ entirely.

### KV cache quantization

Tried this twice.

First attempt used transformers' QuantizedCache with the quanto backend, wired into
`.generate()` fresh on each question. Ran a 10-question test and it crashed the whole Colab
runtime — ran out of RAM. Not sure exactly why, my guess is the cache objects weren't getting
released between generate calls and built up over the 10 questions.

Second attempt, I was more careful — explicitly deleting the cache object, running
gc.collect() and torch.cuda.empty_cache() after every single generation call. Got further this
time but then hit a different, harder wall:

```
QuantizedCache is only supported for models with only full attention layers.
We found the following invalid layer types: {'sliding_attention'}
```

Phi-4-mini uses sliding window attention in some of its layers, and this feature just flatly
doesn't support that architecture. This isn't something you can configure around, it's a hard
check in the transformers code. So KV-cache quantization for this specific model, with this
specific feature, isn't currently possible. Would need either a different model without
sliding window attention, or a different KV-cache quantization approach than transformers'
built-in one.

### GGUF (llama.cpp) and NVFP4/MXFP4

Didn't get to these. Between the AWQ dependency conflict and two rounds of KV-cache debugging
(plus hitting Colab's free GPU quota limit at one point and having to switch accounts), I ran
out of time in the session. NVFP4/MXFP4 specifically also need Blackwell-class GPU hardware
that a free T4 doesn't have, so those would've been a guaranteed skip anyway on this hardware,
regardless of time.

## Takeaways

- 4-bit NF4 seems like a fine choice if your workload looks like GSM8K (reasoning-heavy,
  smaller accuracy hit). Riskier if your workload looks like MMLU (knowledge-heavy, bigger hit).
- Don't assume more aggressive quantization = faster. On this GPU, 8-bit was clearly slower
  than fp16. You have to actually measure it on your specific hardware, you can't just assume
  the direction.
- AWQ and the newer KV-cache quantization tooling both have real compatibility gaps with
  current model architectures right now (at least in this specific tooling/version
  combination) — that's arguably as useful a finding as the accuracy numbers themselves.

## Limitations

- Only 200 questions per benchmark, not the full test sets, so there's real sampling noise,
  especially on the 8-bit GSM8K number which is probably not a genuine improvement.
- Only tested one model size and one GPU. No idea if these findings (especially the throughput
  direction) hold on bigger models or newer GPUs.
- Only 3 of the originally planned 7 variants actually got full results (fp16, 8bit, NF4).
  AWQ, GGUF, NVFP4/MXFP4, and KV-cache quantization are documented as attempted/not attempted
  above but have no numbers.
