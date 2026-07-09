import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = '/Users/alan/Documents/GitHub/myPKA';
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

const botToken = readEnvKey('SLACK_BOT_TOKEN');
const text = "who are you";
const channel = "D0BGFQPCG12";

const shq = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`;
const llmCmd = readEnvKey('COCKPIT_LLM_CMD') || 'agy';
const command = `cd ${shq(REPO_ROOT)} && ${llmCmd} -p ${shq(text)}`;

const cleanEnv = {
  HOME: process.env.HOME,
  PATH: process.env.PATH
};

console.log(`Command to run: ${command}`);
console.log('Spawning process...');

const startTime = Date.now();
exec(command, { env: cleanEnv, maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
  const duration = (Date.now() - startTime) / 1000;
  console.log(`Process finished in ${duration}s. error=${!!error}`);
  
  let responseText = '';
  if (error) {
    console.error(`Command error:`, error.message);
    responseText = `*Error running agent:* ${error.message}\n\`\`\`\n${stderr}\n\`\`\``;
  } else {
    console.log(`Stdout: ${stdout}`);
    console.log(`Stderr: ${stderr}`);
    responseText = stdout.trim() || '_Larry completed the task with no text output._';
  }

  // Try to post to Slack
  console.log(`Posting response to Slack...`);
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        channel: channel,
        text: `*Test Execution Result (${duration}s):*\n${responseText.substring(0, 3000)}`
      })
    });
    const resJson = await res.json();
    console.log(`Slack API Response:`, JSON.stringify(resJson));
  } catch (err) {
    console.error(`Slack Post Error:`, err);
  }
});
