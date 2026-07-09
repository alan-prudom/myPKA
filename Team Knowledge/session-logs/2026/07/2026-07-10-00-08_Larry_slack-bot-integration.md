---
date: 2026-07-10
agent: Larry
type: close-session
topic: slack-bot-integration
---

# Session Log — Slack Bot Integration & Debug

**Date:** 2026-07-10  
**Agent:** Larry (orchestrating; Mack-domain work)  
**Session type:** close-session  
**Duration:** ~3 hours (extended debug session)

---

## What We Did

Completed the full installation and debugging of the Slack bot integration for the myPKA Cockpit. The bot (`help-me` app on Slack) now accepts DMs and routes them to Larry via `agy`, with fully correct identity (Larry, not Antigravity).

---

## Decisions Made

1. **Socket Mode over webhooks** — no public URL needed; works on local machine behind NAT. Chosen for simplicity and zero infrastructure overhead.
2. **`spawn` over `exec`** — `exec` hangs when `agy` has no TTY; `spawn` with `stdio: ['ignore', 'pipe', 'pipe']` closes stdin explicitly.
3. **GEMINI.md prepended to every prompt** — `agy -p` does not auto-load workspace rules; injecting GEMINI.md content at the prompt level is the reliable workaround.
4. **`--add-dir` flag added** — ensures `agy` loads the workspace (including AGENTS.md) in print mode, giving Larry access to routing rules and specialist contracts.
5. **`MYPKA_AGY_DIR` pinned in `.env`** — `REPO_ROOT` resolves via Dropbox symlink to a physical path `agy` does not recognise; pinning the symlink path fixes workspace matching.
6. **2-minute hard timeout** — prevents zombie `agy` processes if a call hangs.

---

## Insights

- `agy -p` is stateless and context-free by design; identity and workspace must be explicitly injected for every call.
- `REPO_ROOT` in the Cockpit resolves to the Dropbox physical path. Any tool that needs `agy` to match its registered workspace must use the symlink path (`/Users/alan/Documents/GitHub/myPKA`).
- `--dangerously-skip-permissions` is mandatory for all headless `agy` invocations — without it, `agy` blocks waiting for permission approval prompts.
- The Slack bot token scopes currently granted (`chat:write`, `im:history`) are minimal. `im:write` and `users:read` are absent, limiting programmatic DM channel management — acceptable for the current use case.

---

## Files Changed

| File | Change |
|---|---|
| `Expansions/mypka-cockpit/server/slack.js` | Full implementation — shq helper, llmCmd, spawn-based agy invocation, GEMINI.md prefix injection, 2-min timeout |
| `Expansions/mypka-cockpit/server/server.js` | Added `initSlackBot()` call |
| `Expansions/mypka-cockpit/package.json` | Added `@slack/bolt` |
| `Expansions/mypka-cockpit/scripts/test-slack-bot.sh` | New curl-based test suite |
| `Team Knowledge/.env` | Added `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `MYPKA_AGY_DIR` |

---

## Deliverable

Full installation + debug write-up filed at:  
[[Deliverables/2026-07-10-slack-bot-installation-debug-log]]

---

## Open Threads

- **Conversation memory:** Each DM spawns a fresh `agy` session. Larry has no memory between messages. Future enhancement: persist a conversation ID per Slack channel and pass `--continue` to `agy`.
- **Response chunking:** Responses over 3000 chars are truncated. Could be improved with multi-message threading.
- **Slack mention support:** Bot currently only responds to DMs. Could extend to `@mention` in channels via `app_mention` event.

---

## Next Steps (if Alan wants to continue)

1. Test with real myPKA tasks (e.g. "capture today's journal entry", "what are my active projects")
2. Consider adding conversation continuity (`--continue` flag + channel-to-conversation-ID mapping)
3. Optionally add `im:write` scope to allow proactive bot messages
