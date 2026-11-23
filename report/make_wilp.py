"""Transforms build_report.js into build_report_wilp.js following the BITS WILP report guidelines."""
import re

src = open("build_report.js").read()
lines = src.split("\n")

# ---------------- 1. helpers: page size 9"x11", double spacing ----------------
head = src[:src.index("// =====================================================================================\n// COVER")]
head = head.replace("alignment: (j === 0 && !opt.centerFirst) ? AlignmentType.LEFT : AlignmentType.CENTER,",
                    "alignment: ((j === 0 && !opt.centerFirst) || (opt.leftCols || []).includes(j)) ? AlignmentType.LEFT : AlignmentType.CENTER,")
head = head.replace("spacing: { after: 120, line: 276 }, ...o });", "spacing: { after: 0, line: 480 }, ...o });")
head = head.replace("alignment: left ? AlignmentType.LEFT : AlignmentType.JUSTIFIED, spacing: { after: 80, line: 276 } });",
                    "alignment: left ? AlignmentType.LEFT : AlignmentType.JUSTIFIED, spacing: { after: 0, line: 480 } });")
head = head.replace("""const toc = (t, key, indent = 0) => new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: "dot" }], indent: { left: indent },
  spacing: { after: 0 }, children: runs(`${t}\\t${PAGES[key] || "#"}`, { size: 18 }) });""",
"""const toc = (t, key, indent = 0, bold = false) => new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: 10080, leader: "dot" }], indent: { left: indent },
  spacing: { after: 40 }, children: runs(`${bold ? "**" + t + "**" : t}\\t${PAGES[key] || "#"}`, { size: 22 }) });
const SP = (t, o = {}) => new Paragraph({ children: runs(t, { size: 24 }), alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 60, line: 300 }, ...o });   // single-ish spacing for the abstract sheet and references
const field = (label, value) => new Paragraph({ spacing: { after: 80, line: 300 },
  children: runs(`**${label}** ${value}`, { size: 22 }) });""")
assert "line: 480" in head and "10080" in head

# ---------------- 2. pull the old body apart at H1 headings ----------------
body_start = src.index("const body = [")
body_text = src[body_start:src.index("// =====================================================================================\nconst doc = new Document")]
W5_line = 'const W5 = [2400, 1740, 1740, 1740, 1740];'

def segment(title_start, next_title_start=None):
    i = body_text.index(f'  H1("{title_start}')
    i = body_text.index("\n", i) + 1                      # drop the old H1 line itself
    j = body_text.index(f'  H1("{next_title_start}', i) if next_title_start else len(body_text)
    return body_text[i:j]

seg_setup = segment("3. Experimental Setup", "4. Results — Phase 1")
seg_p1 = segment("4. Results — Phase 1", "5. Results — Phase 2")
seg_p2 = segment("5. Results — Phase 2", "6. Status of the Work")
seg_status = segment("6. Status of the Work", "7. Discussion")
seg_disc = segment("7. Discussion", "8. Limitations")
seg_lim = segment("8. Limitations", "9. Future Work")
seg_fut = segment("9. Future Work", "10. Conclusion")
seg_conc = segment("10. Conclusion")
seg_conc = seg_conc[:seg_conc.index("];")]                 # end of body array
seg_repro = body_text[body_text.index('  H1("Appendix A: Reproducibility"),'):]
seg_repro = seg_repro[seg_repro.index("\n") + 1:seg_repro.rindex(");")]

# renumber headings
def renum_h2(seg, old, new):
    return re.sub(rf'H2\("{old}\.(\d+) ', lambda m: f'H2("{new}.{m.group(1)} ', seg)
seg_setup = renum_h2(seg_setup, 3, 2)
seg_p1 = renum_h2(seg_p1, 4, 3)
seg_p2 = renum_h2(seg_p2, 5, 4)

# move practical guidance out of discussion into recommendations
g0 = seg_disc.index('  P("**Practical guidance.**')
guidance = seg_disc[g0:seg_disc.index("\n", g0) + 1]
seg_disc = seg_disc[:g0] + seg_disc[seg_disc.index("\n", g0) + 1:]
guidance = guidance.replace('P("**Practical guidance.** ', 'P("')
status_table = seg_status.replace('caption("Table 18: Status of the work planned at mid-semester")',
                                  'caption("Table 19: Status of the work planned at mid-semester")')

