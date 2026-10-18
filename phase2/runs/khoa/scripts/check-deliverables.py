"""Check the actual submission contract and prevent accidental secret publication."""
import csv
import json
import re
import subprocess
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
BUILD=ROOT.parent/'_khoa-build'
rows=list(csv.DictReader((ROOT/'phase2/runs/khoa/test-cases.csv').open(encoding='utf-8',newline='')))
assert len(rows)>=15 and len({r['id'] for r in rows})==len(rows)
assert list(rows[0])==['id','question','expected_tools','expected_values','note']
metrics=0
for row in rows:
    item=json.loads(row['expected_values'])
    assert row['question'] and item['calls']
    for call in item['calls']:
        assert call['tool'] and isinstance(call['arguments'],dict)
        metrics+=len(call['checks'])
assert metrics>=59
quiz=(ROOT/'phase2/runs/khoa/questions-phase2.txt').read_text(encoding='utf-8')
assert len(re.findall(r'^Question \d+:',quiz,re.M))==20
assert len(re.findall(r'^Answer: [ABCD]$',quiz,re.M))==20
for letter in 'ABCD': assert len(re.findall('^'+letter+r'\. ',quiz,re.M))==20
with zipfile.ZipFile(ROOT/'phase2/runs/khoa/test-reference.xlsx') as z:
    assert sum(len(list(ET.fromstring(z.read(n)).iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}f'))) for n in z.namelist() if n.startswith('xl/worksheets/') and n.endswith('.xml'))>=59
# The local .env is the only place where the supplied credential belongs.
env=(ROOT/'mcp-academic/.env').read_text(encoding='utf-8')
key=next(line.split('=',1)[1].strip() for line in env.splitlines() if line.startswith('GEMINI_API_KEY='))
assert len(key)>15
files=[p for folder in ['phase2/runs/khoa'] for p in (ROOT/folder).rglob('*') if p.is_file()]
for p in files:
    raw=p.read_bytes()
    assert key.encode() not in raw, 'Credential found in deliverable (value suppressed)'
    if p.suffix=='.xlsx':
        with zipfile.ZipFile(p) as z:
            assert all(key.encode() not in z.read(n) for n in z.namelist()), 'Credential found in archive'
    assert p.name!='.env' and 'node_modules' not in p.parts
assert subprocess.check_output(['git','check-ignore','mcp-academic/.env'],cwd=ROOT,text=True).strip()=='mcp-academic/.env'
workbook=json.loads((BUILD/'workbook-check.json').read_text(encoding='utf-8'))
assert not workbook['failures']
report=dict(test_cases=len(rows),expected_checks=metrics,quiz_questions=20,credential_scan='passed; credential value not logged',workbook_formula_metrics=workbook['metrics'],application_code_changed=False)
(ROOT/'phase2/runs/khoa/deliverables-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
