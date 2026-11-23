const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  LevelFormat, TabStopType, TabStopPosition, VerticalAlign,
} = require("docx");

const PAGES = JSON.parse(fs.existsSync("pages.json") ? fs.readFileSync("pages.json", "utf8") : "{}");
const FONT = "Times New Roman", HFONT = "Calibri Light", HCOLOR = "2E74B5", NAVY = "1F3864";

// ---------- inline markup: **bold**, *italic*, [[pending text]] (yellow highlight) ----------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (t.startsWith("[[")) out.push(new TextRun({ text: t.slice(2, -2), highlight: "yellow", bold: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONT, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, { size: 24 }), alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 120, line: 276 }, ...o });
const C = (t, o = {}) => new Paragraph({ children: runs(t, { size: 24, ...(o.run || {}) }), alignment: AlignmentType.CENTER,
  spacing: { after: o.after ?? 120 } });
const B = (t, left) => new Paragraph({ children: runs(t, { size: 24 }), numbering: { reference: "bul", level: 0 },
  alignment: left ? AlignmentType.LEFT : AlignmentType.JUSTIFIED, spacing: { after: 80, line: 276 } });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true,
  children: [new TextRun({ text: t.toUpperCase(), font: HFONT, size: 32, color: HCOLOR })], spacing: { before: 280, after: 120 } });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
  children: [new TextRun({ text: t, font: HFONT, size: 28, color: HCOLOR })], spacing: { before: 200, after: 100 } });
const caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 240 },
  children: [new TextRun({ text: t, bold: true, font: FONT, size: 22 })] });
const brk = () => new Paragraph({ children: [new PageBreak()] });

function img(file, wPx, hPx) {
  return new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width: wPx, height: hPx } })] });
}

// ---------- table in the Mid-Sem style: navy header, light grey banding ----------
const CB = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
function table(rows, widths, opt = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, cantSplit: true, children: r.map((cell, j) => new TableCell({
      width: { size: widths[j], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      borders: { top: CB, bottom: CB, left: CB, right: CB },
      shading: i === 0 ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" }
             : (i % 2 === 1 ? { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" } : undefined),
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new Paragraph({ keepNext: true, keepLines: true, alignment: (j === 0 && !opt.centerFirst) ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: runs(String(cell), { size: opt.size || 20, bold: i === 0 || (j === 0 && !opt.plainFirst),
          color: i === 0 ? "FFFFFF" : undefined }) })],
    })) })),
  });
}

// ---------- contents line with dot leader ----------
const toc = (t, key, indent = 0) => new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }], indent: { left: indent },
  spacing: { after: 0 }, children: runs(`${t}\t${PAGES[key] || "#"}`, { size: 18 }) });

// =====================================================================================
// COVER (same layout as the Mid-Semester report)
const cover = [
  C("", { after: 1400 }),
  C("**QUANTIZATION ACCURACY–SPEED–MEMORY TRADE-OFF**", { run: { size: 30 }, after: 60 }),
  C("**IN SMALL LANGUAGE MODELS**", { run: { size: 30 }, after: 200 }),
  C("BITS ZG628T: Dissertation — Final Report", { run: { size: 22 }, after: 600 }),
  C("by", { run: { size: 22 }, after: 300 }),
  C("**Arjun Puppala**", { after: 40 }), C("**2023tm93547**", { run: { size: 22 }, after: 600 }),
  C("Dissertation work carried out at", { run: { size: 22 }, after: 40 }), C("**BITS Pilani**", { run: { size: 22 }, after: 600 }),
  C("Submitted in partial fulfilment of **M.Tech (Work Integrated Learning Programme)**", { run: { size: 22 }, after: 20 }),
  C("degree programme", { run: { size: 22 }, after: 600 }),
  C("Under the Supervision of", { run: { size: 22 }, after: 300 }),
  C("**Gautham A**", { run: { size: 22 }, after: 20 }),
  C("**(Insert Organization Name, Location Name)**", { run: { size: 22 }, after: 700 }),
  C("**BIRLA INSTITUTE OF TECHNOLOGY & SCIENCE**", { run: { size: 26 }, after: 20 }),
  C("**PILANI (RAJASTHAN)**", { run: { size: 26 }, after: 20 }),
  C("**October 2026**", { run: { size: 22 }, after: 0 }),
  brk(),
];

// ABSTRACT + signatures
const sigTable = new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680],
  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
             right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ children: [
    ["Signature of the Student", "", "", "Name: Arjun Puppala", "Date:", "Place: Dallas"],
    ["Signature of the Supervisor", "", "", "Name: Gautham A", "Date:", "Place:"],
  ].map(col => new TableCell({ width: { size: 4680, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: col.map(t => new Paragraph({ spacing: { after: 20 }, children: runs(t, { size: 22 }) })) })) })] });

const abstract = [
  C("**ABSTRACT**", { run: { size: 26 }, after: 200 }),
  P("Quantization — running a language model at 8-bit or 4-bit precision instead of the native 16-bit — is the standard way to fit models on small GPUs, but its accuracy, memory and speed costs are usually assumed rather than measured. This dissertation measures them for microsoft/Phi-4-mini-instruct (3.8B parameters) on a single free-tier Google Colab T4 GPU with one fixed harness: 200 GSM8K (reasoning-heavy) and 200 MMLU (knowledge-heavy) questions, identical prompts, greedy decoding and identical scoring for 14 variants across two runtimes."),
  P("Under llama.cpp, the 4-bit Q4_K_M format cut peak memory by 62% (7.87 → 3.02 GB) and doubled generation speed (28.9 → 59.5 tokens/s) with no statistically significant accuracy loss on either benchmark, and it beat bitsandbytes NF4 on accuracy (+5.5 / +5.0 points), memory and speed (about 3–4×). The FP4 microscaling formats NVFP4 and MXFP4, run on the T4 through software decoding, were as small and fast but lost 7.0–7.5 MMLU points (p<0.01). Quantizing the KV cache to 8 bits was free. A 4-bit cache cost 4.5 MMLU points with FP16 weights (p=0.02), but this did not recur with quantized weights: in a joint weight × KV-cache grid, Q4_K_M weights with a 4-bit KV cache matched FP16 accuracy (90.0% / 65.0%) in 2.66 GB, 66% less memory."),
  P("In every 4-bit configuration MMLU lost more than GSM8K. An ablation localized this: quantizing only the feed-forward layers cut MMLU from 65.5% to 55.0%, while quantizing only the attention layers kept it at 64.5% (paired p<0.0001), supporting the view that factual knowledge is stored in feed-forward layers. A per-category analysis showed that on GSM8K the 4-bit losses concentrate in the longest problems (5+ steps: 20 questions lost vs 5 gained, p=0.004), and every llama.cpp variant returned its first token within about 0.1 s. A tensor-level audit showed that NF4's apparent memory excess over INT8 at mid-semester was a measurement artifact. Finally, the AWQ blocker was resolved, and a fault in AutoAWQ's recipe for grouped-query attention, which silently corrupted the model, was found and fixed."),
  C("", { after: 300 }), sigTable, brk(),
];

