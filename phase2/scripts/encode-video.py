"""Use a temporary imageio-ffmpeg installation; do not install into the repository."""
import json
import subprocess
import sys
import wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BUILD=ROOT.parent/'_khoa-build'
sys.path.insert(0,str(BUILD/'video-tools'))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
scenes=json.loads((BUILD/'video/scenes.json').read_text(encoding='utf-8'))
segments=[];subtitles=[];elapsed=0
def timestamp(seconds):
    ms=round(seconds*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'
for i,scene in enumerate(scenes,1):
    wav=BUILD/'video'/f'scene-{i:02d}.wav'
    with wave.open(str(wav)) as w: duration=w.getnframes()/w.getframerate()
    # Round to video-frame duration to keep concatenation/captions aligned.
    duration=round((duration+1.2)*10)/10
    segment=BUILD/'video'/f'segment-{i:02d}.mp4'
    subprocess.run([ffmpeg,'-y','-loglevel','error','-loop','1','-framerate','10','-i',scene['image'],'-i',str(wav),'-t',str(duration),'-vf','scale=1280:720,format=yuv420p','-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','25','-c:a','aac','-b:a','96k','-af','apad','-movflags','+faststart',str(segment)],check=True)
    segments.append(segment)
    # Sentence captions keep each subtitle short enough for comfortable reading.
    sentences=[s.strip()+'.' for s in scene['narration'].rstrip('.').split('. ') if s.strip()]
    counts=[len(s.split()) for s in sentences];total=sum(counts);part_start=elapsed
    for sentence,count in zip(sentences,counts):
        part_duration=(duration-1.2)*count/total
        subtitles += [str(len(subtitles)//4+1),f'{timestamp(part_start)} --> {timestamp(part_start+part_duration)}',sentence,'']
        part_start+=part_duration
    elapsed+=duration
    print(f'Encoded scene {i}/{len(scenes)}',flush=True)
listing=BUILD/'video/concat.txt'
listing.write_text('\n'.join("file '"+str(p).replace('\\','/').replace("'","'\\''")+"'" for p in segments),encoding='utf-8')
output=ROOT/'video/demo-phase2.mp4'
subprocess.run([ffmpeg,'-y','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(output)],check=True)
(ROOT/'video/demo-phase2.srt').write_text('\n'.join(subtitles),encoding='utf-8')
receipt=dict(duration_seconds=elapsed,scenes=len(scenes),resolution='1280x720',fps=10,voice='Microsoft Zira Desktop (synthetic English)',format='Narrated replay of actual recorded traces and slides; not a live screen capture',file_bytes=output.stat().st_size)
(ROOT/'phase2/runs/khoa/video-validation.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
# Decode representative final-file frames and one second of audio for QA.
for i,time in enumerate([0,elapsed/4,elapsed/2,elapsed*3/4,max(0,elapsed-3)]):
    subprocess.run([ffmpeg,'-y','-loglevel','error','-ss',str(time),'-i',str(output),'-frames:v','1',str(BUILD/'video'/f'final-frame-{i}.png')],check=True)
subprocess.run([ffmpeg,'-loglevel','error','-ss','5','-i',str(output),'-t','1','-f','null','-'],check=True)
print(json.dumps(receipt))
