import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("results/results.csv")

fig, axes = plt.subplots(1, 3, figsize=(16, 5))

for task, marker, color in [("gsm8k", "o", "#2563eb"), ("mmlu", "s", "#dc2626")]:
    sub = df[df["task"] == task]
    axes[0].plot(sub["variant"], sub["accuracy_pct"], marker=marker, label=task, color=color, linewidth=2, markersize=8)
    axes[1].plot(sub["variant"], sub["peak_mem_gb"], marker=marker, label=task, color=color, linewidth=2, markersize=8)
    axes[2].plot(sub["variant"], sub["tokens_per_sec"], marker=marker, label=task, color=color, linewidth=2, markersize=8)

axes[0].set_title("Accuracy (%) by Variant", fontweight="bold")
axes[0].set_ylabel("Accuracy %")
axes[1].set_title("Peak GPU Memory (GB) by Variant", fontweight="bold")
axes[1].set_ylabel("GB")
axes[2].set_title("Throughput (tokens/sec) by Variant", fontweight="bold")
axes[2].set_ylabel("tokens/sec")

for ax in axes:
    ax.tick_params(axis='x', rotation=20)
    ax.legend()
    ax.grid(alpha=0.3)

plt.suptitle("Phi-4-mini-instruct: Quantization Accuracy-Speed-Memory Tradeoff (T4 GPU)", fontweight="bold")
plt.tight_layout()
plt.savefig("results/accuracy_speed_memory.png", dpi=150)
print("saved plot")