const contents = [
  C("**Contents**", { run: { size: 26 }, after: 200 }),
  toc("1. Summary of Work", "s1"), toc("2. Recap: Objectives and Status", "s2"), toc("3. Experimental Setup (as executed)", "s3"),
  toc("4. Results — Phase 1: Transformers + bitsandbytes", "s4"),
  toc("4.1 Accuracy", "s41", 400), toc("4.2 Memory", "s42", 400), toc("4.3 Speed", "s43", 400),
  toc("5. Results — Phase 2", "s5"),
  toc("5.1 llama.cpp FP16 baseline", "s51", 400), toc("5.2 GGUF k-quants (Q8_0, Q4_K_M)", "s52", 400),
  toc("5.3 KV-cache quantization", "s53", 400), toc("5.4 MXFP4 and NVFP4", "s54", 400),
  toc("5.5 Same bit width, different library", "s55", 400), toc("5.6 Paired significance tests", "s56", 400),
  toc("5.7 AWQ", "s57", 400), toc("5.8 Ablation: where the MMLU loss comes from", "s58", 400),
  toc("5.9 NF4 memory audit", "s59", 400), toc("5.10 Per-category error analysis", "s510", 400),
  toc("5.11 Time to first token", "s511", 400), toc("5.12 Joint weight and KV-cache quantization", "s512", 400),
  toc("6. Status of the Work Planned at Mid-Semester", "s6"), toc("7. Discussion", "s7"), toc("8. Limitations", "s8"),
  toc("9. Future Work", "s9"), toc("10. Conclusion", "s10"), toc("11. References", "s11"), toc("12. Abbreviations", "s12"),
  toc("Appendix A: Reproducibility", "sA"),
  C("", { after: 120 }),
  toc("Figure 1: Accuracy, peak memory and throughput across FP16 / INT8 / NF4", "f1"),
  toc("Figure 2: Measured GPU memory by component, llama.cpp FP16", "f2"),
  toc("Figure 3: Accuracy, memory and throughput of all llama.cpp variants", "f3"),
  toc("Figure 4: Phi-4-mini KV-cache size vs context length", "f4"),
  toc("Figure 5: Ablation — attention-only vs MLP-only NF4", "f5"),
  toc("Figure 6: MMLU accuracy change by subject area", "f6"),
  toc("Figure 7: GSM8K accuracy by problem length", "f7"),
  toc("Figure 8: Joint weight × KV-cache grid", "f8"),
  C("", { after: 120 }),
  ...[["1", "Accuracy, memory and throughput by precision (bitsandbytes)"], ["2", "Statistical check of the Phase-1 differences"],
      ["3", "Transformers FP16 vs llama.cpp FP16"], ["4", "GGUF k-quants under llama.cpp"], ["5", "KV-cache quantization"],
      ["6", "MXFP4 and NVFP4 results"], ["7", "MXFP4 and NVFP4 formats compared"], ["8", "Same bit width, different library"],
      ["9", "Paired significance tests"], ["10", "AWQ attempts"], ["11", "Ablation results"], ["12", "NF4 memory audit"],
      ["13", "MMLU accuracy by subject area"], ["14", "GSM8K accuracy by problem length"],
      ["15", "Time to first token (llama.cpp)"], ["16", "Time to first token (Transformers)"], ["17", "Joint weight × KV-cache grid"],
      ["18", "Status of the work planned at mid-semester"]].map(([n, t]) => toc(`Table ${n}: ${t}`, `t${n}`)),
];

