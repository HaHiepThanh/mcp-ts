"""Prepare a labelled narrated replay from actual selected Gemini trace records."""
import json
import textwrap
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]
BUILD=ROOT.parent/'_khoa-build'
OUT=BUILD/'video';OUT.mkdir(exist_ok=True)
slides=json.loads((ROOT/'phase2/slides-content.json').read_text(encoding='utf-8'))
results=json.loads((BUILD/'results.json').read_text(encoding='utf-8'))
run=results['runs']['gemini-stdio-llm']
scenes=[]
font='C:/Windows/Fonts/arial.ttf';bold='C:/Windows/Fonts/arialbd.ttf'
def add_scene(image,narration,caption,source):
    scenes.append(dict(image=str(image),narration=narration,caption=caption,source=source))
def trace(id):
    row=next(r for r in run['cases'] if r['id']==id)
    image=Image.new('RGB',(1280,720),'#F7F8F5');d=ImageDraw.Draw(image)
    d.text((70,45),'Recorded Gemini trace: '+id,font=ImageFont.truetype(bold,38),fill='#12324A')
    d.text((70,100),'Evidence replay, synthetic data. Not a live screen recording.',font=ImageFont.truetype(font,23),fill='#087F8C')
    y=158
    for line in textwrap.wrap(row['question'],92):
        d.text((70,y),line,font=ImageFont.truetype(bold,24),fill='#203747');y+=31
    y+=20
    calls=row['turn']['toolCalls']
    for c in calls:
        for line in textwrap.wrap(c['server']+'.'+c['tool']+' '+json.dumps(c['args'],ensure_ascii=False),100):
            d.text((70,y),line,font=ImageFont.truetype(font,21),fill='#087F8C');y+=28
    y+=20
    # Selected answer excerpt is verbatim except presentation markup. Full answer stays in JSONL.
    answer=row['turn']['answer'].replace('**','').replace('### ','').replace('## ','')
    excerpt=[]
    for paragraph in answer.splitlines():
        excerpt.extend(textwrap.wrap(paragraph,105) or [''])
    available=max(1,(620-y)//27)
    clipped=len(excerpt)>available
    for line in excerpt[:available]:
        d.text((70,y),line,font=ImageFont.truetype(font,21),fill='#203747');y+=27
    d.text((70,652),f"Answer {'excerpt' if clipped else 'shown'}; full trace: {run['file']}",font=ImageFont.truetype(font,17),fill='#4C6575')
    p=OUT/(id+'.png');image.save(p)
    narration={
      'P2-08':'Here is the recorded teacher workload question. The model called academic teacher workload with teacher T zero zero one and semester twenty twenty-four dash one. The returned result shows three assigned sections and nine teaching periods per week. The complete arguments and result remain in the raw trace.',
      'P2-14':'This recorded case asks about four absences out of fifteen meetings. The model used both the student identifier and the section identifier. The result is approximately twenty-six point seven percent, with an exam ban. The companion case with three absences confirms that the exact twenty percent boundary is not banned.',
      'P2-20':'This trace shows the conduct boundary case. The tool returns a conduct score of fifty for the selected student and semester. The classification is Average. The model obtains the value from the tool, rather than inventing a score or confusing a missing record with zero.',
      'P2-23':'The recorded class risk query evaluates ten students and flags two. The response contains the student-level reasons. A reviewer should compare those reasons with the complete structured results, because a numeric count alone does not prove that the final answer preserved every risk explanation.',
      'P2-31':'The final recorded scenario is an advising briefing. The model calls the transcript, attendance and conduct tools with the same student and semester. The answer combines academic performance with exam restrictions and conduct. This is a replay of the measured response. It is not a fresh model request during video playback.'
    }[id]
    add_scene(p,narration,'Recorded trace '+id,run['file'])
after={8:'P2-08',10:'P2-14',12:'P2-20',13:'P2-23',17:'P2-31'}
for i,s in enumerate(slides,1):
    # Small overlay explicitly labels every video frame as an evidence replay.
    image=Image.open(BUILD/'slides'/f'slide-{i:02d}.png').convert('RGB')
    d=ImageDraw.Draw(image);d.rectangle((0,694,1280,720),fill='#12324A')
    d.text((18,698),'NARRATED EVIDENCE REPLAY  /  Synthetic English voice  /  Sample data',font=ImageFont.truetype(font,16),fill='white')
    p=OUT/f'slide-{i:02d}.png';image.save(p)
    add_scene(p,s['narration'],s['title'].replace('\n',' '),s['source'])
    if i in after:trace(after[i])
(OUT/'scenes.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2),encoding='utf-8')
md=['# Phase 2 backup video','',
'This is a narrated replay of recorded evidence, not a live screen capture and not Khoa’s own voice. Narration uses the local Windows English speech synthesizer. All data is synthetic. Five trace scenes show actual recorded questions, tool arguments and answer excerpts from the selected stdio run. Full answers are in the cited JSONL.','',
'For the final presentation, the team can replace the synthetic voice with their own recording. `demo-phase2.srt` contains timed English captions.','']
for i,s in enumerate(scenes,1):md += [f"## Scene {i}: {s['caption']}",'',s['narration'],'','Source: '+s['source'],'']
(ROOT/'video').mkdir(exist_ok=True)
(ROOT/'video/demo-phase2-script.md').write_text('\n'.join(md),encoding='utf-8')
print(f'{len(scenes)} video scenes prepared')