# ---------------- 3. cross-references ----------------
def xref(s):
    s = s.replace("Sections 4 and 5", "Chapters 3 and 4")
    s = re.sub(r"Sections 5\.(\d+) and 5\.(\d+)", r"Sections 4.\1 and 4.\2", s)
    s = re.sub(r"Section 5\.(\d+)", r"Section 4.\1", s)
    s = re.sub(r"Section 4\.(\d+)\b(?!\.)", lambda m: m.group(0), s)   # (old 4.x refs: none in text)
    s = s.replace("(Section 9)", "(Section 6.4)").replace("the planned ablation (Section 9)", "the planned ablation (Section 6.4)")
    return s

# ---------------- 4. citations for software references ----------------
def cite(s):
    reps = [
        ("bitsandbytes INT8 (LLM.int8(), outlier threshold 6.0) [1]", "bitsandbytes [19] INT8 (LLM.int8(), outlier threshold 6.0) [1]"),
        ("loaded through Hugging Face Transformers;", "loaded through Hugging Face Transformers [20];"),
        ("llama.cpp is pinned at commit d327bf1", "llama.cpp [21] is pinned at commit d327bf1"),
        ("AWQ [4] uses AutoAWQ 0.2.9", "AWQ [4] uses AutoAWQ 0.2.9 [22]"),
        ("AutoAWQ's Llama recipe skips this step when the shapes differ;", "AutoAWQ's Llama recipe skips this step when the shapes differ, following the reference AWQ implementation [23];"),
        ("exact match on the final number) and MMLU (200 test questions, seed 42, exact match on the answer letter) [6, 7].",
         "exact match on the final number) [6, 24] and MMLU (200 test questions, seed 42, exact match on the answer letter) [7, 25]; scoring follows the conventions of standard evaluation harnesses [26]."),
    ]
    for a, b in reps:
        s = s.replace(a, b)
    return s

main = xref(seg_setup + seg_p1 + seg_p2)
main = cite(main)
seg_disc, seg_lim, seg_fut, seg_conc, guidance = map(xref, (seg_disc, seg_lim, seg_fut, seg_conc, guidance))

