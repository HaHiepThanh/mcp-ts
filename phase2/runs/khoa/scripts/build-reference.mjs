// Run a copy in a private build folder linked to the bundled artifact-tool runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const repo = path.resolve(process.argv[2]);
const build = path.join(repo, '..', '_khoa-build');
const ref = JSON.parse(await fs.readFile(path.join(build, 'reference.json'), 'utf8'));
const wb = Workbook.create();
const ordered = [...ref.sheets].sort((a,b) => (a.name==='Answers'?-1:b.name==='Answers'?1:0));
for (const model of ordered) wb.worksheets.add(model.name);
const col = n => { let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; };
for (const model of ordered) {
  const sheet=wb.worksheets.getItem(model.name);
  sheet.showGridLines=false;
  sheet.getRange('A1').values=[[model.name==='Answers'?'Phase 2 answer key: Excel formulas and independent CSV checks':model.name]];
  sheet.getRange('A1').format.font={bold:true,size:18,color:'#12324A'};
  sheet.getRange('A2').values=[[model.source]];
  sheet.getRange('A3').values=[[model.name==='Answers'?'Human review pending. Formula engine: Artifact Tool. Not verified in Microsoft Excel.':'CSV values start on row 5. Blue inputs, black calculations. Sources and hashes: reference-manifest.json.']];
  sheet.getRange(`A4:${col(model.headers.length-1)}4`).values=[model.headers];
  const body=sheet.getRange(`A5:${col(model.headers.length-1)}${model.values.length+4}`);
  body.values=model.values;
  body.format.font={size:11,color:'#1D4ED8'};
  const columns=new Map();
  for (const [address,formula] of Object.entries(model.formulas)) {
    const [,letter,number]=address.match(/^([A-Z]+)(\d+)$/);
    if(!columns.has(letter))columns.set(letter,new Map());
    columns.get(letter).set(Number(number),formula);
  }
  for(const [letter,formulas] of columns) {
    const first=Math.min(...formulas.keys()),last=Math.max(...formulas.keys());
    const range=sheet.getRange(`${letter}${first}:${letter}${last}`);
    range.formulas=Array.from({length:last-first+1},(_,i)=>[formulas.get(first+i)??'']);
    range.format.font.color='#172B3A';
  }
  sheet.getRange(`A4:${col(model.headers.length-1)}4`).format.fill='#12324A';
  sheet.getRange(`A4:${col(model.headers.length-1)}4`).format.font={color:'#FFFFFF',bold:true,size:11};
  sheet.getRange(`A4:${col(model.headers.length-1)}${model.values.length+4}`).format.rowHeight=21;
  sheet.getRange(`A:${col(model.headers.length-1)}`).format.columnWidth=19;
  sheet.getRange('A:A').format.columnWidth=model.name==='Answers'?14:19;
  sheet.getRange('B:B').format.columnWidth=model.name==='Answers'?32:25;
  sheet.freezePanes.freezeRows(4);
  console.log(`Built ${model.name}: ${model.values.length} rows`);
  if (model.name==='Answers') {
    sheet.getRange('C:D').format.columnWidth=21;
    sheet.getRange(`C5:D${model.values.length+4}`).setNumberFormat('General');
    sheet.getRange('E:E').format.columnWidth=16;
  }
}
wb.recalculate();
const answers=wb.worksheets.getItem('Answers');
const values=answers.getRange(`A5:E${ref.sheets.find(s=>s.name==='Answers').values.length+4}`).values;
const failures=values.filter(r=>r[4]!==true);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},maxChars:3000});
await fs.writeFile(path.join(build,'workbook-check.json'),JSON.stringify({metrics:values.length,failures,errors:errors.ndjson},null,2));
console.log(JSON.stringify({metrics:values.length,failures,errors:errors.ndjson}));
if(failures.length) throw Error('Excel formulas disagree with independent CSV calculations');
// Verify that a source change recalculates both the input-dependent formula and answer.
const original=wb.worksheets.getItem('Conduct').getRange('C5').values;
wb.worksheets.getItem('Conduct').getRange('C5').values=[[90]];
wb.recalculate();
const probe=answers.getRange('A5:E80').values.find(r=>r[0]==='P2-18'&&r[1]==='records.0.score');
if(probe?.[2]!==90) throw Error('Recalculation probe failed');
wb.worksheets.getItem('Conduct').getRange('C5').values=original;
wb.recalculate();
await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(repo,'phase2','runs','khoa','test-reference.xlsx'));
for(const model of ordered) {
  const png=await wb.render({sheetName:model.name,range:`A1:${model.name==='Answers'?'E':'F'}${Math.min(16,model.values.length+4)}`,scale:1.4,format:'png'});
  await fs.writeFile(path.join(build,`sheet-${model.name}.png`),new Uint8Array(await png.arrayBuffer()));
}
console.log('Saved formula workbook and rendered every sheet.');
