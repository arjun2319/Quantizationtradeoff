"""Reproduces the Phase-2 numbers, significance tests and figures in the final report.

Usage (from the repository root):
    python analysis/analyze_results.py
Reads results/phase2/runs/*.jsonl and *__meta.json; writes results/phase2/summary.csv,
results/phase2/mcnemar_tests.csv and figures/*.png. Needs: pandas, matplotlib, numpy.
"""
import glob, json, math, os, re
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = os.path.join(ROOT, "results", "phase2", "runs")
OUT = os.path.join(ROOT, "results", "phase2")
FIG = os.path.join(ROOT, "figures")
os.makedirs(FIG, exist_ok=True)

PHASE1 = {  # Mid-semester results (results/phase1/results.csv)
    ("fp16", "gsm8k"): (86.5, 19.9, 7.28), ("fp16", "mmlu"): (65.5, 18.2, 7.34),
    ("bnb_8bit", "gsm8k"): (90.0, 8.9, 4.28), ("bnb_8bit", "mmlu"): (65.0, 8.8, 4.36),
    ("bnb_nf4", "gsm8k"): (85.0, 15.2, 5.48), ("bnb_nf4", "mmlu"): (58.0, 13.6, 5.48),
}


def load(variant, task):
    with open(os.path.join(RUNS, f"{variant}__{task}.jsonl")) as f:
        return {r["idx"]: r for r in (json.loads(l) for l in f if l.strip())}


def meta(variant):
    p = os.path.join(RUNS, f"{variant}__meta.json")
    return json.load(open(p)) if os.path.exists(p) else {}


def mcnemar(base, other, task):
    """Exact two-sided McNemar test. lost = base right & other wrong; gained = the reverse."""
    A, B = load(base, task), load(other, task)
    idx = sorted(set(A) & set(B))
    lost = sum(A[i]["correct"] and not B[i]["correct"] for i in idx)
    gained = sum(B[i]["correct"] and not A[i]["correct"] for i in idx)
    n, k = lost + gained, min(lost, gained)
    p = min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n) if n else 1.0
    acc = lambda R: 100 * sum(R[i]["correct"] for i in idx) / len(idx)
    return acc(A), acc(B), lost, gained, p


# ---------------- 1. summary table ----------------
rows = []
for (v, t), (acc, tps, mem) in PHASE1.items():
    rows.append(dict(variant=v, task=t, accuracy_pct=acc, tokens_per_sec=tps, peak_mem_gb=mem,
                     n_questions=200, runtime="transformers+bnb (Phase 1)"))
for path in sorted(glob.glob(os.path.join(RUNS, "*.jsonl"))):
    v, t = re.match(r"(.+)__(gsm8k|mmlu)\.jsonl$", os.path.basename(path)).groups()
    R = list(load(v, t).values()); m = meta(v)
    dec = [r["decode_tok_s"] for r in R if r.get("decode_tok_s")]
    rows.append(dict(variant=v, task=t,
                     accuracy_pct=round(100 * sum(r["correct"] for r in R) / len(R), 1),
                     tokens_per_sec=round(sum(r["n_tokens"] for r in R) / sum(r["wall_s"] for r in R), 1),
                     decode_tok_s=round(sum(dec) / len(dec), 1) if dec else None,
                     peak_mem_gb=m.get("peak_mem_gb"), weights_gb=m.get("model_buf_gb"), kv_cache_gb=m.get("kv_buf_gb"),
                     n_questions=len(R), runtime=m.get("runtime", "llama.cpp")))
summary = pd.DataFrame(rows)
summary.to_csv(os.path.join(OUT, "summary.csv"), index=False)
print(summary.to_string(index=False))

# ---------------- 2. paired significance tests ----------------
PAIRS = [("gguf_f16", v) for v in ["gguf_q8_0", "gguf_q4_k_m", "gguf_nvfp4", "gguf_mxfp4", "gguf_f16_kv8", "gguf_f16_kv4",
                                   "gguf_q8_0_kv8", "gguf_q8_0_kv4", "gguf_q4_k_m_kv8", "gguf_q4_k_m_kv4"]] + \
        [("gguf_q8_0", "gguf_q8_0_kv4"), ("gguf_q4_k_m", "gguf_q4_k_m_kv4")] + \
        [("gguf_q4_k_m", "gguf_nvfp4"), ("gguf_mxfp4", "gguf_nvfp4"),
         ("nf4_attn_only", "nf4_mlp_only"), ("nf4_full", "nf4_mlp_only"), ("nf4_full", "nf4_attn_only")]
tests = []
for a, b in PAIRS:
    for t in ("gsm8k", "mmlu"):
        acc_a, acc_b, lost, gained, p = mcnemar(a, b, t)
        tests.append(dict(baseline=a, variant=b, task=t, baseline_acc=acc_a, variant_acc=acc_b,
                          delta_pp=round(acc_b - acc_a, 1), lost=lost, gained=gained, p_value=round(p, 5)))
