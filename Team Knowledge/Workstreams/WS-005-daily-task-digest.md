# WS-005 - Daily Task Digest

- **Type:** Workstream — a multi-agent composition.
- **Owners:** Mack (scheduling, connection layer), Larry (orchestration, rendering)
- **References:** [[SOP-list-open-tasks]], [[Team/Mack - Automation Specialist/AGENTS]], [[Team/Larry - Orchestrator/AGENTS]]
- **Trigger:** Time-based cron trigger (e.g., daily at 08:00 AM) or manual "run digest" trigger.
- **Version:** 1.0.0 (2026-07-08)

## Purpose

Walk the tasks folder, check for open, in-progress, blocked, and stale tasks, compile a summary digest, and make it available to the user. This ensures alignment on outstanding actions without needing to manually audit the tasks directory.

## Choreography

### Step 1 - Trigger (Mack)

The workstream is triggered in one of two ways:
1. **Scheduled:** Mack registers a recurring cron job (default: `0 8 * * *` for daily at 8:00 AM) using the harness scheduling capability.
2. **Manual:** The user triggers the digest directly (e.g., "Larry, run task digest").

### Step 2 - Task walking and compilation (Larry)

Larry runs the procedure in [[SOP-list-open-tasks]] to gather the active state of tasks. Larry compiles this into a structured markdown report:
- **Total stats:** Open, in-progress, blocked, and recently closed count.
- **Urgent items:** Priority 1 tasks.
- **Blocked items:** Tasks in `in-progress/` with a non-null `blocked_reason`.
- **Stale items:** Tasks that have been sitting in `open/` for more than 7 days, or blocked tasks with no updates for more than 3 days.
- **Local action items:** Unchecked checkboxes found in active project files (e.g., under `PKM/My Life/Projects/`).

### Step 3 - Handoff and delivery (Mack)

Mack takes the compiled markdown digest and delivers it:
- **Local file delivery:** By default, Mack writes the digest to `Deliverables/YYYY-MM-DD-daily-task-digest.md`.
- **External channel delivery:** If configured (e.g., via Slack or email integration), Mack sends the digest text to the user's preferred communication channel.

### Step 4 - Logging (Larry)

Larry updates the session logs to record that the daily task digest was run and delivered.

## Outcomes & Success Criteria

- The daily task digest file is successfully written to `Deliverables/` with the correct filename.
- Stale or blocked tasks are clearly flagged.
- Local project checklists are extracted so they do not fall through the cracks.