# ---------------- 5. new front matter ----------------
front = r'''
// ============ COVER (Guidelines, Appendix A) ============
const cover = [
  C("", { after: 1300 }),
  C("**A REPORT**", { run: { size: 28 }, after: 120 }), C("**ON**", { run: { size: 28 }, after: 400 }),
  C("**QUANTIZATION ACCURACY–SPEED–MEMORY TRADE-OFF IN SMALL LANGUAGE MODELS**", { run: { size: 30 }, after: 900 }),
  C("**BY**", { run: { size: 26 }, after: 400 }),
  new Table({ width: { size: 10080, type: WidthType.DXA }, columnWidths: [5040, 5040],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [["Name of the Student: **Arjun Puppala**"], ["ID No.: **2023tm93547**"]].map((c, k) =>
      new TableCell({ width: { size: 5040, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({ alignment: k ? AlignmentType.RIGHT : AlignmentType.LEFT, children: runs(c[0], { size: 24 }) })] })) })] }),
  C("", { after: 700 }),
  C("**AT**", { run: { size: 26 }, after: 400 }),
  C("(Insert Station Name and Centre)", { run: { size: 24 }, after: 120 }),
  C("(Insert Organization Name & Location)", { run: { size: 24 }, after: 120 }),
  C("**BIRLA INSTITUTE OF TECHNOLOGY & SCIENCE, PILANI**", { run: { size: 26 }, after: 700 }),
  C("**(October, 2026)**", { run: { size: 24 }, after: 0 }),
];

// ============ TITLE PAGE (Guidelines, Appendix B) ============
const titlePage = [
  C("", { after: 1100 }),
  C("**A REPORT**", { run: { size: 28 }, after: 120 }), C("**ON**", { run: { size: 28 }, after: 400 }),
  C("**QUANTIZATION ACCURACY–SPEED–MEMORY TRADE-OFF IN SMALL LANGUAGE MODELS**", { run: { size: 30 }, after: 800 }),
  C("**BY**", { run: { size: 26 }, after: 300 }),
  table([["Name of the Student", "ID No.", "Discipline"], ["Arjun Puppala", "2023tm93547", "(Insert Discipline)"]], [3360, 3360, 3360], { centerFirst: true, plainFirst: true, size: 22 }),
  C("", { after: 500 }),
  C("Prepared in partial fulfilment of the", { run: { size: 24 }, after: 60 }),
  C("**WILP Dissertation Course (BITS ZG628T: Dissertation)**", { run: { size: 24 }, after: 600 }),
  C("**AT**", { run: { size: 26 }, after: 400 }),
  C("(Insert Organization Name & Location)", { run: { size: 24 }, after: 120 }),
  C("**BIRLA INSTITUTE OF TECHNOLOGY & SCIENCE, PILANI**", { run: { size: 26 }, after: 700 }),
  C("**(October, 2026)**", { run: { size: 24 }, after: 0 }),
  brk(),
];

// ============ ACKNOWLEDGEMENTS (order as per Guidelines) ============
const acknowledgements = [
  C("**ACKNOWLEDGEMENTS**", { run: { size: 28 }, after: 360 }),
  P("I thank (Insert name), (Insert designation), Head of (Insert Organization Name), for permitting me to carry out this dissertation alongside my work."),
  P("I am grateful to my supervisor, Mr. Gautham A, (Insert designation), for his guidance throughout this work, and to my additional examiner, (Insert name and designation), for reviewing it."),
  P("I thank my industry mentor, Ms. Garima Dabra, Plano, Texas, for technical advice, and my faculty mentor, (Insert name), BITS Pilani WILP, for academic guidance."),
  P("I also thank the developers of the open-source tools used in this study — llama.cpp, Hugging Face Transformers, bitsandbytes and AutoAWQ — and Google Colab for the free GPU time on which every experiment was run."),
  C("", { after: 480 }),
  new Paragraph({ alignment: AlignmentType.RIGHT, children: runs("**Arjun Puppala**", { size: 24 }) }),
  new Paragraph({ alignment: AlignmentType.RIGHT, children: runs("2023tm93547", { size: 24 }) }),
  brk(),
];

// ============ ABSTRACT SHEET (Guidelines, Appendix C) ============
const abstractSheet = [
  C("**BIRLA INSTITUTE OF TECHNOLOGY AND SCIENCE, PILANI (RAJASTHAN)**", { run: { size: 24 }, after: 40 }),
  C("**WILP Division**", { run: { size: 24 }, after: 240 }),
  field("Organization:", "(Insert Organization Name)          **Location:** (Insert Location)"),
  field("Duration:", "(Insert duration)          **Date of Start:** (Insert date)"),
  field("Date of Submission:", "(Insert date)"),
  field("Title of the Project:", "Quantization Accuracy–Speed–Memory Trade-off in Small Language Models"),
  field("ID No. / Name of the student:", "2023tm93547 / Arjun Puppala"),
  field("Name(s) and Designation(s) of Supervisor and Additional Examiner:", "Gautham A, (Insert designation) (Supervisor); (Insert name, designation) (Additional Examiner)"),
  field("Name of the Faculty mentor:", "(Insert name)"),
  field("Key Words:", "large language models; post-training quantization; NF4; GGUF; Q4_K_M; MXFP4; NVFP4; AWQ; KV-cache quantization; inference efficiency; Phi-4-mini"),
  field("Project Areas:", "Machine Learning — Model Compression; Efficient Large Language Model Inference"),
  new Paragraph({ spacing: { before: 120, after: 60 }, children: runs("**Abstract:**", { size: 22 }) }),
  SP("This project measures what 8-bit and 4-bit quantization costs a small instruct language model, microsoft/Phi-4-mini-instruct (3.8B parameters), in accuracy, memory and speed on one free Google Colab T4 GPU. Sixteen configurations across Hugging Face Transformers and llama.cpp — FP16, INT8, NF4, Q8_0, Q4_K_M, MXFP4, NVFP4 and quantized KV caches — were scored on the same 200 GSM8K and 200 MMLU questions, with paired significance tests; AWQ was repaired and checked on a small sample. Under llama.cpp, Q4_K_M cut memory by 62% and doubled speed with no significant accuracy loss; adding a 4-bit KV cache cut memory by 66% with none either. NF4, MXFP4 and NVFP4 lost 7–8 MMLU points. In every 4-bit format, factual-knowledge questions suffered more than arithmetic, and an ablation traced this to the feed-forward layers. Arithmetic errors concentrated in long problems. The study also showed that an apparent NF4 memory penalty was a measurement artifact, and it found and fixed a fault in AutoAWQ that silently corrupts grouped-query-attention models. The results give a measured basis for choosing a quantization setup."),
  C("", { after: 300 }),
  sigTable,
  brk(),
];
'''
# signature table: keep, but adapt labels to the specimen (Signature + Date)
sig = src[src.index("const sigTable"):src.index("const abstract = [")]
sig = sig.replace('["Signature of the Student", "", "", "Name: Arjun Puppala", "Date:", "Place: Dallas"]',
                  '["Signature of Student", "", "", "Date:"]').replace('["Signature of the Supervisor", "", "", "Name: Gautham A", "Date:", "Place:"]',
                  '["Signature of your Supervisor", "", "", "Date:"]').replace("4680", "5040").replace("9360", "10080")

