# Slack Bot Integration — Installation & Debug Log

**Date:** 2026-07-09 / 2026-07-10  
**Scope:** myPKA Cockpit (`Expansions/mypka-cockpit`)  
**Outcome:** ✅ Fully working — Larry responds to Slack DMs via `agy`

---

## Overview

This document records the full journey of adding a Slack bot to the myPKA Cockpit server, from initial implementation through every failure and fix, ending with a working integration where DMs to the bot are answered by **Larry** (the myPKA team orchestrator).

---

## Part 1 — Implementation

### What was built

A new module `server/slack.js` was added to the Cockpit, exporting a single function `initSlackBot()` that is called from `server/server.js` at startup.

The bot uses **@slack/bolt in Socket Mode** — no public webhook URL required, no firewall exceptions, works on a local machine behind NAT.

**Flow:**
1. User sends a DM to the bot in Slack
2. Bolt receives the event via the persistent WebSocket (Socket Mode)
3. Bot posts `_Larry is processing your request..._` as immediate acknowledgment
4. Bot spawns `agy --dangerously-skip-permissions --add-dir <workspace> -p "<prompt>"` as a child process
5. `agy` responds; the bot posts the reply back to the DM channel

### Files changed

| File | Change |
|---|---|
| `server/slack.js` | New file — full Slack bot implementation |
| `server/server.js` | Added `import { initSlackBot } from './slack.js'` and `await initSlackBot()` call |
| `package.json` | Added `@slack/bolt` dependency |
| `scripts/test-slack-bot.sh` | New — curl-based test suite |

---

## Part 2 — Manual Configurations Required

> [!IMPORTANT]
> These steps must be performed manually. They cannot be scripted.

### 2.1 Create a Slack App

1. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**
2. Name it (e.g. `help-me` or `Larry`) and select your workspace
3. Note the **App ID** for reference

### 2.2 Enable Socket Mode

1. In your app's settings → **Socket Mode** (left sidebar)
2. Toggle **Enable Socket Mode** → ON
3. When prompted, create an **App-Level Token**:
   - Name: `cockpit-socket` (or anything)
   - Scope: **`connections:write`**
4. Copy the token — it starts with `xapp-`. This is your **`SLACK_APP_TOKEN`**

### 2.3 Configure Bot Token Scopes

1. Go to **OAuth & Permissions** → **Bot Token Scopes**
2. Add these scopes:
   - `chat:write` — required to post messages
   - `im:history` — required to read DM history

> [!NOTE]
> `im:write` (to open DM channels via API) was **not** added. This means the bot can only respond to DMs that users initiate first. The bot cannot programmatically open a DM with a user. This is acceptable for the current use case.

### 2.4 Subscribe to Events

1. Go to **Event Subscriptions** → Toggle **Enable Events** → ON
2. Under **Subscribe to bot events**, add:
   - `message.im` — fires when a user sends a DM to the bot

### 2.5 Install the App to Your Workspace

1. Go to **OAuth & Permissions** → **Install to Workspace**
2. Authorise the app
3. Copy the **Bot User OAuth Token** — it starts with `xoxb-`. This is your **`SLACK_BOT_TOKEN`**

### 2.6 Add Tokens to `.env`

Edit `Team Knowledge/.env` and add:

```dotenv
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-level-token-here
MYPKA_AGY_DIR=/Users/alan/Documents/GitHub/myPKA
```

> [!IMPORTANT]
> `MYPKA_AGY_DIR` must be the **symlink path** (e.g. `/Users/alan/Documents/GitHub/myPKA`), **not** the Dropbox physical path (`/Users/alan/Dropbox/Mac (2)/Documents/GitHub/myPKA`). See Bug 3 below for why.

### 2.7 Install npm dependency

```bash
cd Expansions/mypka-cockpit
npm install @slack/bolt
```

### 2.8 Starting the server

```bash
cd Expansions/mypka-cockpit
NODE_ENV=production PORT=4317 WORKBENCH_WRITE_ENABLED=1 PLAN_WRITE_ENABLED=1 node server/server.js
```

No extra environment variables needed — everything is read from `Team Knowledge/.env`.

---

## Part 3 — Bugs Encountered & Fixed

### Bug 1: `shq` and `llmCmd` not defined — `ReferenceError` on every message

**Symptom:** Bot received messages but crashed silently; no `agy` was ever spawned.

