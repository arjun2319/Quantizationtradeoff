"""Reads the rendered PDF and writes wilp_pages.json (contents) and glossary_pages.json (glossary)."""
import json, re, subprocess

txt = subprocess.run(["pdftotext", "-layout", "Final_Report_WILP.pdf", "-"], capture_output=True, text=True).stdout
pages = txt.split("\f")
intro = next(i for i, p in enumerate(pages) if re.search(r"^\s*1\. INTRODUCTION\s*$", p, re.M))
roman = lambda n: ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"][n - 1]
def label(i):            # pdf page index -> printed page number
    return str(i - intro + 1) if i >= intro else roman(i)      # cover is index 0 (unnumbered), title page = i
def find(pat, start, end=None, flags=re.M):
    for i in range(start, end or len(pages)):
        if re.search(pat, pages[i], flags): return label(i)
    return None

res = {
    "ack": find(r"^\s*ACKNOWLEDGEMENTS\s*$", 1, intro), "abs": find(r"Title of the Project:", 1, intro),
    "lof": find(r"^\s*LIST OF FIGURES\s*$", 1, intro), "lot": find(r"^\s*LIST OF TABLES\s*$", 1, intro),
}
heads = {"c1": r"^\s*1\. INTRODUCTION", "c2": r"^\s*2\. EXPERIMENTAL SETUP", "c3": r"^\s*3\. RESULTS — PHASE 1",
         "c4": r"^\s*4\. RESULTS — PHASE 2", "c5": r"^\s*5\. DISCUSSION", "c6": r"^\s*6\. CONCLUSIONS AND RECOMMENDATIONS",
         "refs": r"^\s*REFERENCES\s*$", "glos": r"^\s*GLOSSARY\s*$"}
subs = {"c11": "1.1 Background", "c12": "1.2 Problem Statement", "c13": "1.3 Objectives", "c14": "1.4 Scope and Limitations",
        "c15": "1.5 Methodology Overview", "c16": "1.6 Organization of the Report", "c21": "2.1 Controls", "c22": "2.2 Runtime 1",
        "c23": "2.3 Runtime 2", "c24": "2.4 AWQ", "c25": "2.5 Engineering", "c31": "3.1 Accuracy", "c32": "3.2 Memory", "c33": "3.3 Speed",
        "c41": "4.1 llama.cpp FP16", "c42": "4.2 GGUF k-quants", "c43": "4.3 KV-cache quantization", "c44": "4.4 MXFP4 and NVFP4",
        "c45": "4.5 Same bit width", "c46": "4.6 Paired significance", "c47": "4.7 AWQ", "c48": "4.8 Ablation", "c49": "4.9 NF4 memory audit",
        "c410": "4.10 Per-category", "c411": "4.11 Time to first token", "c412": "4.12 Joint weight", "c61": "6.1 Conclusions",
        "c62": "6.2 Recommendations", "c63": "6.3 Limitations", "c64": "6.4 Future Work"}
for k, p in heads.items(): res[k] = find(p, intro)
for k, t in subs.items(): res[k] = find(r"^\s*" + re.escape(t), intro)
for n in range(1, 9): res[f"f{n}"] = find(rf"Figure {n}:", intro)
for n in range(1, 18): res[f"t{n}"] = find(rf"Table {n}:", intro)
json.dump(res, open("wilp_pages.json", "w"), indent=1)

# ---- glossary: pages (from the Introduction to the end of Chapter 6) where each term is used ----
end = next(i for i, p in enumerate(pages) if re.search(heads["refs"], p, re.M) and i >= intro)
G = {"Ablation": r"\bablation\b", "AWQ": r"\bAWQ\b", "bitsandbytes (bnb)": r"\bbitsandbytes\b", "Calibration": r"\bcalibrat",
     "CUDA": r"\bCUDA\b", "E2M1 / E4M3 / E8M0": r"\bE[248]M[013]\b", "Feed-forward (MLP) layer": r"feed-forward|\bMLP\b",
     "FP16": r"\bFP16\b", "GGUF": r"\bGGUF\b", "GPU": r"\bGPUs?\b", "Grouped-query attention (GQA)": r"grouped-query",
     "GSM8K": r"\bGSM8K\b", "INT8": r"\bINT8\b", "KV cache": r"\bKV[ -]cache", "llama.cpp": r"llama\.cpp", "McNemar's test": r"McNemar",
     "MMLU": r"\bMMLU\b", "MXFP4": r"\bMXFP4\b", "NF4": r"\bNF4\b", "NVFP4": r"\bNVFP4\b", "NVML": r"\bNVML\b",
     "pp": r"\d pp\b", "Q4_K_M / Q8_0": r"Q4_K_M|Q8_0", "q4_0 / q8_0 (KV cache)": r"\bq[48]_0\b", "Quantization": r"\bquantiz",
     "Throughput": r"\bthroughput\b", "TTFT": r"\bTTFT\b"}
gp = {}
for term, pat in G.items():
    hits = [label(i) for i in range(intro, end) if re.search(pat, pages[i], re.I if term in ("Ablation", "Calibration", "Quantization", "Throughput", "Feed-forward (MLP) layer", "Grouped-query attention (GQA)", "KV cache") else 0)]
    gp[term] = ", ".join(hits[:4]) + (" ..." if len(hits) > 4 else "") if hits else "—"
json.dump(gp, open("glossary_pages.json", "w"), indent=1)
print("intro at pdf page", intro + 1, "| missing:", [k for k, v in res.items() if v is None], "| total pages", len(pages) - 1)