# ---------------- 6. contents ----------------
contents = r'''
const contents = [
  C("**TABLE OF CONTENTS**", { run: { size: 28 }, after: 240 }),
  toc("Acknowledgements", "ack"), toc("Abstract Sheet", "abs"), toc("List of Figures", "lof"), toc("List of Tables", "lot"),
  toc("1. Introduction", "c1", 0, true),
  toc("1.1 Background", "c11", 400), toc("1.2 Problem Statement", "c12", 400), toc("1.3 Objectives", "c13", 400),
  toc("1.4 Scope and Limitations", "c14", 400), toc("1.5 Methodology Overview", "c15", 400), toc("1.6 Organization of the Report", "c16", 400),
  toc("2. Experimental Setup", "c2", 0, true),
  toc("2.1 Controls common to every variant", "c21", 400), toc("2.2 Runtime 1 — Transformers + bitsandbytes", "c22", 400),
  toc("2.3 Runtime 2 — llama.cpp", "c23", 400), toc("2.4 AWQ", "c24", 400), toc("2.5 Engineering for free-tier constraints", "c25", 400),
  toc("3. Results — Phase 1: Transformers + bitsandbytes", "c3", 0, true),
  toc("3.1 Accuracy", "c31", 400), toc("3.2 Memory", "c32", 400), toc("3.3 Speed", "c33", 400),
  toc("4. Results — Phase 2", "c4", 0, true),
  ...[["4.1", "llama.cpp FP16 baseline"], ["4.2", "GGUF k-quants (Q8_0, Q4_K_M)"], ["4.3", "KV-cache quantization"], ["4.4", "MXFP4 and NVFP4"],
      ["4.5", "Same bit width, different library"], ["4.6", "Paired significance tests"], ["4.7", "AWQ"], ["4.8", "Ablation: where the MMLU loss comes from"],
      ["4.9", "NF4 memory audit"], ["4.10", "Per-category error analysis"], ["4.11", "Time to first token"], ["4.12", "Joint weight and KV-cache quantization"]]
    .map(([n, t]) => toc(`${n} ${t}`, "c" + n.replace(".", ""), 400)),
  toc("5. Discussion", "c5", 0, true),
  toc("6. Conclusions and Recommendations", "c6", 0, true),
  toc("6.1 Conclusions", "c61", 400), toc("6.2 Recommendations", "c62", 400), toc("6.3 Limitations", "c63", 400), toc("6.4 Future Work", "c64", 400),
  toc("References", "refs", 0, true),
  toc("Glossary", "glos", 0, true),
  brk(),
  C("**LIST OF FIGURES**", { run: { size: 28 }, after: 240 }),
  ...[["1", "Accuracy, peak memory and throughput across FP16 / INT8 / NF4"], ["2", "Measured GPU memory by component, llama.cpp FP16"],
      ["3", "Accuracy, memory and throughput of all llama.cpp variants"], ["4", "Phi-4-mini KV-cache size vs context length"],
      ["5", "Ablation — attention-only vs MLP-only NF4"], ["6", "MMLU accuracy change by subject area"],
      ["7", "GSM8K accuracy by problem length"], ["8", "Joint weight × KV-cache grid"]].map(([n, t]) => toc(`Figure ${n}: ${t}`, `f${n}`)),
  C("", { after: 360 }),
  C("**LIST OF TABLES**", { run: { size: 28 }, after: 240 }),
  ...[["1", "Accuracy, memory and throughput by precision (bitsandbytes)"], ["2", "Statistical check of the Phase-1 differences"],
      ["3", "Transformers FP16 vs llama.cpp FP16"], ["4", "GGUF k-quants under llama.cpp"], ["5", "KV-cache quantization"],
      ["6", "MXFP4 and NVFP4 results"], ["7", "MXFP4 and NVFP4 formats compared"], ["8", "Same bit width, different library"],
      ["9", "Paired significance tests"], ["10", "AWQ attempts"], ["11", "Ablation results"], ["12", "NF4 memory audit"],
      ["13", "MMLU accuracy by subject area"], ["14", "GSM8K accuracy by problem length"], ["15", "Time to first token (llama.cpp)"],
      ["16", "Time to first token (Transformers)"], ["17", "Joint weight × KV-cache grid"]].map(([n, t]) => toc(`Table ${n}: ${t}`, `t${n}`)),
];
'''

