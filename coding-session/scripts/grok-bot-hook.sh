#!/usr/bin/env bash
# One status poster for all runtimes. v2 preserves event identity; finished is only a candidate.
set -euo pipefail
[[ -n "${WF_GROK_BOT_HOOK:-}" && -n "${WF_GROK_BOT_TOKEN:-}" ]] || exit 0
ROOT="${CLAUDE_PROJECT_DIR:-${GROK_WORKSPACE_ROOT:-${CODEX_WORKSPACE_ROOT:-}}}"
[[ -n "$ROOT" ]] || ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 0
# Manual reports must not block waiting for terminal input.
if [[ -n "${1:-}" ]]; then PAYLOAD='{}'; else PAYLOAD="$(cat || true)"; fi
export WF_HOOK_PAYLOAD="$PAYLOAD"
export WF_HOOK_STATUS_OVERRIDE="${1:-}"
export WF_HOOK_MESSAGE_OVERRIDE="${2:-}"
export WF_HOOK_EVENT_ENV="${GROK_HOOK_EVENT:-${CODEX_HOOK_EVENT:-}}"

# A review-ready claim must at least be committed, pushed and have a PR. This gate tells
# the agent locally; the controller still verifies required checks and evidence on the head.
if [[ "${1:-}" == "ready_for_review" ]]; then
  gate() { printf 'grok hook: not ready_for_review: %s\n' "$1" >&2; exit 2; }
  [[ -z "$(git status --porcelain 2>/dev/null)" ]] || gate 'working tree has uncommitted changes'
  upstream="$(git rev-parse '@{u}' 2>/dev/null || true)"
  [[ -n "$upstream" ]] || gate 'branch has no upstream; push it first'
  [[ "$(git rev-parse HEAD)" == "$upstream" ]] || gate 'HEAD differs from the pushed branch'
  if command -v gh >/dev/null 2>&1; then
    gh pr view --json url -q .url >/dev/null 2>&1 || gate 'no open PR for this branch'
  fi
fi

if command -v node >/dev/null 2>&1; then
  BODY="$(node <<'NODE'
