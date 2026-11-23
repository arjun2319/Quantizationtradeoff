"""Per-category error analysis (MMLU subject areas, GSM8K problem length, error types) and
time-to-first-token estimates for the llama.cpp runs. Usage: python analysis/category_and_ttft.py"""
import json, math, statistics as st
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R=os.path.join(ROOT,"results","phase2","runs")+"/"
# number of solution steps for each of the 200 GSM8K questions (from the official test.jsonl,
# same seed-42 order; verified against all 200 stored gold answers)
steps=json.load(open(os.path.join(ROOT,"results","phase2","gsm8k_solution_steps.json")))
CAT={"STEM":"abstract_algebra astronomy college_biology college_chemistry college_computer_science college_mathematics college_physics computer_security conceptual_physics electrical_engineering elementary_mathematics high_school_biology high_school_chemistry high_school_computer_science high_school_mathematics high_school_physics high_school_statistics machine_learning",
 "Humanities":"formal_logic high_school_european_history high_school_us_history high_school_world_history international_law jurisprudence logical_fallacies moral_disputes moral_scenarios philosophy prehistory professional_law world_religions",
 "Social sciences":"econometrics high_school_geography high_school_government_and_politics high_school_macroeconomics high_school_microeconomics high_school_psychology human_sexuality professional_psychology public_relations security_studies sociology us_foreign_policy",
 "Other (business, health, misc.)":"anatomy business_ethics clinical_knowledge college_medicine global_facts human_aging management marketing medical_genetics miscellaneous nutrition professional_accounting professional_medicine virology"}
S2C={s:c for c,ss in CAT.items() for s in ss.split()}
def L(v,t): return {r['idx']:r for r in (json.loads(l) for l in open(f"{R}{v}__{t}.jsonl") if l.strip())}
V=["gguf_f16","gguf_q8_0","gguf_q4_k_m","gguf_nvfp4","gguf_mxfp4","gguf_f16_kv8","gguf_f16_kv4","nf4_attn_only","nf4_mlp_only","nf4_full"]
out={}
# MMLU by category
mm={v:L(v,"mmlu") for v in V}
cats=list(CAT)
missing={r['subject'] for r in mm['gguf_f16'].values() if r['subject'] not in S2C}; print("unmapped:",missing)
n={c:sum(S2C[r['subject']]==c for r in mm['gguf_f16'].values()) for c in cats}; print("MMLU n per category",n)
out["mmlu_n"]=n; out["mmlu"]={}
for v in V:
    out["mmlu"][v]={c:round(100*sum(r['correct'] for r in mm[v].values() if S2C[r['subject']]==c)/n[c],1) for c in cats}
    print(f"{v:14s}",out["mmlu"][v])
# GSM8K by steps
B=lambda s: "2 steps" if s<=2 else "3 steps" if s==3 else "4 steps" if s==4 else "5+ steps"
bk=["2 steps","3 steps","4 steps","5+ steps"]
gg={v:L(v,"gsm8k") for v in V}
gn={b:sum(B(steps[i])==b for i in range(200)) for b in bk}; print("GSM8K n per bucket",gn); out["gsm_n"]=gn; out["gsm"]={}
for v in V:
    out["gsm"][v]={b:round(100*sum(gg[v][i]['correct'] for i in range(200) if B(steps[i])==b)/gn[b],1) for b in bk}
    print(f"{v:14s}",out["gsm"][v])
# error types
out["err"]={}
for v in V:
    e={}
    for t,D in (("gsm8k",gg[v]),("mmlu",mm[v])):
        wrong=[r for r in D.values() if not r['correct']]
        e[t]={"wrong":len(wrong),"no_answer":sum(r['pred'] is None for r in wrong),"hit_512":sum(r['n_tokens']>=512 for r in wrong)}
    out["err"][v]=e; print(v,e)
# TTFT estimate (llama.cpp): wall - n_tokens/decode_tok_s
out["ttft"]={}
for v in V[:7]:
    o={}
    for t,D in (("gsm8k",gg[v]),("mmlu",mm[v])):
        x=[1000*(r['wall_s']-r['n_tokens']/r['decode_tok_s']) for r in D.values() if r.get('decode_tok_s')]
        o[t]={"median_ms":round(st.median(x)),"mean_ms":round(st.mean(x)),"p90_ms":round(sorted(x)[int(.9*len(x))])}
    out["ttft"][v]=o; print("TTFT",v,o)
json.dump(out,open(os.path.join(ROOT,"results","phase2","category_and_ttft.json"),"w"),indent=1)