# ---------------- 7. introduction ----------------
intro = r'''
  H1("1. Introduction"),
  H2("1.1 Background"),
  P("Quantization stores a language model's weights, and sometimes its attention key-value (KV) cache, in 8 or 4 bits instead of the native 16. It is the main technique that lets a model fit on a small GPU and run faster, and it is also the technique that most directly risks accuracy. The 4-bit landscape has become crowded: integer methods such as bitsandbytes NF4 [2], AWQ [4], GPTQ [5] and the llama.cpp GGUF k-quants sit alongside hardware-oriented floating-point formats such as MXFP4 [11, 12] and NVFP4 [13], while KV-cache quantization [14, 15] offers a separate memory lever. Earlier work established that 8-bit inference can preserve accuracy [1] and that 4-bit precision is often the best trade-off for a fixed memory budget [3]."),
  H2("1.2 Problem Statement"),
  P("Published results for these methods are reported on different models, GPUs and evaluation harnesses, so they are hard to compare, and the accuracy cost of quantization is often assumed rather than measured. Whether the cost is the same for every kind of task, and whether fewer bits really mean less memory and more speed on affordable hardware, is rarely tested directly. This project measures these trade-offs for one current small instruct model, microsoft/Phi-4-mini-instruct [8, 9], on a single free-tier Google Colab T4 GPU, using one fixed evaluation harness for every variant."),
  P("Following the project abstract, the study addresses three research questions; their answers are summarized in the conclusions (Section 6.1):"),
  B("**RQ1 — How much accuracy does a current small model actually lose at 4-bit?** Measured against FP16 and 8-bit for several 4-bit formats on the same model and GPU."),
  B("**RQ2 — On what kinds of questions does the loss concentrate?** Compared between a reasoning-heavy benchmark (GSM8K) and a knowledge-heavy one (MMLU), and within each by subject area and problem length."),
  B("**RQ3 — What is the accuracy–speed–memory trade-off across precisions?** Accuracy, peak GPU memory, throughput and time to first token measured together for every precision, for one small model on a single GPU."),
  H2("1.3 Objectives"),
  P("The objectives, set in the project outline and extended at mid-semester, and their status at the end of the project are:"),
''' + "\n".join(
    l for l in segment("2. Recap: Objectives and Status", "3. Experimental Setup").split("\n") if l.strip()
).replace("(Sections 4 and 5)", "(Chapters 3 and 4)").replace("Section 5.", "Section 4.") + r'''
  H2("1.4 Scope and Limitations"),
  P("The study covers one model (3.8B parameters), one GPU (T4) and two benchmarks: GSM8K for multi-step arithmetic reasoning [6] and MMLU for factual knowledge across 57 subjects [7], with 200 questions each. All variants are post-training methods; fine-tuning is out of scope. NVFP4 and MXFP4 are evaluated through software decoding, because the T4 has no native FP4 arithmetic, so their speed results are T4-specific. The limitations of the results are discussed in Section 6.3."),
  H2("1.5 Methodology Overview"),
  P("The work was carried out in two phases. Phase 1 (reported at mid-semester) compared FP16, INT8 and NF4 under Hugging Face Transformers. Phase 2 built a second pipeline on llama.cpp and evaluated GGUF k-quants, FP4 formats, KV-cache quantization and their combinations; it also retried AWQ, ran an ablation that quantizes only part of each layer, and audited NF4's memory. Every variant answered the same questions with the same prompts, chat template, greedy decoding and scoring. Accuracy, peak GPU memory, throughput and time to first token were recorded, and every Phase-2 answer was logged so that variants could be compared question by question with paired (McNemar) tests. The data are the public GSM8K and MMLU test sets; all measurements come from the logged runs."),
  H2("1.6 Organization of the Report"),
  P("Chapter 2 describes the experimental setup. Chapter 3 presents the Phase-1 results and Chapter 4 the Phase-2 results. Chapter 5 discusses the findings, and Chapter 6 gives the conclusions, recommendations, limitations and future work, followed by the references and a glossary of technical terms."),
'''