**Root cause:** During earlier refactoring, the `shq()` shell-quoting helper and the `llmCmd` command string were removed from `slack.js` but were still referenced inside the `app.message` callback on line 88.

**Fix:** Added to the top of `slack.js`:

```js
function shq(str) {
  return "'" + String(str).replace(/'/g, "'\\''") + "'";
}

const AGY_BIN = process.env.AGY_BIN || 'agy';
```

And inside `initSlackBot()`, after tokens are read:

```js
const AGY_WORKDIR = readEnvKey('MYPKA_AGY_DIR') || REPO_ROOT;
const llmCmd = `cd ${shq(AGY_WORKDIR)} && ${AGY_BIN} --dangerously-skip-permissions --add-dir ${shq(AGY_WORKDIR)}`;
```

---

### Bug 2: `agy` hangs indefinitely — no response ever posted

**Symptom:** Bot posted the acknowledgment message (`_Larry is processing..._`) but the response never arrived. `agy` processes were visible in `ps aux` and had been running for 18+ minutes.

**Root cause:** `exec()` from Node's `child_process` was used to spawn `agy`. When a child process inherits the parent's stdio and there is no TTY, `agy` blocked waiting for stdin input — even when invoked with `-p` (print mode).

**Diagnosis:**
```bash
ps aux | grep agy
# showed multiple hung processes:
# alan  12402  agy -p are you alive
# alan  12133  agy -p who are you
```

The test script `scripts/test-slack-exec.js` also confirmed: after ~1099 seconds, `agy` exited with error code (non-zero), with an empty stderr.

**Fix:** Replaced `exec()` with `spawn()` using `stdio: ['ignore', 'pipe', 'pipe']` so stdin is explicitly closed:

```js
const child = spawn('/bin/sh', ['-c', command], {
  env: cleanEnv,
  stdio: ['ignore', 'pipe', 'pipe'],   // ← key fix: stdin closed
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { stderr += d; });

const timeout = setTimeout(() => {
  child.kill('SIGTERM');
}, 120_000);   // 2-minute hard timeout

child.on('close', async (code) => {
  clearTimeout(timeout);
  // ... post response to Slack
});
```

Also added `--dangerously-skip-permissions` to the `agy` command so it never pauses to prompt for tool approval when running headless.

---

### Bug 3: `agy` responds as "Antigravity" instead of "Larry"

**Symptom:** Bot responded (after Bug 2 was fixed), but identified itself as "Antigravity, a powerful agentic AI coding assistant designed by the Google DeepMind team" rather than Larry.

**Root cause — two interacting issues:**

**3a. Wrong working directory (symlink vs. real path)**

`REPO_ROOT` (from `server/repoRoot.js`) resolves to the physical Dropbox path:
```
/Users/alan/Dropbox/Mac (2)/Documents/GitHub/myPKA
```

But `agy`'s registered workspace is the symlink path:
```
/Users/alan/Documents/GitHub/myPKA
```

`agy` maps workspaces by the path used at registration time. The mismatch caused workspace rules (`AGENTS.md`, `GEMINI.md`) to fail to match, so `agy` fell back to its default Antigravity persona.

**Fix:** Added `MYPKA_AGY_DIR` to `Team Knowledge/.env` pinned to the symlink path, and read it via `readEnvKey()` inside `initSlackBot()`.

**3b. `agy -p` (print mode) does not auto-load workspace rules**

Even with the correct path, `agy -p` starts a fresh session without loading `GEMINI.md` or `AGENTS.md` from the working directory. This is different from interactive `agy` (`agy -c`) which loads workspace rules on session start.

**Fix 1:** Prepend the contents of `GEMINI.md` to every prompt so the identity context is injected at the model level:

```js
let systemPrefix = '';
try {
  const geminiMd = fs.readFileSync(path.join(AGY_WORKDIR, 'GEMINI.md'), 'utf8');
  systemPrefix = geminiMd.trim() + '\n\n---\n\n';
} catch { /* proceed without prefix */ }

const fullPrompt = systemPrefix + text;
const command = `${llmCmd} -p ${shq(fullPrompt)}`;
```

This made Larry respond with the correct identity ("I'm Larry, your team orchestrator at myPKA") but he couldn't read `AGENTS.md` — he said "no active workspace is set."

**Fix 2:** Add `--add-dir <workspace>` flag so `agy` explicitly loads the workspace in print mode:

