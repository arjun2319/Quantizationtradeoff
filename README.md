# Quantization Accuracy/Speed/Memory Study — Phi-4-mini-instruct on a free Colab T4

M.Tech (WILP) dissertation, BITS Pilani — Arjun Puppala (2023tm93547).

microsoft/Phi-4-mini-instruct (3.8B) quantized 14 ways across two runtimes and evaluated on the same
200 GSM8K (math reasoning) and 200 MMLU (general knowledge) questions, with identical prompts, greedy
decoding and identical scoring, on a single free-tier Google Colab T4. Full write-up:
`report/Final_Report_WILP.pdf` (BITS WILP report format).

## Main results

| Variant | GSM8K | MMLU | Peak memory | Tokens/s (GSM8K) |
|---|---|---|---|---|
| Transformers FP16 | 86.5% | 65.5% | 7.28–7.34 GB | 19.9 |
| bitsandbytes INT8 | 90.0% | 65.0% | 4.28–4.36 GB | 8.9 |
| bitsandbytes NF4 | 85.0% | 58.0% | 5.48 GB* | 15.2 |
| llama.cpp FP16 | 89.0% | 65.5% | 7.87 GB | 28.9 |
| llama.cpp Q8_0 | 90.0% | 64.5% | 4.50 GB | 46.9 |
| **llama.cpp Q4_K_M** | **90.5%** | **63.0%** | **3.02 GB** | **59.5** |
| llama.cpp NVFP4 | 86.5% | 58.5% | 3.00 GB | 66.0 |
| llama.cpp MXFP4 | 83.5% | 58.0% | 2.90 GB | 50.5 |
| llama.cpp FP16 + KV q8_0 | 88.0% | 65.0% | 7.64 GB | 28.5 |
| llama.cpp FP16 + KV q4_0 | 87.5% | 61.0% | 7.51 GB | 28.6 |
| **llama.cpp Q4_K_M + KV q4_0** | **90.0%** | **65.0%** | **2.66 GB** | 55.2† |
| NF4 attention-only (ablation) | 85.0% | 64.5% | — | 17.6 |
| NF4 MLP-only (ablation) | 86.5% | 55.0% | — | 17.7 |

†Run in a separate Colab session.
\*Inflated by memory retained from a previously loaded model; a fresh NF4 load needs 2.69 GB.
llama.cpp memory is measured at driver level (incl. CUDA context), Transformers memory with the PyTorch allocator.

- **Q4_K_M is the best 4-bit option here**: 62% less memory and 2× the speed of FP16, with no significant accuracy loss.
- **4-bit hurts knowledge (MMLU) more than reasoning (GSM8K)** in every 4-bit format; the ablation traces this
  to the feed-forward (MLP) layers (MLP-only vs attention-only: −9.5 pp MMLU, McNemar p<0.0001).
- **NVFP4/MXFP4** (software-decoded on the T4) are as small and fast as Q4_K_M but lose ~7 MMLU points (p<0.01).
- **Weights + KV cache**: no combination in the 3×3 grid loses accuracy significantly; Q4_K_M weights with a 4-bit KV
  cache match FP16 in 2.66 GB (−66%). The 4-bit-KV MMLU loss seen with FP16 weights (p=0.02) did not recur with quantized weights.
- **AWQ**: AutoAWQ's Phi-3 recipe silently corrupts grouped-query-attention models like Phi-4-mini; a fix is in
  `notebooks/phase2_step2_awq.ipynb` (verified on a 10-question check).

## Repository layout

```
notebooks/
  quant_study_main.ipynb               Phase 1: FP16 / bnb INT8 / bnb NF4 (mid-semester)
  kv_cache_and_awq_attempts.ipynb      Mid-semester AWQ and KV-cache attempts (documented blockers)
  phase2_step1_gguf_and_kvcache.ipynb  llama.cpp: FP16, Q8_0, Q4_K_M, MXFP4, NVFP4, KV q8_0 / q4_0
  phase2_step2_awq.ipynb               AWQ with Transformers 4.51.3 + AutoAWQ 0.2.9, incl. GQA fix
  phase2_step3_ablation.ipynb          NF4 attention-only / MLP-only / full + NF4 memory audit
  phase2_tables_and_figures.ipynb      Builds tables/figures from the run logs inside Colab
  phase2_step4_ttft_transformers.ipynb Time to first token for FP16 / INT8 / NF4 / ablation variants
analysis/
  analyze_results.py                   Reproduces all Phase-2 numbers, McNemar tests and figures locally
  category_and_ttft.py                 Per-category error analysis (MMLU subject areas, GSM8K problem length,
                                       error types) and time-to-first-token estimates
results/
  phase1/                              results.csv + Figure 1 (mid-semester)
  phase2/runs/                         One JSON line per question per variant (+ __meta.json with memory)
  phase2/awq/                          AWQ 10-question checks: attempt 1 (broken) and attempt 2 (fixed)
  phase2/summary.csv, mcnemar_tests.csv  Written by analysis/analyze_results.py
figures/                               All figures used in the final report
report/                                Final report in WILP format (Final_Report_WILP.docx/pdf, built by
                                       make_wilp.py + wilp_pages.py), earlier-format final report, mid-semester report, proposal,
                                       build_final_report.js (docx generator, needs `npm install docx`)
report.md, plot_results.py             Original mid-semester write-up and plotting script
```

## Reproducing

1. **GPU runs (Google Colab, T4 runtime):** open each `phase2_*` notebook and choose *Runtime → Run all*.
   Every answer is appended to `quant_study_phase2/runs/` on Google Drive, so interrupted sessions resume
   where they stopped. The AWQ notebook needs one manual *Restart session* after its first cell (it says so).
2. **Analysis (any machine, no GPU):** `pip install pandas matplotlib numpy` then
   `python analysis/analyze_results.py`.

Pinned versions: llama.cpp commit `d327bf1f0780f87b8c01b367b61853b0c291d7c4` (built for CUDA sm_75);
Transformers 5.20.2 + bitsandbytes 0.50.2 for the ablation; Transformers 4.51.3 + AutoAWQ 0.2.9 for AWQ.

## Per-question log format (`results/phase2/runs/*.jsonl`)

`idx` (question index in the seed-42 subset), `gold`, `pred`, `correct`, `n_tokens` (generated), `wall_s`,
`decode_tok_s` (llama.cpp only), `subject` (MMLU), `output` (full model answer).
