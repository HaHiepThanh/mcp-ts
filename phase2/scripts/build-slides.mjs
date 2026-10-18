import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';

const repo=path.resolve(process.argv[2]);
const build=path.join(repo,'..','_khoa-build');
const skill=process.env.KHOA_PRESENTATION_SKILL;
if(!skill)throw Error('Set KHOA_PRESENTATION_SKILL to the installed Presentations skill directory.');
const content=JSON.parse(await fs.readFile(path.join(repo,'phase2/slides-content.json'),'utf8'));
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={navy:'#12324A',teal:'#087F8C',ink:'#203747',muted:'#4C6575',paper:'#F7F8F5',light:'#E1E8E8'};
const font='Arial';
function box(s,text,x,y,w,h,size=28,color=C.ink,bold=false) {
  const o=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  o.text=text;o.text.style={typeface:font,fontSize:size,color,bold};return o;
}
function rule(s,y,w=1120) {s.shapes.add({geometry:'rect',position:{left:80,top:y,width:w,height:2},fill:C.teal,line:{fill:'none',width:0}});}
const tableOwners=[];
for(const [i,c] of content.entries()) {
  const s=p.slides.add();s.background.fill=C.paper;
  if(c.kind==='cover') {
    s.background.fill=C.navy;
    box(s,c.title,80,115,1080,210,66,'#FFFFFF',true);
    s.shapes.add({geometry:'rect',position:{left:80,top:369,width:220,height:6},fill:'#63C5BE',line:{fill:'none',width:0}});
    box(s,c.body[0],80,405,1100,70,30,'#E4F0EF');
    box(s,c.body[1],80,548,1100,45,23,'#B8D7D8');
  } else {
    box(s,c.title,80,50,1120,110,42,C.navy,true);rule(s,165);
    if(c.kind==='table') {
      const rows=c.rows.length,cols=c.rows[0].length;
      const h=Math.min(408,rows*64);
      const table=s.tables.add({rows,columns:cols,left:80,top:210,width:1120,height:h,values:c.rows});
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
        const cell=table.getCell(row,col);
        cell.fill=row===0?C.navy:(row%2?'#FFFFFF':'#EDF2F0');
        cell.text.style={typeface:font,fontSize:cols>3?21:24,color:row===0?'#FFFFFF':C.ink,bold:row===0};
      }
      tableOwners.push(i+1);
    } else if(c.kind==='flow') {
      const positions=[[80,230],[680,230],[680,430],[80,430]];
      c.body.forEach((t,j)=>{
        const [x,y]=positions[j];
        s.shapes.add({geometry:'rect',position:{left:x,top:y,width:510,height:100},fill:j===1?C.teal:C.navy,line:{fill:'none',width:0}});
        box(s,t,x+25,y+26,460,52,27,'#FFFFFF',true);
      });
      box(s,'1',85,196,40,30,20,C.muted);box(s,'2',685,196,40,30,20,C.muted);
      box(s,'3',685,396,40,30,20,C.muted);box(s,'4',85,396,40,30,20,C.muted);
    } else {
      const gap=c.body.length<=3?115:100;
      c.body.forEach((t,j)=>{
        box(s,String(j+1).padStart(2,'0'),80,215+j*gap,64,45,24,C.teal,true);
        box(s,t,170,210+j*gap,1020,78,30,C.ink);
      });
    }
    box(s,String(i+1).padStart(2,'0'),1135,662,60,30,18,C.muted);
  }
  s.speakerNotes.text=`${c.narration}\n\nSources: ${c.source}\nData is synthetic. Finance slides describe PR #2 expectations and are not execution claims on main.`;
}
await fs.mkdir(path.join(build,'slides'),{recursive:true});
await fs.mkdir(path.join(repo,'slides'),{recursive:true});
for(const [i,s] of p.slides.items.entries()) {
  const png=await p.export({slide:s,format:'png',scale:1});
  await fs.writeFile(path.join(build,'slides',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
const staging=path.join(build,'presentation-validation');await fs.mkdir(staging,{recursive:true});
const candidate=path.join(staging,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
await fs.mkdir(path.join(build,'final'),{recursive:true});
const final=path.join(build,'final',`MCP-TS-SDK-phase2-${Date.now()}.pptx`);
await finalizePresentation({workspaceDir:path.resolve(repo,'..'),candidatePath:candidate,finalPath:final,pythonExecutable:process.env.KHOA_RUNTIME_PYTHON,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tableOwners.flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:content.length,requiredNativeTableOwnerSlides:tableOwners,fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(staging,'validation.json')});
await fs.copyFile(final,path.join(repo,'slides/MCP-TS-SDK-phase2.pptx'));
console.log(`Finalized ${content.length} slides with ${tableOwners.length} native tables.`);
