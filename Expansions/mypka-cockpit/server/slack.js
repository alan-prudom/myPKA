import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { REPO_ROOT } from './db.js';

/** Shell-quote a string so it's safe to embed in a shell command. */
function shq(str) {
  return "'" + String(str).replace(/'/g, "'\\''" ) + "'";
}

/** Path to the agy CLI binary. */
const AGY_BIN = process.env.AGY_BIN || 'agy';

/**
 * Build the agy command that runs in the myPKA workspace.
 * We cd into the repo root so rule files (AGENTS.md / GEMINI.md) resolve correctly.
 */
// AGY_WORKDIR is resolved inside initSlackBot() once readEnvKey is available.
// Fallback order: MYPKA_AGY_DIR env/dotenv → REPO_ROOT.

const ENV_PATH = path.resolve(REPO_ROOT, 'Team Knowledge', '.env');

function readEnvKey(key) {
  if (process.env[key] && process.env[key].trim()) {
    return process.env[key].trim();
  }
  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`));
      if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
    }
  } catch {
    // ignore
  }
  return null;
}

export async function initSlackBot() {
  const botToken = readEnvKey('SLACK_BOT_TOKEN');
  const appToken = readEnvKey('SLACK_APP_TOKEN');
  const AGY_WORKDIR = readEnvKey('MYPKA_AGY_DIR') || REPO_ROOT;
  const llmCmd = `cd ${shq(AGY_WORKDIR)} && ${AGY_BIN} --dangerously-skip-permissions --add-dir ${shq(AGY_WORKDIR)}`;

  if (!botToken || !appToken) {
    console.log('  slack: SLACK_BOT_TOKEN or SLACK_APP_TOKEN missing in .env — bot disabled.');
    return;
  }

  console.log('  slack: Initializing Slack Bot in Socket Mode...');
  
  // Dynamically import @slack/bolt so that if it is not installed or loading fails,
  // it doesn't crash the server boot cycle.
  let bolt;
  try {
    bolt = await import('@slack/bolt');
  } catch (err) {
    console.error('  slack: failed to import @slack/bolt. Run "npm install @slack/bolt".', err.message);
    return;
  }

  const { App } = bolt;
  const app = new App({
    token: botToken,
    appToken: appToken,
    socketMode: true,
  });

  app.error(async (error) => {
    console.error('[Slack Bot] bolt error:', error);
  });

  // Listen to messages (direct messages or mentions)
  app.message(async ({ message, say }) => {
    console.log('[Slack Bot] message handler triggered with message:', JSON.stringify(message));

    // Skip bot messages to prevent loops
    if (message.bot_id) return;
    
    const text = message.text;
    if (!text || !text.trim()) return;

    // Direct message check (channel type 'im' starts with 'D' in Slack ID convention)
    const isDirectMessage = message.channel_type === 'im' || message.channel.startsWith('D');
    
    // In DMs, respond to all messages. In public channels, only respond if app is mentioned
    // (though message listener usually fires on DMs, we should be safe).
    if (!isDirectMessage) return;

    console.log(`[Slack Bot] Passed checks. Received DM text: "${text}"`);
    
    // Acknowledge receipt to the user (gives instant feedback for long-running LLM calls)
    try {
      console.log(`[Slack Bot] Posting acknowledgment to channel: ${message.channel}`);
      await app.client.chat.postMessage({
        token: botToken,
        channel: message.channel,
        text: `_Larry is processing your request..._`
      });
      console.log(`[Slack Bot] Acknowledgment posted.`);
    } catch (postErr) {
      console.error(`[Slack Bot] Failed to post acknowledgment:`, postErr);
    }

    // Prepend the myPKA identity context so agy -p always loads Larry's persona.
    // In print mode, agy starts a blank session — GEMINI.md is not auto-loaded.
    let systemPrefix = '';
    try {
      const geminiMd = fs.readFileSync(path.join(AGY_WORKDIR, 'GEMINI.md'), 'utf8');
      systemPrefix = geminiMd.trim() + '\n\n---\n\n';
    } catch {
      // GEMINI.md missing — proceed without prefix
    }

    const fullPrompt = systemPrefix + text;
    const command = `${llmCmd} -p ${shq(fullPrompt)}`;

    const cleanEnv = {
      HOME: process.env.HOME,
      PATH: process.env.PATH
    };

    console.log(`[Slack Bot] Spawning command: ${command}`);

    // Use spawn with stdin:'ignore' so agy never blocks waiting for a TTY.
    const child = spawn('/bin/sh', ['-c', command], {
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    // Hard 2-minute timeout — kill the child and report error.
    const timeout = setTimeout(() => {
      console.error('[Slack Bot] agy timed out after 120s — killing child.');
      child.kill('SIGTERM');
    }, 120_000);

    child.on('close', async (code) => {
      clearTimeout(timeout);
      console.log(`[Slack Bot] Command process finished. code=${code}`);
      try {
        if (code !== 0) {
          console.error(`[Slack Bot] command exited ${code}:`, stderr.slice(0, 500));
          await app.client.chat.postMessage({
            token: botToken,
            channel: message.channel,
            text: `*Error running agent (exit ${code}):*\n\`\`\`\n${stderr.slice(0, 1000)}\n\`\`\``
          });
          return;
        }

        const response = stdout.trim();
        if (!response) {
          await app.client.chat.postMessage({
            token: botToken,
            channel: message.channel,
            text: `_Larry completed the task with no text output._`
          });
          return;
        }

        // Slack message character limit ~4000 — truncate if needed.
        const chunk = response.length > 3000
          ? response.substring(0, 3000) + '\n\n*(Truncated due to Slack message limits)*'
          : response;
        await app.client.chat.postMessage({
          token: botToken,
          channel: message.channel,
          text: chunk
        });
        console.log(`[Slack Bot] Response posted successfully.`);
      } catch (postResErr) {
        console.error(`[Slack Bot] Failed to post final response:`, postResErr);
      }
    });
  });

  await app.start();
  console.log('  slack: Bot is running and connected via Socket Mode.');
}