const {execFileSync} = require('child_process');
const {randomUUID} = require('crypto');
const E = process.env;
const sh = (cmd, args) => { try { return execFileSync(cmd, args, {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch { return ''; } };
const scalar = x => ['string','number'].includes(typeof x) ? String(x) : '';
let event;
try { event = JSON.parse(E.WF_HOOK_PAYLOAD || '{}'); } catch { process.exit(0); }
if (!event || typeof event !== 'object' || Array.isArray(event)) process.exit(0);
const runtime = x => ({'claude-code':'claude','claude_code':'claude','codex-cli':'codex','grok-cli':'grok'}[String(x).toLowerCase()] || String(x).toLowerCase());
const configured = runtime(E.WF_HOOK_RUNTIME || '');
const reported = runtime(scalar(event.runtime || event.agent_runtime || event.harness));
const expected = runtime(E.WF_HOOK_EXPECTED_RUNTIME || '');
if ((configured && reported && configured !== reported) || (expected && (configured || reported) !== expected)) process.exit(0);
const agent = configured || reported || 'unknown';
const raw = scalar(event.rawEventType || event.hook_event_name || event.hookEventName || event.event || E.WF_HOOK_EVENT_ENV);
const key = raw.replace(/[_-]/g,'').toLowerCase();
// Tool activity and child completion never announce completion of the parent session.
if (['posttooluse','posttoolusefailure','pretooluse','subagentstop'].includes(key)) process.exit(0);
const map = {sessionstart:['working','session_started'],userpromptsubmit:['working','prompt_submitted'],notification:['blocked','notification'],permissionrequest:['blocked','permission_requested'],stop:['finished','turn_stopped'],sessionend:['finished','session_ended']};
const override = E.WF_HOOK_STATUS_OVERRIDE;
const MANUAL = ['working','stuck','blocked','finished','failed','started','ready_for_review','review_rework','needs_clarification'];
if (override && !MANUAL.includes(override)) process.exit(0);
const pair = override ? [override,'manual_status'] : map[key];
if (!pair) process.exit(0);
const sessionId = scalar(event.session_id || event.sessionId || E.WF_HOOK_SESSION_ID);
const terminalId = scalar(event.terminal_id || event.terminalId || E.WF_HOOK_TERMINAL_ID);
const launchAttemptId = E.WF_HOOK_LAUNCH_ATTEMPT_ID || '';
if ((E.WF_HOOK_EXPECTED_SESSION_ID && sessionId !== E.WF_HOOK_EXPECTED_SESSION_ID) || (E.WF_HOOK_TERMINAL_ID && terminalId !== E.WF_HOOK_TERMINAL_ID)) process.exit(0);
const branch = sh('git',['rev-parse','--abbrev-ref','HEAD']);
const ignored = new Set('utf iso rfc utc ipv sha aes rgb tls ssl http https node react vue next nuxt php java python ruby rust swift kotlin ios android macos win x86 arm es ecma pr gh issue part step v'.split(' '));
const ticketOf = text => { for (const m of text.matchAll(/(?:^|[^A-Za-z0-9])([A-Za-z]{2,10})[-_](\d+)(?![A-Za-z0-9])/g)) if (!ignored.has(m[1].toLowerCase())) return `${m[1].toUpperCase()}-${m[2]}`; return ''; };
const ticket = ticketOf(branch) || ticketOf(sh('git',['log','-1','--pretty=%s']));
const remote = sh('git',['remote','get-url','origin']);
const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
const repo = match ? match[2] : require('path').basename(process.cwd());
const repoFullName = match ? `${match[1]}/${match[2]}` : '';
const pr = sh('gh',['pr','view','--json','url','-q','.url']);
const sourceEventId = scalar(event.event_id || event.eventId);
const message = E.WF_HOOK_MESSAGE_OVERRIDE || scalar(event.message || event.title || event.last_assistant_message) || raw || pair[0];
const body = {schemaVersion:2,ticket,repo,repoFullName,branch,status:pair[0],message:[...message].slice(0,500).join(''),
  eventId:randomUUID(),sourceEventId:sourceEventId || null,rawEventType:raw || 'ManualStatus',eventType:pair[1],runtime:agent,
  sessionId:sessionId || null,terminalId:terminalId || null,launchAttemptId:launchAttemptId || null,
  observedAt:new Date().toISOString(),headSha:sh('git',['rev-parse','HEAD']) || null,
  completionVerified:false};
if (pr) body.pr = pr;
process.stdout.write(JSON.stringify(body));
NODE
)" || { printf '%s\n' 'grok hook: event serialization failed' >&2; exit 0; }
elif command -v python3 >/dev/null 2>&1; then
  BODY="$(python3 <<'PYTHON'
import os,json,subprocess,re,uuid,datetime
E=os.environ
def sh(*args):
    try: return subprocess.check_output(args,stdin=subprocess.DEVNULL,stderr=subprocess.DEVNULL,text=True).strip()
    except (OSError,subprocess.SubprocessError): return ''
def scalar(v): return str(v) if isinstance(v,(str,int,float)) and not isinstance(v,bool) else ''
try: event=json.loads(E.get('WF_HOOK_PAYLOAD','{}'))
except (ValueError,TypeError): raise SystemExit(0)
if not isinstance(event,dict): raise SystemExit(0)
def runtime(v):
    v=str(v).lower()
    return {'claude-code':'claude','claude_code':'claude','codex-cli':'codex','grok-cli':'grok'}.get(v,v)
configured=runtime(E.get('WF_HOOK_RUNTIME',''))
reported=runtime(scalar(event.get('runtime') or event.get('agent_runtime') or event.get('harness')))
expected=runtime(E.get('WF_HOOK_EXPECTED_RUNTIME',''))
if (configured and reported and configured!=reported) or (expected and (configured or reported)!=expected): raise SystemExit(0)
agent=configured or reported or 'unknown'
raw=scalar(event.get('rawEventType') or event.get('hook_event_name') or event.get('hookEventName') or event.get('event') or E.get('WF_HOOK_EVENT_ENV'))
key=re.sub('[_-]','',raw).lower()
if key in ('posttooluse','posttoolusefailure','pretooluse','subagentstop'): raise SystemExit(0)
events={'sessionstart':('working','session_started'),'userpromptsubmit':('working','prompt_submitted'),'notification':('blocked','notification'),'permissionrequest':('blocked','permission_requested'),'stop':('finished','turn_stopped'),'sessionend':('finished','session_ended')}
override=E.get('WF_HOOK_STATUS_OVERRIDE')
if override and override not in ('working','stuck','blocked','finished','failed','started','ready_for_review','review_rework','needs_clarification'): raise SystemExit(0)
pair=(override,'manual_status') if override else events.get(key)
if not pair: raise SystemExit(0)
session=scalar(event.get('session_id') or event.get('sessionId') or E.get('WF_HOOK_SESSION_ID'))
terminal=scalar(event.get('terminal_id') or event.get('terminalId') or E.get('WF_HOOK_TERMINAL_ID'))
launch=E.get('WF_HOOK_LAUNCH_ATTEMPT_ID','')
if (E.get('WF_HOOK_EXPECTED_SESSION_ID') and session!=E['WF_HOOK_EXPECTED_SESSION_ID']) or (E.get('WF_HOOK_TERMINAL_ID') and terminal!=E['WF_HOOK_TERMINAL_ID']): raise SystemExit(0)
branch=sh('git','rev-parse','--abbrev-ref','HEAD')
ignored=set('utf iso rfc utc ipv sha aes rgb tls ssl http https node react vue next nuxt php java python ruby rust swift kotlin ios android macos win x86 arm es ecma pr gh issue part step v'.split())
def ticket_of(text):
    for m in re.finditer(r'(?:^|[^A-Za-z0-9])([A-Za-z]{2,10})[-_](\d+)(?![A-Za-z0-9])',text):
        if m[1].lower() not in ignored: return m[1].upper()+'-'+m[2]
    return ''
ticket=ticket_of(branch) or ticket_of(sh('git','log','-1','--pretty=%s'))
match=re.search(r'github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$',sh('git','remote','get-url','origin'))
repo=match[2] if match else os.path.basename(os.getcwd())
full=match[1]+'/'+match[2] if match else ''
pr=sh('gh','pr','view','--json','url','-q','.url')
source=scalar(event.get('event_id') or event.get('eventId'))
message=E.get('WF_HOOK_MESSAGE_OVERRIDE') or scalar(event.get('message') or event.get('title') or event.get('last_assistant_message')) or raw or pair[0]
body=dict(schemaVersion=2,ticket=ticket,repo=repo,repoFullName=full,branch=branch,status=pair[0],message=message[:500],eventId=str(uuid.uuid4()),sourceEventId=source or None,rawEventType=raw or 'ManualStatus',eventType=pair[1],runtime=agent,sessionId=session or None,terminalId=terminal or None,launchAttemptId=launch or None,observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),headSha=sh('git','rev-parse','HEAD') or None,completionVerified=False)
if pr: body['pr']=pr
print(json.dumps(body),end='')
PYTHON
)" || { printf '%s\n' 'grok hook: event serialization failed' >&2; exit 0; }
else
  printf '%s\n' 'grok hook: Node or Python 3 is required for safe JSON serialization; no event posted' >&2
  exit 0
fi
[[ -n "$BODY" ]] || exit 0
# Bounded, best-effort notification. Controller reconciliation covers missed deliveries.
# A receiver must deduplicate eventId and independently deduplicate workflow actions.
curl --fail --silent --show-error --connect-timeout 3 --max-time 8 \
  -X POST "$WF_GROK_BOT_HOOK" -H "Authorization: Bearer $WF_GROK_BOT_TOKEN" \
  -H 'Content-Type: application/json' --data "$BODY" >/dev/null || true
