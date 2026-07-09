# Exploration Note: Cockpit LAN Exposure & Messenger Integrations

**Date:** 2026-07-09  
**Author:** Larry (Orchestrator)  
**Status:** Shared Input (Orphan Deliverable)  
**Topic:** [[ai-tooling|AI Tooling]] / [[vr-data-committee|Data & Tech Committee]]  

---

## Executive Summary

This exploration note evaluates two major interaction features for the myPKA system:
1. **Network Exposure:** Safely exposing the local myPKA Cockpit dashboard to a private Tailscale network so it can be accessed from mobile phones and tablets.
2. **Messenger Integrations:** Setting up a direct chat connection to myPKA agents (like Larry, Penn, or Silas) from external chat applications.

---

## 1. Exposing the Cockpit via Tailscale

Tailscale assigns each device a secure, encrypted IP address (`100.x.y.z`). Exposing the Cockpit on this interface allows access from any Tailscale-connected device without exposing data to the public internet.

### Security Architecture (Fail-Closed)
By default, the myPKA Cockpit binds to `127.0.0.1` (loopback only) to ensure absolute privacy. Exposing it to the network requires binding to `0.0.0.0`. 
Because the vault contains highly sensitive records (daily journals, identity documents, and CRM profiles), the Cockpit implements a **fail-closed gate**:
> [!IMPORTANT]
> If network exposure is enabled (`COCKPIT_BIND_LAN=1`), the server **will refuse to start** unless a secure access PIN has been configured. When external devices attempt to connect, they are greeted by an authentication prompt.

### Step-by-Step Setup
1. **Configure the Access PIN:**
   From the `Expansions/mypka-cockpit/` directory, run:
   ```bash
   npm run set-pin
   ```
   This prompts for a PIN, hashes it using `scrypt`, and writes the hash (`COCKPIT_PIN_HASH=...`) to your gitignored `Team Knowledge/.env` file.
2. **Launch the Server in LAN Mode:**
   Run the launcher script with the LAN bind environment variable:
   ```bash
   COCKPIT_BIND_LAN=1 ./start-cockpit.command
   ```
3. **Connect from Other Devices:**
   Get your Mac's Tailscale IP (e.g. `100.123.45.67`) and open a browser on your phone/tablet to:
   ```
   http://100.123.45.67:4317/
   ```
   Enter the configured PIN to log in.

---

## 2. Messenger App Integrations for Agent Interaction

To interact with your myPKA agents (Larry, Silas, Mack, etc.) via text, we evaluated four primary channels:

| Interface | Setup Complexity | Cost / Limits | Network Requirements | Best Used For |
|---|---|---|---|---|
| **Cockpit Web Chat** | Low | Free | Local Loopback / Tailscale | Desk work, managing files, viewing markdown inline |
| **Telegram Bot** | Low | Free | Outgoing Long-Polling (No open ports) | Quick text inputs & reminders on the go |
| **Slack App (Socket Mode)** | Medium | Free | WebSockets Stream (No open ports) | Rich interactive elements (checklists, buttons) |
| **WhatsApp Sandbox** | High | Paid/Trial | Webhooks Tunnel (Ngrok or Public IP) | Native WhatsApp access, but limited by API sandboxes |

### Detailed Options Analysis

#### Option A: Cockpit Web Chat (Internal UI)
* **Description:** Add a chat panel route (e.g. `/chat`) directly inside the existing React frontend client of the Cockpit.
* **Mechanism:** The Cockpit's node server routes incoming chat messages to the local agent context.
* **Security:** 100% private, no external APIs needed, no data leaves the local machine.

#### Option B: Telegram Bot (Simplest External)
* **Description:** Setting up a Telegram bot via `@BotFather` and running a simple Python polling script on your Mac.
* **Mechanism:** The script runs `uv run --with python-telegram-bot` and calls the `getUpdates` API. Since it pulls data from Telegram, it works behind home firewalls without opening incoming ports.
* **Security:** Messages travel through Telegram's servers, but no hosting configuration is required.

#### Option C: Slack App via Socket Mode (Firewall-Friendly)
* **Description:** An app registered at `api.slack.com` configured to use **Socket Mode**.
* **Mechanism:** Uses the `@slack/bolt` SDK to open a persistent WebSocket connection to Slack. Slack pushes messaging events down this pipe, bypassing firewalls and routers.
* **Security:** Extremely clean; allows complex interactive Slack "blocks" (buttons, cards, checklists) to manage tasks directly.

#### Option D: WhatsApp Bot
* **Description:** Automating interactions inside WhatsApp using a Twilio Sandbox account.
* **Mechanism:** Requires setting up a Twilio sandbox. Incoming messages trigger an HTTP webhook, which must be routed to your local machine (requiring an active `ngrok` tunnel or public server).
* **Security:** High setup friction and reliance on third-party webhook routing.

---

## Recommendations & Next Steps

1. **Local Access:** Implement the access PIN (`npm run set-pin`) and test connecting from your phone over Tailscale.
2. **Text Interactions:** 
   * If you want a quick external interface, start with the **Telegram Bot** due to its zero-friction setup.
   * If you prefer rich UI control (managing tasks, ticking boxes) from your daily chat app, we can implement the **Slack Socket Mode** connector.
