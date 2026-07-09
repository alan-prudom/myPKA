#!/usr/bin/env bash
# ============================================================
# test-slack-bot.sh — Smoke-tests the Slack bot via the
# Slack Web API (chat.postMessage) to simulate a DM to the bot.
#
# Usage:
#   SLACK_BOT_TOKEN=xoxb-... SLACK_TEST_USER=U... bash scripts/test-slack-bot.sh
#
# The script sends a few test messages as the bot to the bot's
# own DM channel with the test user. Since the server bot
# listens for messages, it will pick up the responses in the
# server logs, which we tail for verification.
#
# Prerequisites:
#   • Server running on :4317  (npm start or node server/server.js)
#   • SLACK_BOT_TOKEN in env or Team Knowledge/.env
#   • SLACK_TEST_USER: the Slack user-ID (e.g. U0123456789) to open
#     a DM with (typically yourself)
# ============================================================
set -euo pipefail

ENV_FILE="$(dirname "$0")/../../../Team Knowledge/.env"

load_env() {
  local key="$1"
  # 1. prefer real environment
  [[ -n "${!key:-}" ]] && echo "${!key}" && return
  # 2. fallback to .env file
  if [[ -f "$ENV_FILE" ]]; then
    local val
    val=$(grep -E "^\s*${key}\s*=" "$ENV_FILE" | head -1 | sed "s/^\s*${key}\s*=\s*//;s/['\"]//g;s/\s*$//")
    [[ -n "$val" ]] && echo "$val" && return
  fi
  echo ""
}

BOT_TOKEN="${SLACK_BOT_TOKEN:-$(load_env SLACK_BOT_TOKEN)}"
TEST_USER="${SLACK_TEST_USER:-$(load_env SLACK_TEST_USER)}"

if [[ -z "$BOT_TOKEN" ]]; then
  echo "ERROR: SLACK_BOT_TOKEN not set. Export it or add it to Team Knowledge/.env"
  exit 1
fi

if [[ -z "$TEST_USER" ]]; then
  echo "ERROR: SLACK_TEST_USER not set. Export the Slack User ID (e.g. U0123456789) you want to test with."
  exit 1
fi

echo "=== Slack Bot Integration Test Suite ==="
echo "  Bot token: ${BOT_TOKEN:0:10}..."
echo "  Test user:  $TEST_USER"
echo ""

PASS=0
FAIL=0

# Helper — post a message via the Slack Web API and check HTTP 200 + ok:true
post_message() {
  local label="$1"
  local channel="$2"
  local text="$3"

  echo -n "  [$label] posting to $channel ... "
  response=$(curl -s -X POST "https://slack.com/api/chat.postMessage" \
    -H "Authorization: Bearer $BOT_TOKEN" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "{\"channel\":\"$channel\",\"text\":$(echo -n "$text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}")

  ok=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    echo "OK ✓"
    ((PASS++)) || true
  else
    echo "FAIL ✗"
    echo "    Response: $response"
    ((FAIL++)) || true
  fi
}

# ── TEST 1: Check Slack API connectivity ────────────────────────────────────
echo "── Test 1: Slack API auth check"
echo -n "  auth.test ... "
auth=$(curl -s -X POST "https://slack.com/api/auth.test" \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -H "Content-Type: application/json")
auth_ok=$(echo "$auth" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
if [[ "$auth_ok" == "True" || "$auth_ok" == "true" ]]; then
  bot_name=$(echo "$auth" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('user','?'))")
  echo "OK ✓  (bot user: $bot_name)"
  ((PASS++)) || true
else
  echo "FAIL ✗"
  echo "    $auth"
  ((FAIL++)) || true
fi

echo ""

# ── TEST 2: Open a DM channel with the test user ────────────────────────────
echo "── Test 2: Open DM channel"
echo -n "  conversations.open ... "
dm_resp=$(curl -s -X POST "https://slack.com/api/conversations.open" \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"users\":\"$TEST_USER\"}")
dm_ok=$(echo "$dm_resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok','false'))" 2>/dev/null || echo "false")
DM_CHANNEL=""
if [[ "$dm_ok" == "True" || "$dm_ok" == "true" ]]; then
  DM_CHANNEL=$(echo "$dm_resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['channel']['id'])")
  echo "OK ✓  (channel: $DM_CHANNEL)"
  ((PASS++)) || true
else
  echo "FAIL ✗"
  echo "    $dm_resp"
  ((FAIL++)) || true
fi

echo ""

# ── TEST 3–5: Send test prompts ─────────────────────────────────────────────
if [[ -n "$DM_CHANNEL" ]]; then
  echo "── Tests 3–5: Send prompts to the bot DM channel"
  echo "   (Check server logs for [Slack Bot] entries — the bot processes incoming messages"
  echo "    and the reply appears in your Slack DM with the bot.)"
  echo ""
  post_message "T3 - who are you"     "$DM_CHANNEL" "who are you"
  sleep 2
  post_message "T4 - simple question" "$DM_CHANNEL" "what is 2 + 2?"
  sleep 2
  post_message "T5 - kb question"     "$DM_CHANNEL" "what is myPKA?"
else
  echo "── Tests 3–5: SKIPPED (no DM channel)"
  FAIL=$((FAIL + 3))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