conclusions = r'''
  H1("6. Conclusions and Recommendations"),
  H2("6.1 Conclusions"),
''' + seg_conc.rstrip() + r'''
  H2("6.2 Recommendations"),
''' + guidance.rstrip() + r'''
  H2("6.3 Limitations"),
''' + seg_lim.rstrip() + r'''
  H2("6.4 Future Work"),
''' + seg_fut.rstrip() + r'''
'''

appendices = r'''
  H1("Appendix A: Status of the Work Planned at Mid-Semester"),
''' + status_table.rstrip() + r'''
  H1("Appendix B: Reproducibility"),
''' + seg_repro.rstrip() + "\n"

# ---------------- 8. references in the guideline style ----------------
refs = [
 'Dettmers, T., Lewis, M., Belkada, Y. and Zettlemoyer, L., "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale," Advances in Neural Information Processing Systems (NeurIPS), Vol. 35, 2022. arXiv:2208.07339.',
 'Dettmers, T., Pagnoni, A., Holtzman, A. and Zettlemoyer, L., "QLoRA: Efficient Finetuning of Quantized LLMs," Advances in Neural Information Processing Systems (NeurIPS), Vol. 36, 2023. arXiv:2305.14314.',
 'Dettmers, T. and Zettlemoyer, L., "The Case for 4-bit Precision: k-bit Inference Scaling Laws," Proceedings of the 40th International Conference on Machine Learning (ICML), 2023. arXiv:2212.09720.',
 'Lin, J., Tang, J., Tang, H., Yang, S., Chen, W.-M., Wang, W.-C., Xiao, G., Dang, X., Gan, C. and Han, S., "AWQ: Activation-aware Weight Quantization for On-Device LLM Compression and Acceleration," Proceedings of Machine Learning and Systems (MLSys), Vol. 6, 2024. arXiv:2306.00978.',
 'Frantar, E., Ashkboos, S., Hoefler, T. and Alistarh, D., "GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers," International Conference on Learning Representations (ICLR), 2023. arXiv:2210.17323.',
 'Cobbe, K. et al, "Training Verifiers to Solve Math Word Problems," arXiv preprint arXiv:2110.14168, 2021.',
 'Hendrycks, D. et al, "Measuring Massive Multitask Language Understanding," International Conference on Learning Representations (ICLR), 2021. arXiv:2009.03300.',
 'Microsoft, "Phi-4-mini-instruct Model Card," Hugging Face, https://huggingface.co/microsoft/Phi-4-mini-instruct (accessed October 2026).',
 'Microsoft, "Phi-4-Mini Technical Report: Compact yet Powerful Multimodal Language Models via Mixture-of-LoRAs," arXiv preprint arXiv:2503.01743, 2025.',
 'Ainslie, J., Lee-Thorp, J., de Jong, M., Zemlyanskiy, Y., Lebrón, F. and Sanghai, S., "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints," Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing (EMNLP), 2023. arXiv:2305.13245.',
 'Rouhani, B. D. et al, "Microscaling Data Formats for Deep Learning," arXiv preprint arXiv:2310.10537, 2023.',
 'Open Compute Project, "OCP Microscaling Formats (MX) Specification," Version 1.0, 2023.',
 'NVIDIA, "Introducing NVFP4 for Efficient and Accurate Low-Precision Inference," NVIDIA Technical Blog, https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/, 2025.',
 'Liu, Z., Yuan, J., Jin, H., Zhong, S., Xu, Z., Braverman, V., Chen, B. and Hu, X., "KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache," Proceedings of the 41st International Conference on Machine Learning (ICML), 2024. arXiv:2402.02750.',
 'Hooper, C., Kim, S., Mohammadzadeh, H., Mahoney, M. W., Shao, Y. S., Keutzer, K. and Gholami, A., "KVQuant: Towards 10 Million Context Length LLM Inference with KV Cache Quantization," Advances in Neural Information Processing Systems (NeurIPS), Vol. 37, 2024. arXiv:2401.18079.',
 'Geva, M., Schuster, R., Berant, J. and Levy, O., "Transformer Feed-Forward Layers Are Key-Value Memories," Proceedings of the 2021 Conference on Empirical Methods in Natural Language Processing (EMNLP), 2021, pp. 5484-5495.',
 'Meng, K., Bau, D., Andonian, A. and Belinkov, Y., "Locating and Editing Factual Associations in GPT," Advances in Neural Information Processing Systems (NeurIPS), Vol. 35, 2022. arXiv:2202.05262.',
 'Dao, T., "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning," International Conference on Learning Representations (ICLR), 2024. arXiv:2307.08691.',
 'bitsandbytes contributors, "bitsandbytes," https://github.com/bitsandbytes-foundation/bitsandbytes (accessed October 2026).',
 'Hugging Face, "Transformers," https://github.com/huggingface/transformers (accessed October 2026).',
 'ggml-org, "llama.cpp," https://github.com/ggml-org/llama.cpp, commit d327bf1f0780f87b8c01b367b61853b0c291d7c4 (accessed October 2026).',
 'Hansen, C. et al, "AutoAWQ," Version 0.2.9, https://github.com/casper-hansen/AutoAWQ (accessed October 2026).',
 'MIT HAN Lab, "llm-awq: Activation-aware Weight Quantization," https://github.com/mit-han-lab/llm-awq (accessed October 2026).',
 'OpenAI, "grade-school-math (GSM8K dataset)," https://github.com/openai/grade-school-math (accessed October 2026).',
 'Hendrycks, D., "test (MMLU dataset)," https://github.com/hendrycks/test (accessed October 2026).',
 'EleutherAI, "lm-evaluation-harness," https://github.com/EleutherAI/lm-evaluation-harness (accessed October 2026).',
]
refs_js = '  H1("References"),\n' + "".join(
    f'  new Paragraph({{ spacing: {{ after: 100, line: 300 }}, indent: {{ left: 540, hanging: 540 }}, alignment: AlignmentType.LEFT, children: runs({repr(f"{i}. " + r)}, {{ size: 22 }}) }}),\n'
    for i, r in enumerate(refs, 1))
