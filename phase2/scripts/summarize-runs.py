"""Build the submission report from complete, recorded runs, never invented metrics."""
import csv
import json
import statistics
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/'phase2/runs/khoa'
BUILD=ROOT.parent/'_khoa-build'
selected={}
for label in ['gemini-stdio-tools','gemini-http-tools','gemini-stdio-llm','gemini-http-llm']:
    candidates=[]
    for f in sorted(DIR.glob(label+'-2*.jsonl')):
        rows=[json.loads(line) for line in f.read_text(encoding='utf-8').splitlines() if line.strip()]
        summary=next((r for r in rows if r.get('kind')=='summary' and r.get('total')==31),None)
        # The first complete HTTP sweep finished all cases, then hit a harness cleanup
        # method-name error. Preserve the raw file unchanged and derive an explicitly
        # labelled summary from those complete records. This does not invent a turn.
        case_rows=[r for r in rows if r.get('kind')=='case']
        if not summary and len(case_rows)==31 and len({r['id'] for r in case_rows})==31 and all(r.get('fullMcpResults') for r in case_rows if r['status']!='skipped'):
            summary=dict(kind='summary',total=31,passed=sum(r['status']=='passed' for r in case_rows),failed=sum(r['status']=='failed' for r in case_rows),errors=sum(r['status']=='error' for r in case_rows),skipped=sum(r['status']=='skipped' for r in case_rows),log=f.name,recovered_from_complete_cases=True,harness_issue='All case records completed; old harness called a missing ChatHost.close method during cleanup. Fixed to hub.close. Raw trace left unchanged.')
        if summary: candidates.append((f,rows,summary))
    if not candidates: raise SystemExit('No complete run for '+label)
    f,rows,summary=candidates[-1]
    cases=[r for r in rows if r.get('kind')=='case' and r.get('status')!='skipped']
    turns=[r['turn'] for r in cases if r.get('turn')]
    selected[label]=dict(summary=summary,file=f.name,cases=cases,
      median_ms=statistics.median(r['ms'] for r in cases),
      tool_median_ms=statistics.median([c['ms'] for t in turns for c in t['toolCalls']] or [r['ms'] for r in cases]),
      input_tokens=sum(t['usage']['inputTokens'] for t in turns),output_tokens=sum(t['usage']['outputTokens'] for t in turns),
      retries=sum(c['attempts']-1 for t in turns for c in t['llmCalls']),
      models=sorted({c['model'] for t in turns for c in t['llmCalls']}))
