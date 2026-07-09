# SOP-011 - Import Audio and Video Recordings

**Default Owner:** Penn (PKM Capture Writer)  
**Status:** Active  
**Scope:** Reusable by any agent  
**Triggers:** User provides an audio (`.mp3`, `.wav`) or video (`.mp4`, `.mov`) recording file or share link (e.g., Dropbox link) to document in myPKA.

---

## Purpose

This SOP defines the step-by-step procedure to document external audio/video meeting recordings in the myPKA vault. To keep local vault storage slim, the binary recordings are linked from cloud storage (like Dropbox) rather than stored locally. It also enforces metadata clarity by requiring the agent to prompt the user if the recording's context is unclear.

---

## Procedure

### Step 1: Analyze Filename & Context
1. Inspect the filename and the user's message.
2. Check if the following information is obvious:
   * **Date:** The calendar day the meeting took place.
   * **Meeting Type / Topic:** What the meeting was about (e.g., "VR Tech Subcommittee", "Google Docs Training").
   * **Attendees / Key Participants:** Who was in the meeting.
3. **Clarification Gate:** If any of these details (especially the date or meeting type) are missing or ambiguous from the filename, **STOP** and ask the user to clarify before proceeding.
   * *Example of ambiguous name:* `recording-12345.mp3` $\rightarrow$ Stop and ask.
   * *Example of clear name:* `2026-06-13-google-training-workshop.mp3` $\rightarrow$ Proceed.

### Step 2: Establish Digital Location
1. Secure the cloud share link (typically a Dropbox link) provided by the user.
2. Confirm the link is formatted correctly for direct reference in the stub.

### Step 3: Create Markdown Stub
1. Create a new markdown file in `PKM/Documents/<slug>.md` per [[GL-001-file-naming-conventions]].
   * Format: `YYYY-MM-DD-<meeting-name>-recording.md`
2. Populate the YAML frontmatter:
   ```yaml
   ---
   title: [Meeting Name] Recording - YYYY-MM-DD
   doc_type: other
   digital_location: [Cloud Link]
   issued_on: YYYY-MM-DD
   tags:
     - recording
     - audio # or video
     - [meeting-type-tag]
   ---
   ```

### Step 4: Populate Stub Body
Write a clean, structured outline:
* **H1 Header:** `[Meeting Name] Recording — YYYY-MM-DD`
* **Backlink:** Link to the corresponding Project or Topic (e.g. `**Project:** [[oa-vr-data-and-tech-committee]]`).
* **## Context:** Date, duration, list of attendees, and a brief description of the meeting's purpose.
* **## Key Topics & Timestamps:** If the user provides timestamps or a summary, detail them here.
* **## Action Items:** Bulleted list of any decisions made or tasks assigned.

### Step 5: Clean Up & Index
1. Add the new Markdown stub link `[[<slug>]]` under the appropriate section of `PKM/Documents/INDEX.md`.
2. Run the database mirror script `python3 Expansions/mypka-cockpit/scripts/regen-mypka-db.py` to refresh the index.