refs_js = refs_js.replace("\\'", "'")

# ---------------- 9. glossary (page numbers filled from glossary_pages.json) ----------------
gloss = [
 ("Ablation", "Experiment that changes one part of a system at a time to see which part causes an effect"),
 ("AWQ", "Activation-aware Weight Quantization: 4-bit method that protects important weight channels using calibration data"),
 ("bitsandbytes (bnb)", "Library providing INT8 (LLM.int8()) and NF4 quantization for Transformers"),
 ("Calibration", "Running sample text through a model to choose quantization scales"),
 ("CUDA", "NVIDIA's GPU programming platform"),
 ("E2M1 / E4M3 / E8M0", "Floating-point layouts named by their exponent and mantissa bits"),
 ("Feed-forward (MLP) layer", "The two-layer network inside each transformer block; holds about three quarters of the linear weights"),
 ("FP16", "16-bit floating point (half precision); the baseline precision"),
 ("GGUF", "File format used by llama.cpp for models and their quantized weights"),
 ("GPU", "Graphics Processing Unit"),
 ("Grouped-query attention (GQA)", "Attention design in which several query heads share one key/value head"),
 ("GSM8K", "Grade School Math 8K: benchmark of multi-step arithmetic word problems"),
 ("INT8", "8-bit integer precision"),
 ("KV cache", "Stored attention keys and values of previous tokens, reused during generation"),
 ("llama.cpp", "C/C++ inference engine for quantized GGUF models"),
 ("McNemar's test", "Paired significance test that compares two variants on the questions where they disagree"),
 ("MMLU", "Massive Multitask Language Understanding: multiple-choice knowledge benchmark over 57 subjects"),
 ("MXFP4", "OCP Microscaling 4-bit floating-point format with 32-value blocks"),
 ("NF4", "4-bit NormalFloat data type used by bitsandbytes"),
 ("NVFP4", "NVIDIA 4-bit floating-point format with 16-value blocks and FP8 scales"),
 ("NVML", "NVIDIA Management Library, used to read GPU memory use"),
 ("pp", "Percentage points"),
 ("Q4_K_M / Q8_0", "llama.cpp 4-bit k-quant (medium) and 8-bit block quantization types"),
 ("q4_0 / q8_0 (KV cache)", "llama.cpp 4-bit and 8-bit block formats used for the KV cache"),
 ("Quantization", "Storing numbers with fewer bits to save memory and computation"),
 ("Throughput", "Generated tokens per second, including prompt processing"),
 ("TTFT", "Time to first token: delay before the first token of an answer is produced"),
]
gloss_js = '''  H1("Glossary"),
  table([["Term", "Meaning", "Page(s)"],
''' + "".join(f'    [{repr(t)}, {repr(m)}, (GLOSS[{repr(t)}] || "#")],\n' for t, m in gloss) + '''  ], [2600, 6080, 1400], { centerFirst: false, plainFirst: false, size: 19, leftCols: [1] }),
'''