```js
const llmCmd = `cd ${shq(AGY_WORKDIR)} && ${AGY_BIN} --dangerously-skip-permissions --add-dir ${shq(AGY_WORKDIR)}`;
```

With both fixes applied, Larry responded correctly:

> *"I'm Larry, your team orchestrator at myPKA. (Running on Claude Sonnet, via the Antigravity CLI.) I coordinate the team — Penn, Pax, Nolan, Mack, and Silas — and handle session logging, library hygiene, and routing your requests to the right specialist. What can I help you with today, Alan?"*

---

## Part 4 — Test Suite

A curl-based test suite was created at `scripts/test-slack-bot.sh`.

**What it tests:**
1. `auth.test` — verifies the bot token is valid
2. `conversations.open` — attempts to open a DM channel (requires `im:write` scope; currently skipped)
3. Three test prompts posted to the DM channel

**Usage:**
```bash
# Set your Slack User ID (click your profile → Copy member ID)
SLACK_TEST_USER=U6C8J4BS8 bash scripts/test-slack-bot.sh
```

> [!NOTE]
> The bot token does not have `im:write` or `users:read` scope, so the test suite cannot programmatically look up user IDs or open DM channels via API. Test prompts are sent to the known DM channel ID (`D0BGFQPCG12`). The real end-to-end test is simply DMing the bot in Slack directly.

**Finding the DM channel ID:** Send one DM to the bot manually. The channel ID (`D...`) appears in the server log on the `message handler triggered` line.

---

## Part 5 — Final Architecture

```
Slack User DM
     │
     ▼
Slack API (Socket Mode WebSocket)
     │
     ▼
@slack/bolt App listener (server/slack.js)
     │
     ├─► POST chat.postMessage: "Larry is processing..."
     │
     └─► spawn('/bin/sh', ['-c', command], { stdio: ['ignore','pipe','pipe'] })
              │
              └─► cd /Users/alan/Documents/GitHub/myPKA
                   && agy --dangerously-skip-permissions
                         --add-dir /Users/alan/Documents/GitHub/myPKA
                         -p "<GEMINI.md contents>\n---\n<user message>"
                              │
                              └─► Larry responds (AGENTS.md loaded via --add-dir)
                                       │
                                       ▼
                              POST chat.postMessage: <Larry's response>
                                       │
                                       ▼
                              Slack DM ← User sees reply
```

---

## Part 6 — Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| Each DM spawns a fresh `agy` session | No conversation memory between messages | User must re-establish context each session |
| Slack message limit ~4000 chars | Long responses truncated | Bot appends `*(Truncated)*` notice |
| 2-minute hard timeout | Very long `agy` tasks fail | Increase `120_000` in `slack.js` if needed |
| Bot ignores messages from itself (`bot_id` check) | Test prompts sent via API are skipped | Test by DMing the bot as a real user |
| No `im:write` scope | Bot cannot initiate DMs proactively | Add scope in api.slack.com if needed |

---

## Part 7 — Useful Commands

```bash
# Start the server (reads all config from Team Knowledge/.env)
cd Expansions/mypka-cockpit
NODE_ENV=production PORT=4317 WORKBENCH_WRITE_ENABLED=1 PLAN_WRITE_ENABLED=1 node server/server.js

# Kill any hung agy processes
pkill -f "agy -p"

# Run the curl test suite
SLACK_TEST_USER=U6C8J4BS8 bash scripts/test-slack-bot.sh

# Tail the live server log (replace TASK_ID with the running task)
tail -f ~/.gemini/antigravity-cli/brain/<CONVERSATION_ID>/.system_generated/tasks/<TASK_ID>.log
```

---

## Part 8 — Key Learnings for Future Reference

1. **`agy -p` does not load workspace rules** — must use `--add-dir <path>` AND inject `GEMINI.md` content as a prompt prefix
2. **`exec()` hangs when `agy` has no TTY** — always use `spawn()` with `stdio: ['ignore', 'pipe', 'pipe']` for headless invocations
3. **`REPO_ROOT` resolves to the Dropbox physical path** — pin `MYPKA_AGY_DIR` in `.env` to the symlink path that `agy` was registered against
4. **Socket Mode works reliably** — no public URL, no ngrok, no firewall config needed; runs on any local machine with internet access
5. **`--dangerously-skip-permissions`** is required for headless `agy` — without it, `agy` pauses waiting for the user to approve tool calls