tests = pd.DataFrame(tests)
tests.to_csv(os.path.join(OUT, "mcnemar_tests.csv"), index=False)
print("\n", tests.to_string(index=False))

# ---------------- 3. NF4 memory audit check ----------------
emb = 200064 * 3072
attn = 32 * (3072 * 5120 + 3072 * 3072)
mlp = 32 * (3072 * 16384 + 8192 * 3072)
G = 1024 ** 3
expected = {"nf4_full": (attn + mlp) * 0.5 / G + (attn + mlp) / 64 / G + emb * 2 / G,
            "nf4_mlp_only": attn * 2 / G + mlp * 0.5 / G + mlp / 64 / G + emb * 2 / G,
            "nf4_attn_only": mlp * 2 / G + attn * 0.5 / G + attn / 64 / G + emb * 2 / G}
print("\nNF4 memory: measured after load vs expected from bit widths")
audit_p = os.path.join(RUNS, "nf4_memory_audit.json")
if os.path.exists(audit_p):
    print("  fresh load (audit):", json.load(open(audit_p)))
for v, e in expected.items():
    m = meta(v).get("allocated_after_load_gb")
    if m: print(f"  {v:14s} measured {m:.2f} GB  expected {e:.2f} GB  excess {m - e:+.2f} GB")

# ---------------- 4. figures (same style as Figure 1) ----------------
def stat(v, t):
    r = summary[(summary.variant == v) & (summary.task == t)].iloc[0]
    return r.accuracy_pct, r.tokens_per_sec, r.peak_mem_gb

V = ["gguf_f16", "gguf_q8_0", "gguf_q4_k_m", "gguf_nvfp4", "gguf_mxfp4", "gguf_f16_kv8", "gguf_f16_kv4"]
LAB = ["F16", "Q8_0", "Q4_K_M", "NVFP4", "MXFP4", "F16+KV q8", "F16+KV q4"]
fig, axes = plt.subplots(1, 3, figsize=(16, 5))
for t, mk, c in [("gsm8k", "o", "#2563eb"), ("mmlu", "s", "#dc2626")]:
    acc, tps, mem = zip(*[stat(v, t) for v in V])
    for ax, y in zip(axes, [acc, mem, tps]):
        ax.plot(LAB, y, marker=mk, label=t, color=c, linewidth=2, markersize=8)
for ax, title, yl in zip(axes, ["Accuracy (%) by Variant", "Peak GPU Memory (GB) by Variant", "Throughput (tokens/sec) by Variant"],
                         ["Accuracy %", "GB", "tokens/sec"]):
    ax.set_title(title, fontweight="bold"); ax.set_ylabel(yl); ax.tick_params(axis="x", rotation=25); ax.legend(); ax.grid(alpha=.3)
plt.suptitle("Phi-4-mini-instruct under llama.cpp: Quantization Accuracy-Speed-Memory Tradeoff (T4 GPU)", fontweight="bold")
plt.tight_layout(); plt.savefig(os.path.join(FIG, "fig3_llamacpp_variants.png"), dpi=150); plt.close()

names = ["FP16\n(Phase 1)", "NF4 attention-only\n(MLP in FP16)", "NF4 MLP-only\n(attention in FP16)", "NF4 full\n(re-run)"]
g = [86.5] + [stat(v, "gsm8k")[0] for v in ["nf4_attn_only", "nf4_mlp_only", "nf4_full"]]
mm = [65.5] + [stat(v, "mmlu")[0] for v in ["nf4_attn_only", "nf4_mlp_only", "nf4_full"]]
x = np.arange(4); w = .36
fig, ax = plt.subplots(figsize=(9, 4.2))
for off, vals, col, lab in [(-w / 2, g, "#2563eb", "gsm8k"), (w / 2, mm, "#dc2626", "mmlu")]:
    bars = ax.bar(x + off, vals, w, color=col, label=lab)
    for b in bars: ax.text(b.get_x() + b.get_width() / 2, b.get_height() + .6, f"{b.get_height():.1f}", ha="center", fontsize=9)
ax.set_xticks(x); ax.set_xticklabels(names, fontsize=9); ax.set_ylim(40, 100); ax.set_ylabel("Accuracy %")
ax.grid(alpha=.3, axis="y"); ax.legend(loc="upper right")
ax.set_title("Ablation: which half of the network causes NF4's MMLU loss?", fontweight="bold")
plt.tight_layout(); plt.savefig(os.path.join(FIG, "fig5_ablation.png"), dpi=150); plt.close()
print("\nwrote", os.path.join(OUT, "summary.csv"), os.path.join(OUT, "mcnemar_tests.csv"), "and figures/")