# ---------------- 10. assemble ----------------
doc_part = r'''
const PAGE = { size: { width: 12960, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } };  // 9" x 11", 1" margins
const hdr = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
  children: [new TextRun({ text: "Quantization Accuracy–Speed–Memory Trade-off in Small Language Models", italics: true, color: "808080", size: 18, font: FONT })] })] });
const ftr = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20, font: FONT })] })] });
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
    { properties: { page: PAGE }, children: cover },                                         // cover: no page number
    { properties: { page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
      footers: { default: ftr }, children: [...titlePage, ...acknowledgements, ...abstractSheet, ...contents] },
    { properties: { page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: hdr }, footers: { default: ftr }, children: body },
  ],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync("Final_Report_WILP.docx", b); console.log("ok"); });
'''

body_js = ("\n" + W5_line + "\nconst body = [\n" + intro +
           '  H1("2. Experimental Setup"),\n' + xref(cite(seg_setup)) +
           '  H1("3. Results — Phase 1: Transformers + bitsandbytes"),\n' + xref(seg_p1) +
           '  H1("4. Results — Phase 2: llama.cpp, KV Cache, FP4, AWQ and Ablation"),\n' + xref(cite(seg_p2)) +
           '  H1("5. Discussion"),\n' + seg_disc + conclusions + refs_js + gloss_js + "];\n")
out = (head.replace("LevelFormat, TabStopType, TabStopPosition, VerticalAlign,", "LevelFormat, TabStopType, TabStopPosition, VerticalAlign, NumberFormat,")
          .replace('const PAGES = JSON.parse(fs.existsSync("pages.json") ? fs.readFileSync("pages.json", "utf8") : "{}");',
                   'const PAGES = JSON.parse(fs.existsSync("wilp_pages.json") ? fs.readFileSync("wilp_pages.json", "utf8") : "{}");\n'
                   'const GLOSS = JSON.parse(fs.existsSync("glossary_pages.json") ? fs.readFileSync("glossary_pages.json", "utf8") : "{}");')
       + sig + front + contents + body_js + doc_part)
cited = set(int(n) for grp in re.findall(r"\[([0-9, ]+)\]", body_js) for n in grp.split(",") if n.strip())
missing = [n for n in range(1, 27) if n not in cited]
print("references never cited in text:", missing)
open("build_report_wilp.js", "w").write(out)
print("written", len(out))