const W5 = [2400, 1740, 1740, 1740, 1740];
const body = [
  H1("1. Summary of Work"),
  P("The mid-semester report completed the core study — FP16, bitsandbytes INT8 and bitsandbytes NF4 on Phi-4-mini-instruct — and planned five further items: GGUF/llama.cpp, NVFP4/MXFP4, an AWQ retry, a KV-cache retry and an ablation. All five have now been carried out on the same free-tier T4 and the same 200 + 200 questions."),
  P("A second inference pipeline was built on llama.cpp and used to evaluate seven variants in full: FP16, Q8_0, Q4_K_M, MXFP4, NVFP4, and FP16 weights with an 8-bit or 4-bit KV cache. This also removed the mid-semester KV-cache blocker and made the FP4 formats usable on a pre-Blackwell GPU. Three ablation variants (NF4 on the feed-forward layers only, on the attention layers only, and on both) were evaluated in full with Transformers, and an audit of the NF4 model's memory explained the mid-semester memory anomaly. The AWQ version conflict was resolved; the first AWQ model was found to be corrupted by a fault in AutoAWQ's recipe for grouped-query attention, which was diagnosed and fixed. A joint 3 × 3 grid of weight and KV-cache formats, a per-category error analysis and time-to-first-token measurements for every variant complete the study. Every Phase-2 run saved its per-question answers, so all Phase-2 comparisons are tested for significance with paired (McNemar) tests."),

  H1("2. Recap: Objectives and Status"),
  B("Quantify the accuracy cost of 8-bit and 4-bit quantization on a current small instruct model — **Completed** for 10 weight-quantization variants across two runtimes (Sections 4 and 5)."),
  B("Localize where the loss concentrates (GSM8K vs MMLU) — **Completed**, and explained by an ablation (Section 5.8)."),
  B("Measure accuracy, peak memory and throughput jointly for every precision — **Completed**, with a per-component memory breakdown (Figure 2) and a tensor-level memory audit (Section 5.9)."),
  B("Compare several 4-bit schemes on the same model and GPU (NVFP4, MXFP4, AWQ, Q4_K_M) — **Completed** for NVFP4, MXFP4, Q4_K_M and NF4; AWQ fixed and verified on a 10-question check, full evaluation left as future work."),
  B("Evaluate KV-cache quantization as an independent memory lever — **Completed** (Section 5.3)."),
  B("Per-category error analysis — **Completed**: MMLU by subject area, GSM8K by problem length, and error types (Section 5.10)."),
  B("Time to first token — **Completed**: measured directly for all llama.cpp and Transformers variants (Section 5.11)."),
  B("Evaluate weight and KV-cache quantization jointly — **Completed**: full 3 × 3 grid of weight and KV-cache formats (Section 5.12)."),
  B("Run everything on realistic, affordable hardware (one free-tier Colab T4) — **Completed** throughout."),

  H1("3. Experimental Setup (as executed)"),
  H2("3.1 Controls common to every variant"),
  B("Model: microsoft/Phi-4-mini-instruct — 3.8B parameters, 32 layers, hidden size 3,072, grouped-query attention with 24 query heads and 8 key/value heads, head dimension 128, tied input/output embeddings, 200,064-token vocabulary [8, 9]."),
  B("Hardware: one free-tier Google Colab Tesla T4 (16 GB, compute capability 7.5)."),
  B("Benchmarks: GSM8K (200 test questions, seed 42, exact match on the final number) and MMLU (200 test questions, seed 42, exact match on the answer letter) [6, 7]. Every run asserts that its question subsets are identical to Phase 1."),
  B("Prompts: identical task prompts, formatted with the model's own chat template; greedy decoding; at most 512 new tokens; identical answer extractors."),
  H2("3.2 Runtime 1 — Transformers + bitsandbytes"),
  P("FP16 baseline, bitsandbytes INT8 (LLM.int8(), outlier threshold 6.0) [1] and NF4 with double quantization and FP16 compute [2], loaded through Hugging Face Transformers; the ablation variants use the same NF4 configuration with either the attention or the feed-forward projections excluded from quantization. Peak memory is torch.cuda.max_memory_allocated(); throughput is generated tokens divided by wall-clock time, including prompt processing."),
  H2("3.3 Runtime 2 — llama.cpp"),
  P("llama.cpp is pinned at commit d327bf1 and compiled from source with CUDA for the T4 (sm_75). The FP16 GGUF is produced by llama.cpp's converter from the same Hugging Face checkpoint, and every quantized file is produced from it with llama-quantize. Inference goes through llama-server's chat endpoint using the chat template stored in the GGUF file: greedy decoding, 4,096-token context, one sequence, FlashAttention enabled [18], and prompt caching disabled so that no question benefits from the previous one. Throughput uses the same definition as Runtime 1. Peak memory is sampled from the driver (NVML) every 0.2 s minus the idle baseline, and the server log reports the size of each GPU buffer. NVML includes the CUDA context, which the PyTorch allocator does not, so Runtime-2 totals are about 0.15 GB higher than an allocator-based figure would be."),
  H2("3.4 AWQ"),
  P("AWQ [4] uses AutoAWQ 0.2.9 with Transformers 4.51.3 in a separate Colab session: 4-bit weights, group size 128, zero point, GEMM layout, calibrated on 128 samples of the default pile-val set; the model is then loaded through Transformers like the Runtime-1 models. AutoAWQ's compiled CUDA kernels are not available for the current Colab Python/PyTorch, so it runs on its Triton kernels."),
  H2("3.5 Engineering for free-tier constraints"),
  P("Every answer is appended to a per-question log on Google Drive as soon as it is produced, so interrupted runs resume where they stopped; builds and quantized models are cached; and every new variant is first checked on 10 questions with its outputs read, not only scored. The runs were spread across four Colab accounts to fit the GPU quota. Per-question logs also make paired significance tests possible."),

  H1("4. Results — Phase 1: Transformers + bitsandbytes"),
  P("Table 1 repeats the mid-semester results; Figure 1 plots them. Only the throughput entry in the last column was recomputed from the logged numbers."),
  table([
    ["Metric", "FP16 (baseline)", "INT8 (bnb)", "NF4 (bnb, 4-bit)", "4-bit vs FP16"],
    ["GSM8K accuracy", "86.5%", "90.0%", "85.0%", "-1.5 pp"],
    ["MMLU accuracy", "65.5%", "65.0%", "58.0%", "-7.5 pp"],
    ["Peak GPU memory", "7.28–7.34 GB", "4.28–4.36 GB", "5.48 GB*", "-25%*"],
    ["Throughput (tok/s)", "18.2–19.9", "8.8–8.9", "13.6–15.2", "~24–25% slower"],
  ], W5),
  caption("Table 1: Accuracy, memory and throughput by precision (bitsandbytes). *Inflated by a measurement artifact, see Section 5.9"),
  img("fig1.png", 620, 194),
  caption("Figure 1: Accuracy, peak memory and throughput across FP16 / INT8 / NF4 (Phi-4-mini-instruct, Colab T4)"),
  H2("4.1 Accuracy"),
  P("Going to 4-bit cost GSM8K 1.5 percentage points and MMLU 7.5 points, the opposite of the initial hypothesis that multi-step arithmetic would be more fragile. Phase 1 did not save per-question answers, so Table 2 uses an unpaired two-proportion test. On its own, the MMLU drop was only suggestive (p≈0.12). It was confirmed in Phase 2: the NF4 re-run reproduced 85.0% / 58.0% exactly, the same asymmetry appeared in every other 4-bit format, and paired tests show it to be significant (Sections 5.6 and 5.8)."),
  table([
    ["Comparison", "Difference", "z", "p (two-sided)", "Reading"],
    ["MMLU: NF4 vs FP16", "-7.5 pp", "1.54", "0.12", "Suggestive (confirmed in Phase 2)"],
    ["GSM8K: NF4 vs FP16", "-1.5 pp", "0.43", "0.67", "Noise"],
    ["GSM8K: INT8 vs FP16", "+3.5 pp", "1.09", "0.28", "Noise"],
  ], [2600, 1500, 1100, 1700, 2460], { plainFirst: false }),
  caption("Table 2: Statistical check of the Phase-1 accuracy differences (unpaired two-proportion z-test, n=200 each)"),
  H2("4.2 Memory"),
  P("FP16 to INT8 roughly halved peak memory, as expected, and NF4 appeared to use more memory than INT8. The mid-semester report attributed this to the KV cache and activations. The KV cache cannot explain it: Phi-4-mini needs 128 KiB per token (32 layers × 2 × 8 heads × 128 dimensions × 2 bytes), about 50 MB for a typical 400-token GSM8K sequence. The tensor-level audit in Section 5.9 shows that the excess was memory left over from the previously loaded model, not a property of NF4."),
  H2("4.3 Speed"),
  P("INT8 was the slowest variant on the T4, at roughly half the FP16 throughput; NF4 was about 24–25% slower than FP16. This is consistent with LLM.int8() performing mixed-precision outlier decomposition on every matrix multiplication [1]. A dtype mismatch that caused bitsandbytes to log a warning on every matrix multiplication was fixed before these measurements, and INT8 remained slower than FP16 afterwards. The NF4 re-run in Phase 2 measured 14.6–16.3 tokens/s, close to the Phase-1 figure."),

  H1("5. Results — Phase 2"),
  H2("5.1 llama.cpp FP16 baseline"),
  P("On the same 200 + 200 questions, llama.cpp FP16 scored 89.0% on GSM8K and 65.5% on MMLU (Table 3), statistically indistinguishable from Transformers FP16. It generated 28.9 tokens/s on GSM8K against 19.9 for Transformers, about 45% faster at the same precision. MMLU end-to-end throughput is lower (24.8 tokens/s) because answers average only 14 tokens, so prompt processing weighs more; pure decoding runs at about 28 tokens/s in both tasks. Because of this runtime difference, each quantized variant is compared with the FP16 baseline of its own runtime."),
  table([
    ["Metric", "Transformers FP16", "llama.cpp FP16"],
    ["GSM8K accuracy", "86.5%", "89.0%"],
    ["MMLU accuracy", "65.5%", "65.5%"],
    ["Peak GPU memory", "7.28–7.34 GB", "7.87 GB (incl. CUDA context)"],
    ["Throughput, end-to-end (tok/s)", "18.2–19.9", "24.8–28.9"],
    ["Decode speed (tok/s)", "—", "27.9–29.2"],
  ], [3120, 3120, 3120]),
  caption("Table 3: Transformers FP16 vs llama.cpp FP16 on the same T4 (n=200 per benchmark)"),
  P("**Reproducibility.** On a second Colab account, a fresh run of FP16, Q8_0 and Q4_K_M reproduced every accuracy exactly (89.0/65.5%, 90.0/64.5% and 90.5/63.0%), as expected with greedy decoding. Absolute throughput on that instance was about 30% lower (20.3 tokens/s for FP16 on GSM8K), but the relative speed-ups were unchanged: Q4_K_M ran 2.05× faster than FP16 there, against 2.06× in the main run. Free-tier GPUs vary between sessions, so this report compares speeds only within a session or as ratios."),
  P("Figure 2 shows where llama.cpp's 7.87 GB goes: 7.15 GB of weights (91%), a 0.50 GB KV cache pre-allocated for 4,096 tokens, 0.07 GB of compute buffers and about 0.15 GB of CUDA context."),
  img("fig2.png", 600, 200),
  caption("Figure 2: Measured GPU memory by component, llama.cpp FP16 GGUF on the T4"),

  H2("5.2 GGUF k-quants (Q8_0, Q4_K_M)"),
  P("Q8_0 stores weights in blocks of 32 with one scale per block (8.5 bits per weight); Q4_K_M is a mixed 4/6-bit k-quant built from 256-weight super-blocks. Neither changed accuracy significantly on either benchmark (Table 9). Q4_K_M cut peak memory by 62% (7.87 → 3.02 GB; weights 7.15 → 2.32 GB) and roughly doubled generation speed on GSM8K (28.9 → 59.5 tokens/s); Q8_0 cut memory by 43% and was 62% faster. In llama.cpp, unlike bitsandbytes, fewer bits always meant both less memory and more speed. Figure 3 summarizes all llama.cpp variants in the style of Figure 1."),
  table([
    ["Metric", "FP16 GGUF (baseline)", "Q8_0 (GGUF)", "Q4_K_M (GGUF, 4-bit)", "4-bit vs FP16"],
    ["GSM8K accuracy", "89.0%", "90.0%", "90.5%", "+1.5 pp"],
    ["MMLU accuracy", "65.5%", "64.5%", "63.0%", "-2.5 pp"],
    ["Peak GPU memory", "7.87 GB", "4.50 GB", "3.02 GB", "-62%"],
    ["Weights in GPU memory", "7.15 GB", "3.80 GB", "2.32 GB", "-68%"],
    ["Throughput (tok/s)", "24.8–28.9", "37.8–46.9", "42.6–59.5", "~72–106% faster"],
  ], W5),
  caption("Table 4: GGUF k-quants under llama.cpp (n=200 per benchmark)"),
  img("fig3_llama.png", 620, 194),
  caption("Figure 3: Accuracy, peak memory and throughput of all llama.cpp variants (Phi-4-mini-instruct, Colab T4)"),

  H2("5.3 KV-cache quantization"),
  P("At mid-semester, Transformers' QuantizedCache failed twice: the first attempt exhausted Colab's system RAM after about 10 questions, and the second reached a hard check that rejects models with sliding-window layers (\"QuantizedCache is only supported for models with only full attention layers ... {'sliding_attention'}\"). llama.cpp quantizes the KV cache inside its own attention implementation without that restriction. With FP16 weights, the cache was stored as f16, q8_0 (8.5 bits per value) or q4_0 (4.5 bits per value)."),
  P("The 8-bit cache was free: accuracy changed by at most 1 point (not significant) while the cache shrank from 0.50 to 0.27 GB. The 4-bit cache cost 4.5 MMLU points (p=0.022) and 1.5 GSM8K points (not significant) for a further 0.13 GB. Speed was unchanged (Table 5). This MMLU loss did not recur when the same 4-bit cache was combined with Q8_0 or Q4_K_M weights (Section 5.12), so it is best read as a small and uncertain effect rather than a reliable cost. At a 4,096-token context the KV cache is only 6% of the memory, so total memory fell by only 3–5%. Figure 4 shows why KV-cache quantization matters at long contexts instead: at Phi-4-mini's full 128K context the f16 cache would need 16 GB, more than the T4, while q8_0 would need 8.5 GB."),
  table([
    ["Metric", "f16 KV (baseline)", "q8_0 KV", "q4_0 KV", "q4_0 vs f16"],
    ["GSM8K accuracy", "89.0%", "88.0%", "87.5%", "-1.5 pp"],
    ["MMLU accuracy", "65.5%", "65.0%", "61.0%", "-4.5 pp"],
    ["Peak GPU memory", "7.87 GB", "7.64 GB", "7.51 GB", "-5%"],
    ["Throughput (tok/s)", "24.8–28.9", "25.4–28.5", "25.7–28.6", "unchanged"],
    ["KV-cache size (4,096 ctx)", "0.50 GB", "0.27 GB", "0.14 GB", "-72%"],
  ], W5),
  caption("Table 5: KV-cache quantization (FP16 weights, llama.cpp, n=200 per benchmark; KV sizes from the llama.cpp log)"),
  img("fig3.png", 560, 261),
  caption("Figure 4: Phi-4-mini KV-cache size vs context length (calculated from the architecture; 4,096-token values match the measured log)"),

  H2("5.4 MXFP4 and NVFP4"),
  P("MXFP4 and NVFP4 store each weight as a 4-bit floating-point number (E2M1: magnitudes 0, 0.5, 1, 1.5, 2, 3, 4 and 6) with a shared scale per block (Table 7) [11, 12, 13]. Native FP4 arithmetic requires Blackwell-class GPUs. The pinned llama.cpp supports both formats as tensor types with CUDA code that decodes them in software on older GPUs; all attention and feed-forward weights were converted, and the token embedding was kept at 8 bits. Accuracy measured this way reflects the formats; speed is T4-specific, because the 4-bit weights are multiplied with 8-bit activations rather than with FP4 tensor-core arithmetic."),
  P("Both formats were as compact as Q4_K_M (2.20–2.30 GB of weights) and as fast or faster: NVFP4 reached 66.0 tokens/s on GSM8K, the fastest variant measured. Both lost significantly more MMLU accuracy than Q4_K_M: −7.0 points for NVFP4 and −7.5 for MXFP4 (p<0.01). MXFP4 also lost 5.5 GSM8K points (p=0.02), while NVFP4's 2.5-point GSM8K loss was not significant. This ordering is consistent with the formats' design — NVFP4's 16-value blocks with an FP8 scale preserve more precision than MXFP4's 32-value blocks with a power-of-two scale, at a cost of 0.25 extra bits per weight — although the direct NVFP4-vs-MXFP4 difference is not significant on its own (GSM8K p=0.26). Q4_K_M, whose file is almost exactly the size of the NVFP4 file (2.32 vs 2.30 GB), kept 4.5 more MMLU points; its loss against FP16 is not significant while NVFP4's is, although the direct Q4_K_M-vs-NVFP4 comparison does not reach significance (p=0.14)."),
  table([
    ["Metric", "FP16 GGUF (baseline)", "MXFP4 (4-bit)", "NVFP4 (4-bit)", "NVFP4 vs FP16"],
    ["GSM8K accuracy", "89.0%", "83.5%", "86.5%", "-2.5 pp"],
    ["MMLU accuracy", "65.5%", "58.0%", "58.5%", "-7.0 pp"],
    ["Peak GPU memory", "7.87 GB", "2.90 GB", "3.00 GB", "-62%"],
    ["Weights in GPU memory", "7.15 GB", "2.20 GB", "2.30 GB", "-68%"],
    ["Throughput (tok/s)", "24.8–28.9", "39.6–50.5", "38.5–66.0", "~55–128% faster"],
  ], W5),
  caption("Table 6: MXFP4 and NVFP4 results (llama.cpp on T4, software-decoded; n=200 per benchmark)"),
  table([
    ["Property", "MXFP4 (OCP Microscaling)", "NVFP4 (NVIDIA)"],
    ["Element format", "E2M1 (4-bit float)", "E2M1 (4-bit float)"],
    ["Block size", "32 values", "16 values"],
    ["Block scale", "8-bit, power of two (E8M0)", "8-bit float (E4M3)"],
    ["Additional scale", "None", "One FP32 scale per tensor"],
    ["Storage per weight", "4.25 bits", "4.5 bits"],
    ["Native arithmetic", "Blackwell-class GPUs", "Blackwell-class GPUs"],
  ], [2800, 3280, 3280]),
  caption("Table 7: MXFP4 and NVFP4 formats compared [11, 12, 13]"),

  H2("5.5 Same bit width, different library"),
  P("Table 8 compares the two libraries at the same nominal bit width. At 8 bits, accuracy was essentially identical but llama.cpp Q8_0 was 4–5× faster than bitsandbytes INT8. At 4 bits, Q4_K_M was more accurate than NF4 on both benchmarks (+5.5 and +5.0 points), 3–4× faster, and smaller. NF4's clean footprint is 2.69 GB of tensors at load (Section 5.9); its Phase-1 peak of 5.48 GB is inflated and, being an allocator measurement, is not directly comparable with llama.cpp's driver-level figure. For this model on a T4, the choice of library mattered more than the choice of bit width."),
  table([
    ["Metric", "INT8 (bnb)", "Q8_0 (GGUF)", "NF4 (bnb, 4-bit)", "Q4_K_M (GGUF, 4-bit)", "Q4_K_M vs NF4"],
    ["GSM8K accuracy", "90.0%", "90.0%", "85.0%", "90.5%", "+5.5 pp"],
    ["MMLU accuracy", "65.0%", "64.5%", "58.0%", "63.0%", "+5.0 pp"],
    ["Peak GPU memory", "4.28–4.36 GB", "4.50 GB", "5.48 GB*", "3.02 GB", "see text"],
    ["Throughput (tok/s)", "8.8–8.9", "37.8–46.9", "13.6–15.2", "42.6–59.5", "~3.1–3.9× faster"],
  ], [2000, 1400, 1400, 1500, 1600, 1460], { size: 18 }),
  caption("Table 8: Same bit width, different library (bitsandbytes vs llama.cpp). *See Section 5.9"),

  H2("5.6 Paired significance tests"),
  P("Because Phase-2 runs record every answer, each variant can be compared with its baseline question by question. McNemar's exact test counts only the questions where the two variants disagree: those the baseline answered correctly and the variant got wrong (\"lost\"), and the reverse (\"gained\"). Table 9 lists the llama.cpp comparisons."),
  table([
    ["Variant vs FP16 GGUF", "GSM8K Δ (lost/gained)", "GSM8K p", "MMLU Δ (lost/gained)", "MMLU p"],
    ["Q8_0", "+1.0 pp (3/5)", "0.73", "-1.0 pp (3/1)", "0.63"],
    ["Q4_K_M", "+1.5 pp (8/11)", "0.65", "-2.5 pp (8/3)", "0.23"],
    ["NVFP4", "-2.5 pp (13/8)", "0.38", "-7.0 pp (19/5)", "**0.007**"],
    ["MXFP4", "-5.5 pp (15/4)", "**0.019**", "-7.5 pp (21/6)", "**0.006**"],
    ["KV cache q8_0", "-1.0 pp (2/0)", "0.50", "-0.5 pp (2/1)", "1.00"],
    ["KV cache q4_0", "-1.5 pp (9/6)", "0.61", "-4.5 pp (11/2)", "**0.022**"],
    ["Q8_0 + KV q8_0", "+1.5 pp (2/5)", "0.45", "0.0 pp (3/3)", "1.00"],
    ["Q8_0 + KV q4_0", "+0.5 pp (6/7)", "1.00", "-3.0 pp (11/5)", "0.21"],
    ["Q4_K_M + KV q8_0", "+1.0 pp (8/10)", "0.82", "-3.0 pp (9/3)", "0.15"],
    ["Q4_K_M + KV q4_0", "+1.0 pp (9/11)", "0.82", "-0.5 pp (7/6)", "1.00"],
  ], [2200, 2000, 1200, 2000, 1960]),
  caption("Table 9: Paired significance tests against the llama.cpp FP16 baseline (McNemar exact test, n=200; bold = p<0.05)"),
  P("Two patterns are clear. First, every significant loss is on MMLU except MXFP4's GSM8K loss. Second, in all five 4-bit configurations — Q4_K_M, NVFP4, MXFP4, the 4-bit KV cache and NF4 — MMLU lost more than GSM8K. The mid-semester observation therefore holds across formats and runtimes, and not only for NF4."),

  H2("5.7 AWQ"),
  P("**Version conflict resolved.** The mid-semester attempt pinned Transformers 4.47.1, which is older than Phi-4-mini itself (the model card specifies 4.49.0 [8]) and caused the rope_scaling error; newer versions break AutoAWQ's imports (a missing LossKwargs symbol). AutoAWQ's last tested version, Transformers 4.51.3, satisfies both, and AutoAWQ then quantized all 32 layers in 67.5 minutes."),
  P("**First AWQ model corrupted.** On its 10-question check, the first AWQ model scored 0/10 on both benchmarks: every answer ran to the 512-token limit with repeated words. AWQ protects important weight channels by scaling them up before quantization and scaling the preceding layer down by the same factor [4]. AutoAWQ's Phi-3 recipe applies one such pair to the fused query/key/value projection and the attention output projection, dividing the *last* 3,072 rows of the fused projection on the assumption that they are the value projection. That holds for multi-head attention, but Phi-4-mini uses grouped-query attention [10]: its fused projection has 3,072 query, 1,024 key and only 1,024 value rows, so the scaling also hits all key rows and 1,024 query rows, and a separate scale per output-projection input cannot be absorbed into value heads that are shared by three query heads. The transformation is not equivalent, so the model is corrupted before any rounding. AutoAWQ's Llama recipe skips this step when the shapes differ; the Phi-3 recipe does not."),
  P("**Fix verified.** With the same check added (the query/key/value → output-projection scaling is skipped on grouped-query layers), the re-quantized model answered normally: on the first 10 MMLU questions it gave well-formed answers and scored 4/10, the same as llama.cpp FP16 on those questions, with 8 of its 10 answers identical (Table 10). Peak memory during the first check was 2.85 GB, the lowest of all Transformers-based variants, as expected for 4-bit weights. The full 200-question evaluation of the corrected model could not be completed in the time available."),
  table([
    ["Observation", "Attempt 1 (original recipe)", "Attempt 2 (GQA fix)"],
    ["Quantization time (T4)", "67.5 min, 32/32 layers", "Re-quantized"],
    ["10-question check", "GSM8K 0/10, MMLU 0/10", "MMLU 4/10 (FP16: 4/10)"],
    ["Answers reaching the 512-token limit", "20 of 20 (repeated words)", "0 of 10"],
    ["Answers identical to FP16", "0", "8 of 10"],
    ["Peak GPU memory (check)", "2.85 GB", "not recorded separately"],
  ], [3120, 3120, 3120]),
  caption("Table 10: AWQ attempts (AutoAWQ 0.2.9, Transformers 4.51.3, 4-bit, group size 128)"),

  H2("5.8 Ablation: where the MMLU loss comes from"),
  P("The mid-semester report proposed that factual recall depends on narrower weights than arithmetic does. To test where the loss arises, NF4 was applied to only one half of each transformer layer, keeping the other half in FP16. A count of the quantized modules after loading confirmed the split (64 attention and 0 feed-forward projections in 4-bit, or the reverse)."),
  P("The result is unambiguous (Table 11, Figure 5). Quantizing only the attention layers left MMLU at 64.5%, within one point of FP16. Quantizing only the feed-forward (MLP) layers cut MMLU to 55.0%, even below full NF4. The paired difference between the two halves is 9.5 points: 20 questions answered correctly only by the attention-only model and 1 only by the MLP-only model (p<0.0001). GSM8K was essentially unaffected in all three (85.0–86.5%). The loss in factual knowledge comes from quantizing the feed-forward layers. This matches evidence that transformer feed-forward layers act as key-value memories that store factual associations [16, 17], and it supports the mid-semester hypothesis. The full NF4 re-run reproduced Phase 1 exactly (85.0% / 58.0%)."),
  table([
    ["Metric", "FP16 (Phase 1)", "NF4 attention-only", "NF4 MLP-only", "NF4 full (re-run)", "MLP-only vs attention-only"],
    ["GSM8K accuracy", "86.5%", "85.0%", "86.5%", "85.0%", "+1.5 pp (p=0.66)"],
    ["MMLU accuracy", "65.5%", "64.5%", "55.0%", "58.0%", "**-9.5 pp (p<0.0001)**"],
    ["Peak GPU memory", "7.28–7.34 GB", "7.37 GB*", "5.17 GB*", "4.06 GB*", "—"],
    ["Throughput (tok/s)", "18.2–19.9", "16.5–17.6", "16.3–17.7", "14.6–16.3", "—"],
  ], [1800, 1400, 1500, 1400, 1500, 1760], { size: 18 }),
  caption("Table 11: Ablation results (Transformers + bitsandbytes NF4, n=200 per benchmark). *Includes ~1.15 GB retained from the previous model (Section 5.9)"),
  img("fig5_ablation.png", 560, 261),
  caption("Figure 5: Ablation — accuracy with NF4 applied to attention only, MLP only, or both"),

  H2("5.9 NF4 memory audit"),
  P("To explain NF4's memory, a freshly loaded NF4 model was audited tensor by tensor (Table 12). Its total was 2.69 GB: 1.50 GB of packed 4-bit weights, 1.15 GB for the FP16 embedding (shared with the output layer) and 0.05 GB of quantization scales, exactly as the bit widths predict and well below INT8's 4.14 GB. Every NF4 load that followed another model in the same Python session showed about 1.15 GB more than its expected footprint, the size of one FP16 embedding matrix, which indicates memory retained from the previous model. The mid-semester NF4 load, which followed the INT8 model, showed a similar excess (1.56 GB). The mid-semester finding that NF4 used more memory than INT8 was therefore a measurement artifact of loading several models in one session, not a property of NF4."),
  table([
    ["Measurement", "Measured", "Expected from bit widths", "Excess"],
    ["NF4, fresh load (audit)", "2.69 GB", "2.69 GB", "0.00 GB"],
    ["  packed 4-bit weights / FP16 embedding / scales", "1.50 / 1.15 / 0.05 GB", "—", "—"],
    ["NF4 full, after a previous model", "3.85 GB", "2.69 GB", "+1.16 GB"],
    ["NF4 MLP-only, after a previous model", "4.95 GB", "3.80 GB", "+1.15 GB"],
    ["NF4 attention-only, after a previous model", "7.19 GB", "6.03 GB", "+1.15 GB"],
    ["NF4, mid-semester (after INT8)", "4.25 GB", "2.69 GB", "+1.56 GB"],
  ], [3800, 1900, 2100, 1560], { plainFirst: true }),
  caption("Table 12: NF4 memory audit (GPU memory allocated right after loading)"),


  H2("5.10 Per-category error analysis"),
  P("To see which kinds of question quantization hurts, every answer was grouped by category: MMLU questions by the standard four MMLU subject areas, and GSM8K problems by the number of steps in their reference solution (2, 3, 4, or 5 and more steps; recovered from the official GSM8K test file, which matched all 200 saved gold answers). Each group holds 43–69 questions, so single-variant differences within a group are noisy; the conclusions below rest on paired tests pooled over the four 4-bit llama.cpp variants (Q4_K_M, NVFP4, MXFP4 and the 4-bit KV cache)."),
  P("**MMLU by subject area (Table 13, Figure 6).** The 4-bit variants lost accuracy in STEM (15 questions lost vs 4 gained, p=0.019), humanities (20 vs 8, p=0.036) and the business/health/miscellaneous group (17 vs 2, p=0.001), but not significantly in the social sciences (7 vs 2, p=0.18). The pattern differs by format: NVFP4 lost nothing in STEM but 10–14 points in humanities and business/health, whereas MXFP4 and the 4-bit KV cache lost most in STEM. In the ablation, the MLP-only model scored below the attention-only model in all four areas (−7 to −12 points), most clearly in the humanities (9 vs 1 questions, p=0.021). The feed-forward effect is therefore broad across subjects, not confined to one domain."),
  table([
    ["Variant", "STEM (n=44)", "Humanities (n=69)", "Social sci. (n=43)", "Other (n=44)"],
    ["FP16 GGUF (baseline)", "63.6%", "59.4%", "81.4%", "61.4%"],
    ["Q8_0", "61.4%", "58.0%", "83.7%", "59.1%"],
    ["Q4_K_M", "61.4%", "59.4%", "76.7%", "56.8%"],
    ["NVFP4", "63.6%", "49.3%", "79.1%", "47.7%"],
    ["MXFP4", "52.3%", "55.1%", "76.7%", "50.0%"],
    ["FP16 + KV q4_0", "52.3%", "56.5%", "81.4%", "56.8%"],
    ["NF4 attention-only", "63.6%", "59.4%", "81.4%", "56.8%"],
    ["NF4 MLP-only", "56.8%", "47.8%", "74.4%", "45.5%"],
    ["NF4 full", "54.5%", "50.7%", "74.4%", "56.8%"],
  ], [2560, 1700, 1700, 1700, 1700]),
  caption("Table 13: MMLU accuracy by subject area (Other = business, health and miscellaneous subjects)"),
  img("fig6_mmlu_categories.png", 560, 261),
  caption("Figure 6: MMLU accuracy change vs FP16 GGUF by subject area (no bar = no change)"),
  P("**GSM8K by problem length (Table 14, Figure 7).** On short problems (2–3 steps) the four 4-bit variants together lost 10 and gained 15 questions against FP16 (p=0.42) — no net effect. On the longest problems (5 or more steps) they lost 20 and gained only 5 (p=0.004), an average drop of 7.8 points. The mid-semester hypothesis — that rounding errors compound over long reasoning chains — is therefore correct for long problems; it was hidden in the aggregate because most GSM8K problems are short. The attention-only ablation model was also weakest on long problems (68.8% vs 81.2% for MLP-only, p=0.07), which suggests that attention precision matters for keeping long chains on track, but this needs more data."),
  table([
    ["Variant", "2 steps (n=48)", "3 steps (n=59)", "4 steps (n=45)", "5+ steps (n=48)"],
    ["FP16 GGUF (baseline)", "97.9%", "81.4%", "91.1%", "87.5%"],
    ["Q8_0", "97.9%", "86.4%", "86.7%", "89.6%"],
    ["Q4_K_M", "97.9%", "89.8%", "91.1%", "83.3%"],
    ["NVFP4", "95.8%", "86.4%", "84.4%", "79.2%"],
    ["MXFP4", "87.5%", "84.7%", "84.4%", "77.1%"],
    ["FP16 + KV q4_0", "95.8%", "84.7%", "91.1%", "79.2%"],
    ["NF4 attention-only", "97.9%", "86.4%", "86.7%", "68.8%"],
    ["NF4 MLP-only", "97.9%", "83.1%", "84.4%", "81.2%"],
    ["NF4 full", "93.8%", "79.7%", "86.7%", "81.2%"],
  ], [2560, 1700, 1700, 1700, 1700]),
  caption("Table 14: GSM8K accuracy by length of the reference solution"),
  img("fig7_gsm8k_steps.png", 560, 261),
  caption("Figure 7: GSM8K accuracy by problem length, llama.cpp variants"),
  P("**Error types.** Almost every error is a wrong answer, not a formatting failure. Across all ten Phase-2 variants and 4,000 answers, only one answer had no extractable result and only five ran into the 512-token limit (two each for MXFP4 on GSM8K and the 4-bit KV cache on MMLU, one for NF4 attention-only). Quantization degraded what the model knows and computes, not its ability to follow the answer format."),

  H2("5.11 Time to first token"),
  P("Time to first token (TTFT) is the delay before the first word of an answer appears: the time to process the prompt plus one generation step. It was measured directly for all eleven llama.cpp variants in a single session: 30 GSM8K and 30 MMLU prompts per variant (median prompt length 89 and 110 tokens), one generated token each, after a warm-up request (Table 15); llama-server also reported the prompt-processing time on its own. Every variant returned its first token in 58–99 ms at the median, of which prompt processing took 45–65 ms. Differences between variants were small: quantized weights and quantized KV caches did not slow the start (Q4_K_M 63 ms vs FP16 71 ms on GSM8K), and the slowest case was NVFP4 on the longer MMLU prompts (99 ms vs 87 ms for FP16), while MXFP4 was among the fastest — so the extra cost is specific to NVFP4's software decoding. An earlier estimate derived from the benchmark logs (end-to-end time minus decode time) gave values within about 30 ms of these. TTFT matters far more for long prompts, which this benchmark does not exercise."),
  table([
    ["Variant (llama.cpp)", "GSM8K median TTFT", "MMLU median TTFT", "MMLU prompt processing"],
    ["FP16 GGUF (baseline)", "71 ms", "87 ms", "56 ms"],
    ["Q8_0", "67 ms", "89 ms", "57 ms"],
    ["Q4_K_M", "63 ms", "86 ms", "56 ms"],
    ["NVFP4", "73 ms", "99 ms", "65 ms"],
    ["MXFP4", "62 ms", "82 ms", "49 ms"],
    ["FP16 + KV q8_0", "70 ms", "89 ms", "61 ms"],
    ["FP16 + KV q4_0", "69 ms", "81 ms", "62 ms"],
    ["Q8_0 + KV q8_0", "65 ms", "78 ms", "59 ms"],
    ["Q8_0 + KV q4_0", "63 ms", "71 ms", "61 ms"],
    ["Q4_K_M + KV q8_0", "61 ms", "73 ms", "57 ms"],
    ["Q4_K_M + KV q4_0", "58 ms", "70 ms", "59 ms"],
  ], [3000, 2120, 2120, 2120]),
  caption("Table 15: Time to first token, llama.cpp variants (measured directly in one session; 30 + 30 prompts per variant, medians)"),
  P("For the Transformers variants, TTFT was measured directly in a single session: 30 GSM8K and 30 MMLU prompts per variant (median prompt length 89 and 110 tokens), one generated token each, with the GPU synchronised before and after (Table 16). FP16 needed 73–77 ms, close to llama.cpp FP16. bitsandbytes INT8 nearly doubled it (140–149 ms), consistent with its slow decoding throughput, and NF4 added about 65–70% (121–132 ms). The ablation variants show that the cost of 4-bit weights in the prompt phase grows with the number of quantized weights: quantizing only attention (about a quarter of the linear weights) added 15 ms, quantizing only the feed-forward layers added 37–45 ms."),
  table([
    ["Variant (Transformers)", "GSM8K median TTFT", "MMLU median TTFT", "MMLU 90th percentile"],
    ["FP16 (baseline)", "73 ms", "77 ms", "207 ms"],
    ["INT8 (bnb)", "140 ms", "149 ms", "213 ms"],
    ["NF4 (bnb)", "121 ms", "132 ms", "276 ms"],
    ["NF4 attention-only", "88 ms", "93 ms", "245 ms"],
    ["NF4 MLP-only", "110 ms", "122 ms", "278 ms"],
  ], [3000, 2120, 2120, 2120]),
  caption("Table 16: Time to first token, Transformers variants (measured directly; 30 + 30 prompts per variant, one session)"),

  H2("5.12 Joint weight and KV-cache quantization"),
  P("Sections 5.2 and 5.3 changed either the weights or the KV cache. To test them together, the remaining combinations of the 3 × 3 grid {F16, Q8_0, Q4_K_M weights} × {f16, q8_0, q4_0 KV cache} were run on the same 200 + 200 questions (Table 17, Figure 8). The four new combinations were run in a second Colab session, so their throughput is comparable with each other but only approximately with the main run (Section 5.1)."),
  P("No combination lost accuracy significantly against FP16 on either benchmark (Table 9; all p ≥ 0.15). The two effects did not compound: Q4_K_M weights with a 4-bit KV cache scored 90.0% on GSM8K and 65.0% on MMLU — within one point of FP16 — while needing 2.66 GB, the lowest memory of any configuration tested and 66% less than FP16. Pooled over the three weight types, the 4-bit KV cache lost 26 and gained 17 MMLU questions against the f16 cache (p=0.22), so the significant loss seen with FP16 weights alone (Section 5.3) did not generalize. At this context length the KV-cache saving is modest (0.36 GB from f16 to q4_0); its value grows with context, where it adds to the weight saving rather than trading accuracy against it. The only side effect observed was slightly more long answers: four GSM8K answers of the Q4_K_M + 4-bit-KV model and two of the Q8_0 + 4-bit-KV model ran to the 512-token limit, against none for FP16."),
  table([
    ["Weights", "KV cache", "GSM8K", "MMLU", "Peak memory", "Throughput (tok/s)", "Session"],
    ["F16", "f16", "89.0%", "65.5%", "7.87 GB", "24.8–28.9", "1"],
    ["F16", "q8_0", "88.0%", "65.0%", "7.64 GB", "25.4–28.5", "1"],
    ["F16", "q4_0", "87.5%", "61.0%", "7.51 GB", "25.7–28.6", "1"],
    ["Q8_0", "f16", "90.0%", "64.5%", "4.50 GB", "37.8–46.9", "1"],
    ["Q8_0", "q8_0", "90.5%", "65.5%", "4.27 GB", "35.5–44.8", "2"],
    ["Q8_0", "q4_0", "89.5%", "62.5%", "4.14 GB", "38.2–44.9", "2"],
    ["Q4_K_M", "f16", "90.5%", "63.0%", "3.02 GB", "42.6–59.5", "1"],
    ["Q4_K_M", "q8_0", "90.0%", "62.5%", "2.79 GB", "41.7–55.6", "2"],
    ["Q4_K_M", "q4_0", "**90.0%**", "**65.0%**", "**2.66 GB**", "40.9–55.2", "2"],
  ], [1300, 1200, 1100, 1100, 1500, 1860, 1300], { centerFirst: true, size: 18 }),
  caption("Table 17: Joint weight × KV-cache quantization grid (llama.cpp, n=200 per benchmark; session 2 = separate Colab session)"),
  img("fig8_grid.png", 620, 178),
  caption("Figure 8: Joint weight × KV-cache grid — accuracy and peak memory"),

  H1("6. Status of the Work Planned at Mid-Semester"),
  table([
    ["Sl. No.", "Item", "Work done", "Status"],
    ["1", "GGUF / llama.cpp", "CUDA build for T4; FP16, Q8_0 and Q4_K_M evaluated on 200+200 questions with memory breakdown and paired tests", "COMPLETED"],
    ["2", "NVFP4 / MXFP4", "Evaluated on the T4 through llama.cpp's software-decoded FP4 types (no Blackwell needed)", "COMPLETED"],
    ["3", "AWQ (retry)", "Version conflict resolved; GQA fault in AutoAWQ's Phi-3 recipe found and fixed; fix verified on 10 questions", "Blocker RESOLVED; full evaluation: future work"],
    ["4", "KV-cache quantization (retry)", "q8_0 and q4_0 KV cache evaluated through llama.cpp (no sliding-window restriction), alone and in a full 3 × 3 grid with quantized weights", "COMPLETED"],
    ["5", "Ablation", "NF4 on attention only vs MLP only, plus NF4 re-run and memory audit", "COMPLETED"],
  ], [900, 1900, 4400, 2160], { centerFirst: true }),
  caption("Table 18: Status of the work planned at mid-semester"),

  H1("7. Discussion"),
  B("**Quantization's accuracy cost falls on factual knowledge, and it comes from the feed-forward layers.** In all five 4-bit configurations, MMLU lost more than GSM8K. The ablation traced the loss to the MLP layers: with only them quantized, MMLU fell 10.5 points; with only attention quantized, 1 point."),
  B("**Long reasoning chains are where 4-bit hurts arithmetic.** On GSM8K problems with 5 or more steps, the 4-bit variants lost 20 questions and gained 5 against FP16 (p=0.004), while short problems were unaffected. The mid-semester intuition about compounding errors holds, but only for long problems."),
  B("**Format matters at the same size.** Q4_K_M and NVFP4 files are almost the same size, yet against FP16 Q4_K_M lost 2.5 MMLU points (not significant) and NVFP4 7.0 (significant). Q4_K_M's mixed precision — some tensors kept at 6 bits — and finer scales plausibly protect the sensitive weights better; a direct comparison on more questions would be needed to confirm the gap (p=0.14 here). Among the FP4 formats, NVFP4 was ahead of MXFP4 on GSM8K (86.5% vs 83.5%), in line with its smaller blocks, but not significantly."),
  B("**The library matters as much as the bit width for speed and memory.** At the same precision, llama.cpp was 36–45% faster than Transformers at FP16, 4–5× faster at 8 bits and 3–4× faster at 4 bits. In llama.cpp fewer bits always meant both less memory and more speed; with bitsandbytes on a T4, 8 bits was the slowest option."),
  B("**Weight and KV-cache quantization combine without compounding loss.** Across the 3 × 3 grid no combination lost accuracy significantly; Q4_K_M weights with a 4-bit KV cache matched FP16 in 2.66 GB. A 4-bit cache cost 4.5 MMLU points with FP16 weights, but not with quantized weights, so that cost is small and uncertain. The KV-cache saving is modest at 4,096 tokens and decisive at long contexts, where the f16 cache would exceed the T4's memory."),
  B("**Measurements need clean processes.** NF4's apparent memory excess came from a model loaded earlier in the same session; a fresh load showed exactly the expected 2.69 GB."),
  B("**Quantization tooling can silently break newer architectures.** AutoAWQ produced a corrupted model without any error or warning because a recipe written for multi-head attention was applied to grouped-query attention. Reading a few outputs before a full run caught it."),
  P("**Practical guidance.** For this model on a T4-class GPU, llama.cpp Q4_K_M is the best choice: no significant accuracy loss, 62% less memory and twice the speed of FP16. NF4 and the FP4 formats are reasonable for reasoning-style workloads but cost 7–8 points on knowledge-heavy ones; if a 4-bit format must be used for such workloads, keeping the feed-forward layers at higher precision recovers most of the loss. Adding an 8-bit or 4-bit KV cache to Q4_K_M (2.79 or 2.66 GB in total) showed no measurable accuracy cost and is the lowest-memory configuration tested; its benefit grows with context length."),

  H1("8. Limitations"),
  B("200 questions per benchmark. Differences of 2–3 points are not detectable with confidence; paired tests (Table 9) were used to separate real effects from noise."),
  B("One model (3.8B) and one GPU (T4). The speed and memory findings in particular are not verified on other models or newer GPUs."),
  B("Runtime-2 memory includes the CUDA context (NVML), while Runtime-1 memory does not (PyTorch allocator); cross-runtime memory comparisons are approximate."),
  B("FP4 results use software-decoded kernels; their speed does not represent Blackwell hardware."),
  B("Absolute throughput on free-tier T4s varied by about 30% between Colab instances; speed comparisons are made within one run, and the ratios were reproducible."),
  B("Category groups hold only 43–69 questions; single-variant differences within a group are noisy, so conclusions rely on pooled paired tests. TTFT was measured on short benchmark prompts (89–110 tokens); four grid combinations were run in a second session, so their throughput is compared only approximately with the main run."),
  B("The corrected AWQ model was verified on 10 questions only; its full evaluation was not completed."),
  B("Phase 1 lacks per-question records, so comparisons with the Transformers FP16 baseline use unpaired tests."),

  H1("9. Future Work"),
  B("Full 200-question evaluation of the corrected AWQ model, and of GPTQ [5], to complete the comparison of calibration-based 4-bit methods."),
  B("Mixed-precision deployment based on the ablation: 4-bit attention with 8-bit feed-forward layers, measured for accuracy and memory."),
  B("Long-context evaluation of KV-cache quantization (16K–128K tokens), where it changes memory materially (Figure 4)."),
  B("Repetition on a larger model and on a Blackwell GPU to measure native NVFP4/MXFP4 speed."),
  B("Report the grouped-query attention issue to the maintainers of AutoAWQ's successor (vLLM's llm-compressor) and check whether its recipe has the same fault."),

  H1("10. Conclusion"),
  P("All five items planned at mid-semester were carried out on a single free-tier T4 with one controlled harness. Under llama.cpp, the 4-bit Q4_K_M format gives Phi-4-mini-instruct a 62% memory saving and a 2× speed-up with no significant accuracy loss, and it beats bitsandbytes NF4 on accuracy, memory and speed. The FP4 microscaling formats are as compact and fast but cost about 7 points on MMLU, with NVFP4 slightly ahead of MXFP4. Weight and KV-cache quantization combine without compounding loss: Q4_K_M weights with a 4-bit KV cache matched FP16 accuracy in 2.66 GB, 66% less memory. Across every 4-bit format, quantization hurts knowledge-heavy questions more than reasoning, and the ablation locates this loss in the feed-forward layers. The study also corrected two of its own mid-semester conclusions — NF4's memory excess was a measurement artifact, and the MMLU asymmetry needed paired tests to be established — and found a silent fault in AutoAWQ's handling of grouped-query attention, for which it provides a fix."),
];