payload=dict(date='2026-10-18',timezone='Asia/Saigon',runs=selected)
(BUILD/'results.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
compact={k:{kk:vv for kk,vv in v.items() if kk!='cases'} for k,v in selected.items()}
(DIR/'comparison.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (DIR/'comparison.csv').open('w',encoding='utf-8',newline='') as f:
    w=csv.writer(f);w.writerow(['configuration','executed','subset_pass','failed','skipped_finance','median_e2e_ms','median_tool_ms','input_tokens','output_tokens','retry_attempts','source_log'])
    for label,r in selected.items():
        s=r['summary'];w.writerow([label,26,s['passed'],s['failed'],s['skipped'],r['median_ms'],r['tool_median_ms'],r['input_tokens'] if label.endswith('llm') else '',r['output_tokens'] if label.endswith('llm') else '',r['retries'],r['file']])
lines=['# Khoa — Phase 2 measurement report','',
'Measured on 18 October 2026 (Asia/Saigon), Windows, Node.js '+next(json.loads(l)['node'] for l in (DIR/selected['gemini-stdio-llm']['file']).read_text(encoding='utf-8').splitlines() if json.loads(l).get('kind')=='metadata')+'. The files below preserve timestamps in UTC. All academic records are synthetic sample data. Hardware and network were not controlled.','',
'## Current results','',
'Each sweep contains 26 executable academic cases and five finance cases explicitly skipped on main. Gemini uses `gemini-3.5-flash-lite`, temperature 0.2, maxToolRounds 8, fresh conversations and disabled model fallback. The system prompt, dataset and questions are identical between transports. HTTP servers are started locally on 3001/3002. Startup/model discovery time is outside per-question timings.','',
'| Configuration | Exact tool/argument/value subset | Finance skipped | Median question time | Median individual tool time | Tokens in / out | Extra API attempts |',
'| --- | --- | --- | --- | --- | --- | --- |']
for label,r in selected.items():
    s=r['summary'];llm=label.endswith('llm')
    lines.append(f"| {label} | {s['passed']}/26 | {s['skipped']} | {r['median_ms']:,.0f} ms | {r['tool_median_ms']:,.0f} ms | {str(r['input_tokens'])+' / '+str(r['output_tokens']) if llm else 'not applicable'} | {r['retries'] if llm else 'not applicable'} |")
lines += ['', '## Interpretation and scoring limits','',
'- Direct MCP checks compare independent CSV/Excel reference values with real structured tool results. They exercise transport and calculation behavior without an LLM.',
'- The LLM subset score requires every listed tool, the required argument values and the listed structured values. It is deliberately stricter than semantic answer correctness. For example, P2-03 expects retrieval `limit: 1`; retrieving 50 and presenting one teacher can produce a correct user-facing answer while failing that configuration check.',
'- The answer-presence screen is a diagnostic, not an accuracy score. Natural phrases such as “no matches” can express zero without the digit 0. Boolean exam-ban decisions, missing-data explanations and the completeness of advising/risk reasons need semantic review. Every case is marked `requiresHumanReview`.',
'- Golden numeric values come from CSV calculations independent of production grading/tool functions. `test-reference.xlsx` contains 59 formula metrics with independent CSV cross-checks. All agree under Artifact Tool, and a disposable conduct-input change verified recalculation. A human has not yet reviewed the workbook in Microsoft Excel; do not describe this as Khoa having calculated the answers by hand.',
'- One sweep per transport does not establish a general speed advantage. API retries and network variability affect end-to-end latency. These are new Phase 2 measurements, separate from the historical 11-case model comparison on an Apple M4 Pro.',
'- Qwen was not measured: Ollama was unavailable. The supplied Gemini key was valid. Finance, a true terse-tool-description variant and the full round/temperature matrix are outside this measured slice. Existing Hoang results remain in their own logs and documents.',
'', '## Failed strict checks','']
any_failure=False
for label,r in selected.items():
    for c in r['cases']:
        if c['status']!='passed':
            any_failure=True
            lines.append(f"- {label}, {c['id']}: {c['status']}. Inspect `{r['file']}` for the arguments, complete MCP output and final answer.")
if not any_failure:lines.append('No strict subset failures in these sweeps. This does not replace semantic review.')
lines += ['', '## Evidence files','']
for label,r in selected.items():lines.append(f"- [{r['file']}]({r['file']}) — {label}")
lines += ['', 'Also retained: `doctor.json`, the 15/15 example-suite summary, S9/S10 outputs, workbook validation and configuration snapshots. `comparison.csv` and `comparison.json` are rebuilt from the selected complete traces, not hand-entered results. The console return code may be 1 when a strict case fails; its recorded failure remains in the report.','',
'The first complete HTTP LLM sweep recorded all 31 cases before a harness cleanup error (`ChatHost.close` did not exist). Its summary is reconstructed from the unchanged complete case records and marked `recovered_from_complete_cases` in comparison.json. The runner now closes `host.hub` and has a TypeScript check. This cleanup issue did not change recorded model calls, outputs or per-question times.','',
'## Reproduce','', 'From `mcp-academic/`, after `npm install` and local `.env` configuration:', '', '```powershell',
'node node_modules/typescript/bin/tsc --noEmit -p ../phase2/tsconfig.json',
'node --import tsx ../phase2/scripts/run-checks.ts',
'node --import tsx ../phase2/scripts/run-checks.ts --config ../phase2/configs/gemini-http.json --start-http',
'node --import tsx ../phase2/scripts/run-checks.ts --llm',
'node --import tsx ../phase2/scripts/run-checks.ts --llm --config ../phase2/configs/gemini-http.json --start-http',
'```', '', 'Then run `python phase2/scripts/summarize-runs.py` from the repository root. Read `phase2/KHOA-HANDOFF.md` before regenerating references or enabling finance.']
(DIR/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({k:v['summary'] for k,v in selected.items()}))
