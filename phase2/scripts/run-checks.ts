/** Khoa's submission runner. Does not alter the team's demo/benchmark.ts or server code.
 * cd mcp-academic; node --import tsx ../phase2/scripts/run-checks.ts [--llm] [--config ../phase2/configs/gemini-stdio.json]
 * Each model starts with a fresh conversation for each question. Fallback is disabled.
 */
import {appendFileSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn, type ChildProcess} from 'node:child_process';
import {parseCsv} from '../../mcp-academic/src/lib/csv';
import {loadEnv, PROJECT_ROOT} from '../../mcp-academic/src/lib/env';
import {loadHostConfig} from '../../mcp-academic/src/host/config';
import {McpHub} from '../../mcp-academic/src/host/mcp-hub';
import {ChatHost} from '../../mcp-academic/src/host/host';
import {GeminiProvider} from '../../mcp-academic/src/host/providers/gemini';
import {OpenAICompatibleProvider} from '../../mcp-academic/src/host/providers/openai-compatible';

loadEnv();
const root=path.resolve(PROJECT_ROOT,'..');
const argv=process.argv.slice(2);
const option=(s:string)=>argv.includes(s)?argv[argv.indexOf(s)+1]:undefined;
const llm=argv.includes('--llm');
const configFile=option('--config')??'../phase2/configs/gemini-stdio.json';
const {config}=loadHostConfig(configFile);
const label=path.basename(configFile,'.json')+(llm?'-llm':'-tools');
const dir=path.join(root,'phase2/runs/khoa'); mkdirSync(dir,{recursive:true});
const started=new Date().toISOString();
const stamp=started.replace(/[:.]/g,'-');
const file=path.join(dir,`${label}-${stamp}.jsonl`);
const redact=(s:string)=>process.env.GEMINI_API_KEY?s.split(process.env.GEMINI_API_KEY).join('[REDACTED]'):s;
const log=(x:unknown)=>appendFileSync(file,redact(JSON.stringify(x))+'\n');
const cases=parseCsv(readFileSync(path.join(root,'phase2/test-cases.csv'),'utf8')).rows;
const only=option('--only')?.split(',');
const manifest=JSON.parse(readFileSync(path.join(root,'phase2/reference-manifest.json'),'utf8'));
// Verify exact source bytes on the current branch, without guessing values from tools.
for(const source of manifest.sources.filter((s:any)=>s.commit===manifest.base_commit)) {
  const sha=createHash('sha256').update(readFileSync(path.join(root,source.path))).digest('hex');
  // Git may check out CRLF on Windows; compare canonical LF to the pinned Git blob.
  const lf=createHash('sha256').update(readFileSync(path.join(root,source.path),'utf8').replace(/\r\n/g,'\n')).digest('hex');
  if(sha!==source.sha256&&lf!==source.sha256) throw Error(`Source changed: ${source.path}. Regenerate and review the reference first.`);
}
function at(value:any, key:string):any { return key.split('.').reduce((v,k)=>v?.[k],value); }
function equal(a:any,b:any):boolean { return typeof b==='number'?typeof a==='number'&&Math.abs(a-b)<1e-8:JSON.stringify(a)===JSON.stringify(b); }
function mentioned(text:string,value:any):boolean {
  if(typeof value==='boolean') return true; // Exam-ban reasoning requires manual review.
  const escaped=String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Full numeric tokens: 20 cannot match 2201005. Accept comma grouping and 20.0.
  return new RegExp(`(?<![\\p{L}\\p{N}.])${escaped}${typeof value==='number'?'(?:\\.0+)?':''}(?![\\p{L}\\p{N}.])`,'iu').test(text.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,''));
}
const hub=new McpHub({onElicit:async()=>({action:'decline'}),onSample:async()=>{throw Error('Sampling not used in these read-only cases');}});
const provider=llm?(config.llm.provider==='gemini'?new GeminiProvider({...config.llm,fallback:false}):new OpenAICompatibleProvider({baseUrl:config.llm.baseUrl!,model:config.llm.model!,temperature:config.llm.temperature,label:config.llm.label})):undefined;
const host=provider?new ChatHost(config,provider,{configFile,verbose:false}):undefined;
let captured:any[]=[];
if(host) {
  const original=host.hub.callTool.bind(host.hub);
  host.hub.callTool=async (...args:Parameters<typeof original>)=>{ const r=await original(...args);captured.push(r);return r; };
}
const results:any[]=[];
const children:ChildProcess[]=[];
let exit=0;
log({kind:'metadata',started,mode:llm?'llm':'direct_mcp',config:configFile,configSha256:createHash('sha256').update(JSON.stringify(config)).digest('hex'),sourceCommit:manifest.base_commit,node:process.version,platform:process.platform,fallback:false,grading:'exact tools and required args; exact independent numeric subset; answer value presence is a screening check, human semantic review required'});
try {
  if(argv.includes('--start-http')) {
    for(const [server,port] of [['academic',3001],['utility',3002]] as const) {
      const child=spawn(process.execPath,['--import','tsx',`src/server/${server}/main.ts`,'--http','--port',String(port)],{cwd:PROJECT_ROOT,windowsHide:true,stdio:'ignore'});
      children.push(child);
      let ready=false;
      for(let retry=0;retry<40;retry++) {
        if(child.exitCode!==null) throw Error(`HTTP ${server} failed to start (port ${port})`);
        try { const r=await fetch(`http://127.0.0.1:${port}/mcp`); if(r.status!==404) {ready=true;break;} } catch {}
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      if(!ready) throw Error(`HTTP ${server} startup timed out`);
    }
  }
  if(host) await host.start();
  else for(const [name,server] of Object.entries(config.mcpServers)) if(!server.disabled) await hub.connect(name,server);
  const live=host?.hub??hub;
  log({kind:'capabilities',servers:[...live.servers.values()].map(s=>({name:s.name,transport:s.transport,tools:s.tools.map(t=>t.name)}))});
  for(const row of cases) {
    if(only&&!only.includes(row.id)) continue;
    const expected=JSON.parse(row.expected_values);
    if(expected.snapshot!=='main') { const result={kind:'case',id:row.id,status:'skipped',reason:'finance PR #2 not merged; matching HR snapshot required'}; log(result);results.push(result);continue; }
    const begin=performance.now();
    try {
      let turn:any; const actual:any[]=[];
      if(host) { captured=[]; host.newConversation(); turn=await host.ask(row.question); }
      for(const call of expected.calls) {
        if(host) {
          const seen=captured.filter((c:any)=>c.server==='academic'&&c.tool===call.tool);
          const match=seen.find((c:any)=>Object.entries(call.arguments).every(([k,v])=>equal(c.args[k],v)));
          if(!match) { actual.push({tool:call.tool,pass:false,reason:'expected tool with required arguments not called'});continue; }
          // TurnLog.output is deliberately truncated by the host. Capture full MCP results
          // at the harness boundary rather than parsing that human-readable preview.
          const output={result:match.result.structuredContent,error:match.result.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n')};
          const checks=call.checks.map((c:any)=>({...c,actual:at(output.result,c.path),pass:equal(at(output.result,c.path),c.value),answerMentions:mentioned(turn.answer,c.value)}));
          const ok=call.error_contains?match.isError&&String(output.error).includes(call.error_contains):!match.isError&&checks.every((c:any)=>c.pass);
          actual.push({tool:call.tool,pass:ok,checks,error:output.error});
        } else {
          const got=await live.callTool('academic__'+call.tool,call.arguments);
          const text=got.result.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n');
          const checks=call.checks.map((c:any)=>({...c,actual:at(got.result.structuredContent,c.path),pass:equal(at(got.result.structuredContent,c.path),c.value)}));
          actual.push({tool:call.tool,pass:call.error_contains?got.isError&&text.includes(call.error_contains):!got.isError&&checks.every((c:any)=>c.pass),checks,result:got.result,ms:got.ms});
        }
      }
      const subsetPass=actual.every(c=>c.pass);
      const answerScreenPass=host?actual.every(c=>(c.checks??[]).every((x:any)=>x.answerMentions)):undefined;
      const result={kind:'case',id:row.id,question:row.question,status:subsetPass?'passed':'failed',subsetPass,answerScreenPass,requiresHumanReview:true,ms:Math.round(performance.now()-begin),actual,fullMcpResults:host?captured:undefined,turn};
      log(result); results.push(result); console.log(`${row.id} ${result.status} ${result.ms}ms${host?' answer-screen='+answerScreenPass:''}`);
    } catch(e) {
      const result={kind:'case',id:row.id,status:'error',error:redact(String(e)),ms:Math.round(performance.now()-begin)};log(result);results.push(result);console.log(`${row.id} error`);exit=1;
      if(/quota|429|API.key|API_KEY/i.test(String(e))) break;
    }
  }
} catch(e) { log({kind:'startup_error',error:redact(String(e))});exit=1; }
finally { await host?.hub.close(); await hub.close(); for(const child of children)child.kill(); }
const summary={kind:'summary',started,finished:new Date().toISOString(),label,total:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,errors:results.filter(r=>r.status==='error').length,skipped:results.filter(r=>r.status==='skipped').length,answerScreenPassed:host?results.filter(r=>r.status==='passed'&&r.answerScreenPass).length:undefined,log:path.basename(file)};
log(summary); writeFileSync(path.join(dir,`${label}-summary.json`),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
if(summary.failed||summary.errors)exit=1;
process.exitCode=exit;