// ---- references etc. ----
body.push(
  H1("11. References"),
  new Paragraph({ spacing: { after: 80 }, children: runs("**Papers and technical reports**", { size: 24 }) }),
  ...[
    "[1] Dettmers, T., Lewis, M., Belkada, Y., & Zettlemoyer, L. (2022). LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale. NeurIPS 2022 / arXiv:2208.07339.",
    "[2] Dettmers, T., Pagnoni, A., Holtzman, A., & Zettlemoyer, L. (2023). QLoRA: Efficient Finetuning of Quantized LLMs (introduces NF4 and double quantization). NeurIPS 2023 / arXiv:2305.14314.",
    "[3] Dettmers, T., & Zettlemoyer, L. (2023). The Case for 4-bit Precision: k-bit Inference Scaling Laws. ICML 2023 / arXiv:2212.09720.",
    "[4] Lin, J., Tang, J., Tang, H., Yang, S., Chen, W.-M., Wang, W.-C., Xiao, G., Dang, X., Gan, C., & Han, S. (2024). AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration. MLSys 2024 / arXiv:2306.00978.",
    "[5] Frantar, E., Ashkboos, S., Hoefler, T., & Alistarh, D. (2023). GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers. ICLR 2023 / arXiv:2210.17323.",
    "[6] Cobbe, K., et al. (2021). Training Verifiers to Solve Math Word Problems (introduces GSM8K). arXiv:2110.14168.",
    "[7] Hendrycks, D., et al. (2021). Measuring Massive Multitask Language Understanding (introduces MMLU). ICLR 2021 / arXiv:2009.03300.",
    "[8] Microsoft. Model card for microsoft/Phi-4-mini-instruct. huggingface.co/microsoft/Phi-4-mini-instruct.",
    "[9] Microsoft (2025). Phi-4-Mini Technical Report: Compact yet Powerful Multimodal Language Models via Mixture-of-LoRAs. arXiv:2503.01743.",
    "[10] Ainslie, J., Lee-Thorp, J., de Jong, M., Zemlyanskiy, Y., Lebrón, F., & Sanghai, S. (2023). GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints. EMNLP 2023 / arXiv:2305.13245.",
    "[11] Rouhani, B. D., et al. (2023). Microscaling Data Formats for Deep Learning. arXiv:2310.10537.",
    "[12] Open Compute Project (2023). OCP Microscaling Formats (MX) Specification, Version 1.0.",
    "[13] NVIDIA (2025). Introducing NVFP4 for Efficient and Accurate Low-Precision Inference. NVIDIA Technical Blog, developer.nvidia.com/blog.",
    "[14] Liu, Z., Yuan, J., Jin, H., Zhong, S., Xu, Z., Braverman, V., Chen, B., & Hu, X. (2024). KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache. ICML 2024 / arXiv:2402.02750.",
    "[15] Hooper, C., Kim, S., Mohammadzadeh, H., Mahoney, M. W., Shao, Y. S., Keutzer, K., & Gholami, A. (2024). KVQuant: Towards 10 Million Context Length LLM Inference with KV Cache Quantization. NeurIPS 2024 / arXiv:2401.18079.",
    "[16] Geva, M., Schuster, R., Berant, J., & Levy, O. (2021). Transformer Feed-Forward Layers Are Key-Value Memories. EMNLP 2021 / arXiv:2012.14913.",
    "[17] Meng, K., Bau, D., Andonian, A., & Belinkov, Y. (2022). Locating and Editing Factual Associations in GPT. NeurIPS 2022 / arXiv:2202.05262.",
    "[18] Dao, T. (2024). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning. ICLR 2024 / arXiv:2307.08691.",
  ].map(t => B(t)),
  new Paragraph({ spacing: { before: 120, after: 80 }, children: runs("**Software and repositories**", { size: 24 }) }),
  ...[
    "bitsandbytes — github.com/bitsandbytes-foundation/bitsandbytes — INT8 (LLM.int8()) and NF4 kernels used in Phase 1.",
    "Hugging Face Transformers — github.com/huggingface/transformers — model loading, apply_chat_template(), generation, and the QuantizedCache API (mid-semester KV-cache attempt).",
    "llama.cpp / ggml — github.com/ggml-org/llama.cpp (commit d327bf1f0780f87b8c01b367b61853b0c291d7c4) — GGUF conversion, k-quants, MXFP4/NVFP4 tensor types, KV-cache quantization, llama-server.",
    "AutoAWQ — github.com/casper-hansen/AutoAWQ (v0.2.9; deprecated, adopted by github.com/vllm-project/llm-compressor) — AWQ quantization used in Phase 2.",
    "llm-awq — github.com/mit-han-lab/llm-awq — official AWQ implementation; its pull request #67 introduced the shape check that skips value/output-projection scaling for grouped-query attention.",
    "grade-school-math — github.com/openai/grade-school-math — GSM8K dataset and scoring reference.",
    "test (MMLU) — github.com/hendrycks/test — MMLU dataset and evaluation reference.",
    "lm-evaluation-harness — github.com/EleutherAI/lm-evaluation-harness — reference harness for GSM8K/MMLU-style evaluation.",
  ].map(t => B(t, true)),

  H1("12. Abbreviations"),
  table([
    ["Abbreviation", "Full Form"],
    ["AWQ", "Activation-aware Weight Quantization"], ["bnb", "bitsandbytes (quantization library)"],
    ["CUDA", "Compute Unified Device Architecture (NVIDIA GPU programming platform)"],
    ["E2M1 / E4M3 / E8M0", "Floating-point layouts: exponent bits / mantissa bits"],
    ["FP16", "16-bit Floating Point (half precision)"], ["FP4", "4-bit Floating Point"],
    ["GGUF", "GPT-Generated Unified Format (llama.cpp model format)"], ["GPU", "Graphics Processing Unit"],
    ["GQA", "Grouped-Query Attention"], ["GSM8K", "Grade School Math 8K (math reasoning benchmark)"],
    ["INT8", "8-bit Integer precision"], ["KV cache", "Key-Value cache (used in transformer attention)"],
    ["LLM", "Large Language Model"], ["MMLU", "Massive Multitask Language Understanding (benchmark)"],
    ["MX / MXFP4", "Microscaling formats / Microscaling 4-bit Floating Point"], ["NF4", "4-bit NormalFloat (quantization data type)"],
    ["NVFP4", "NVIDIA 4-bit Floating Point microscaling format"], ["NVML", "NVIDIA Management Library (driver-level GPU monitoring)"],
    ["pp", "Percentage points"], ["Q8_0 / Q4_K_M / q4_0", "llama.cpp 8-bit, 4-bit k-quant (medium) and 4-bit block quantization types"],
    ["QLoRA", "Quantized Low-Rank Adaptation"], ["tok/s", "Tokens per second (throughput unit)"],
  ], [2800, 6560], { centerFirst: true, plainFirst: true }),

  H1("Appendix A: Reproducibility"),
  B("quant_study_main.ipynb — Phase 1 (FP16, INT8, NF4)."),
  B("kv_cache_and_awq_attempts.ipynb — mid-semester AWQ and KV-cache attempts (documented blockers)."),
  B("phase2_step1_gguf_and_kvcache.ipynb — llama.cpp build (pinned commit), GGUF conversion and quantization, KV-cache and MXFP4/NVFP4 variants, resumable evaluation."),
  B("phase2_step2_awq.ipynb — AWQ with Transformers 4.51.3 / AutoAWQ 0.2.9, including the grouped-query attention fix to the Phi-3 recipe."),
  B("phase2_tables_and_figures.ipynb — builds result tables and figures from the per-question logs."),
  B("phase2_step3_ablation.ipynb — NF4 attention-only / MLP-only / full ablation and NF4 memory audit."),
  B("phase2_step4_ttft_transformers.ipynb — time to first token for the Transformers variants; llama.cpp TTFT and the weight × KV-cache grid are in phase2_step1_gguf_and_kvcache.ipynb."),
  B("analysis/analyze_results.py and analysis/category_and_ttft.py — recompute every Phase-2 table, significance test and figure from the per-question logs."),
  B("Per-question logs (question index, gold answer, prediction, tokens, time, full output) are kept for every Phase-2 variant; paired tests use McNemar's exact test."),
);

// =====================================================================================
const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, font: HFONT, color: HCOLOR }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, font: HFONT, color: HCOLOR }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [...cover, ...abstract, ...contents] },
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Final Report — Quantization Trade-off Study", italics: true, color: "808080", size: 20, font: FONT })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], size: 20, font: FONT })] })] }) },
      children: body },
  ],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync("Final_Report_Quantization_Tradeoff.docx", b); console.log("ok"); });
