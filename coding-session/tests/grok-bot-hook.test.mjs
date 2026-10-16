import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync, execFileSync} from 'node:child_process';
const skillDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hooksDir=join(skillDir,'hooks');
const script=join(skillDir,'scripts','grok-bot-hook.sh');
const temp=mkdtempSync(join(tmpdir(),'grok-hook-'));
const real=name=>execFileSync('/bin/bash',['-c',`command -v ${name}`],{encoding:'utf8'}).trim();
const repo=join(temp,'repo');mkdirSync(repo);
execFileSync('git',['init','-q',repo]);
execFileSync('git',['-C',repo,'checkout','-q','-b','feat/prj-951-hook-test']);
execFileSync('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-qm','PRJ-951 test']);
execFileSync('git',['-C',repo,'remote','add','origin','git@github.com:example-org/workflow.git']);
const bins={};
for(const mode of ['node','python','neither']){
 const bin=join(temp,mode);mkdirSync(bin);bins[mode]=bin;
 for(const name of ['cat','git'])symlinkSync(real(name),join(bin,name));
 if(mode==='node')symlinkSync(process.execPath,join(bin,'node'));
 if(mode==='python')symlinkSync(real('python3'),join(bin,'python3'));
 writeFileSync(join(bin,'curl'),'#!/bin/bash\nwhile (( $# )); do if [[ "$1" == "--data" ]]; then printf "%s" "$2" >> "$CAPTURE"; exit 0; fi; shift; done\nexit 1\n',{mode:0o755});
}
let serial=0;
function invoke(mode,event,args=[],extra={}){
 const capture=join(temp,`capture-${serial++}`);
 // Allowlist prevents real host credentials / identities from contaminating tests.
 const env={PATH:bins[mode],CLAUDE_PROJECT_DIR:repo,CAPTURE:capture,WF_GROK_BOT_HOOK:'https://example.invalid/hook',WF_GROK_BOT_TOKEN:'test',WF_HOOK_RUNTIME:'claude',WF_HOOK_EXPECTED_RUNTIME:'claude',WF_HOOK_TERMINAL_ID:'terminal-1',WF_HOOK_LAUNCH_ATTEMPT_ID:'launch-1',...extra};
 const r=spawnSync('/bin/bash',[script,...args],{input:JSON.stringify(event),encoding:'utf8',env,timeout:3000});
 assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);
 return {body:existsSync(capture)?JSON.parse(readFileSync(capture,'utf8')):null,stderr:r.stderr};
}
for(const mode of ['node','python']){
 test(`${mode}: preserve lifecycle distinctions and correlate one session`,()=>{
  const outputs=['SessionStart','UserPromptSubmit','Stop','SessionEnd'].map(hook_event_name=>invoke(mode,{hook_event_name,session_id:'native-1'}).body);
  assert.deepEqual(outputs.map(x=>x.status),['working','working','finished','finished']);
  assert.deepEqual(outputs.map(x=>x.eventType),['session_started','prompt_submitted','turn_stopped','session_ended']);
  assert.equal(new Set(outputs.map(x=>x.eventId)).size,4);
  for(const o of outputs){assert.equal(o.sessionId,'native-1');assert.equal(o.terminalId,'terminal-1');assert.equal(o.launchAttemptId,'launch-1');assert.equal(o.completionVerified,false);assert.equal(o.ticket,'PRJ-951');assert.equal(o.repoFullName,'example-org/workflow');assert.match(o.headSha,/^[0-9a-f]{40}$/);}
 });
 test(`${mode}: raw event survives host Stop normalization; native redelivery identity stays stable`,()=>{
  const e={hook_event_name:'Stop',rawEventType:'SessionEnd',session_id:'native-1',event_id:'native-event-1'};
  const a=invoke(mode,e).body,b=invoke(mode,e).body;
  assert.equal(a.eventType,'session_ended');assert.equal(a.rawEventType,'SessionEnd');
  assert.equal(a.sourceEventId,b.sourceEventId);assert.notEqual(a.eventId,b.eventId);
 });
 test(`${mode}: tools and child completion cannot finish the parent`,()=>{
  for(const hook_event_name of ['PostToolUse','PostToolUseFailure','PreToolUse','SubagentStop'])assert.equal(invoke(mode,{hook_event_name}).body,null);
 });
 test(`${mode}: reject foreign or mismatched identity`,()=>{
  for(const event of [{hook_event_name:'Stop',runtime:'cursor'},{hook_event_name:'Stop',terminal_id:'foreign-terminal'}])assert.equal(invoke(mode,event).body,null);
  assert.equal(invoke(mode,{hook_event_name:'Stop',session_id:'other'},[],{WF_HOOK_EXPECTED_SESSION_ID:'expected'}).body,null);
  assert.equal(invoke(mode,{hook_event_name:'Stop'},[],{WF_HOOK_EXPECTED_RUNTIME:'codex'}).body,null);
 });
 test(`${mode}: unknown identity remains unknown and manual reporting is bounded`,()=>{
  const o=invoke(mode,{hook_event_name:'Stop'},[],{WF_HOOK_TERMINAL_ID:'',WF_HOOK_LAUNCH_ATTEMPT_ID:''}).body;
  assert.equal(o.sessionId,null);assert.equal(o.terminalId,null);assert.equal(o.launchAttemptId,null);
  const msg='quoted "value" with \\ slash\nnext line';
  const manual=invoke(mode,{},['blocked',msg]).body;
  assert.equal(manual.message,msg);assert.equal(manual.eventType,'manual_status');assert.equal(manual.status,'blocked');
  assert.equal(invoke(mode,{},['bogus','reason']).body,null);
 });
 test(`${mode}: credentials absent no-op, unknown event no-op, message limit`,()=>{
  assert.equal(invoke(mode,{hook_event_name:'Stop'},[],{WF_GROK_BOT_TOKEN:''}).body,null);
  assert.equal(invoke(mode,{hook_event_name:'SomethingElse'}).body,null);
  assert.equal([...invoke(mode,{hook_event_name:'Stop',message:'😀'.repeat(501)}).body.message].length,500);
 });
}
// A pushed clone: ready_for_review needs a clean tree whose HEAD equals its upstream.
const pushed=join(temp,'pushed');
execFileSync('git',['init','-q','--bare',join(temp,'origin.git')]);
execFileSync('git',['clone','-q',join(temp,'origin.git'),pushed],{stdio:'ignore'});
execFileSync('git',['-C',pushed,'checkout','-q','-b','feat/prj-952-ready']);
execFileSync('git',['-C',pushed,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-qm','PRJ-952 ready']);
execFileSync('git',['-C',pushed,'push','-q','-u','origin','feat/prj-952-ready'],{stdio:'ignore'});
function gateRun(dir){
 const capture=join(temp,`capture-${serial++}`);
 const env={PATH:bins.node,CLAUDE_PROJECT_DIR:dir,CAPTURE:capture,WF_GROK_BOT_HOOK:'https://example.invalid/hook',WF_GROK_BOT_TOKEN:'test',WF_HOOK_RUNTIME:'claude'};
 const r=spawnSync('/bin/bash',[script,'ready_for_review','checks green'],{encoding:'utf8',env,timeout:3000});
 return {status:r.status,stderr:r.stderr,posted:existsSync(capture)};
}
for(const mode of ['node','python']){
 test(`${mode}: orchestrated-run signals post as manual statuses`,()=>{
  for(const signal of ['started','review_rework','needs_clarification']){
   const o=invoke(mode,{},[signal,'why']).body;
   assert.equal(o.status,signal);assert.equal(o.eventType,'manual_status');assert.equal(o.completionVerified,false);
  }
 });
}
test('ready_for_review is refused without an upstream, from a dirty tree, and posts when pushed',()=>{
 let r=gateRun(repo);assert.equal(r.status,2);assert.equal(r.posted,false);assert.match(r.stderr,/no upstream/);
 writeFileSync(join(pushed,'dirty.txt'),'x');
 r=gateRun(pushed);assert.equal(r.status,2);assert.equal(r.posted,false);assert.match(r.stderr,/uncommitted/);
 rmSync(join(pushed,'dirty.txt'));
 r=gateRun(pushed);assert.equal(r.status,0,r.stderr);assert.equal(r.posted,true);
});
test('missing serializers fail closed with a diagnostic',()=>{
 const r=invoke('neither',{hook_event_name:'Stop'});assert.equal(r.body,null);assert.match(r.stderr,/Node or Python 3/);
});
test('runtime templates report prompts, identify producer, and do not install noisy hooks',()=>{
 for(const [file,runtime] of [['claude-settings-hooks.json','claude'],['codex-hooks.json','codex'],['grok-hooks.json','grok']]){
  const {hooks}=JSON.parse(readFileSync(join(hooksDir,file),'utf8'));
  assert.ok(hooks.UserPromptSubmit);assert.ok(hooks.SessionEnd);assert.equal(hooks.PostToolUse,undefined);assert.equal(hooks.SubagentStop,undefined);
  for(const entries of Object.values(hooks)) for(const e of entries)for(const h of e.hooks)assert.match(h.command,new RegExp(`WF_HOOK_RUNTIME=${runtime} `));
 }
});
test.after(()=>rmSync(temp,{recursive:true,force:true}));
