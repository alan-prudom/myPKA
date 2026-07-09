# SOP-012 - Voice to Text Transcription

**Default Owner:** Mack (Automation) / Penn (Capture)  
**Status:** Active  
**Scope:** Reusable by any agent  
**Triggers:** User requests transcription of an audio recording associated with a meeting notes file or daily journal.

---

## Purpose

This SOP defines the procedure to transcribe audio meeting recordings (`.mp3`, `.m4a`, `.wav`) into searchable text within the myPKA vault. It provides fallback options (multimodal LLM, local Whisper CLI, and background Python scripts) depending on the file size and system resources.

---

## Procedure

### Step 1: Download & Stage Audio
1. If the audio is hosted in the cloud (e.g., Dropbox/Google Drive), download it using `curl` to `PKM/Documents/sources/`.
2. Normalize the filename to `YYYY-MM-DD-<meeting-name>-recording.<ext>` per [[GL-001-file-naming-conventions]].

### Step 2: Choose Transcription Method

#### Method A: Multimodal LLM (Recommended for files < 50MB)
1. Call the `view_file` tool on the local binary audio file.
2. The IDE will upload the audio content directly into the model's multimodal context.
3. Prompt the model: 
   > "Please transcribe the attached audio file. Output a clean, word-for-word transcript, formatting paragraphs by speaker changes if distinguishable. If there are long pauses or noise, indicate them in brackets."

#### Method B: Local CLI (Whisper / whisper.cpp)
1. Check if `whisper` is available on the system PATH (`which whisper`).
2. If available, execute the transcription via CLI:
   ```bash
   whisper "PKM/Documents/sources/your-audio.mp3" --model base --output_format txt --output_dir "PKM/Documents/sources/"
   ```
3. Read the resulting `.txt` file.

#### Method C: Background Python Script (Fallback)
1. If no CLI is available and the file is too large for the LLM payload, run a dynamic Python script using `uv`:
   ```bash
   uv run --with faster-whisper python3 -c "
   from faster_whisper import WhisperModel
   model = WhisperModel('base', device='cpu', compute_type='int8')
   segments, info = model.transcribe('PKM/Documents/sources/your-audio.mp3')
   for segment in segments:
       print('[%.2fs -> %.2fs] %s' % (segment.start, segment.end, segment.text))
   " > "PKM/Documents/sources/your-audio.txt"
   ```
2. Read the resulting `.txt` file.

### Step 3: Format & Append to Stub
1. Open the corresponding recording stub: `PKM/Documents/YYYY-MM-DD-<meeting-name>-recording.md`.
2. Add a `## Transcript` section at the end of the file.
3. Paste the formatted transcript text. Keep formatting clean:
   * Use bold names for speaker changes (e.g., **Alan P:**, **Roger H:**) if identifiable.
   * Add timestamps for key topics.

### Step 4: Post-Transcription Synthesis & Reconciliation
1. **Compare Transcript vs. Minutes:** Re-read the transcript to identify any key discussions, metrics, or decisions that are missing or overly brief in the main meeting notes file. Update the notes file to capture these details.
2. **Compile CRM Contact Data:** Check all mentioned participants. For any participant without an active file in `PKM/CRM/People/`, create their contact profile stub using the standard `person.md` template.
3. **Reconcile Actions:** Extract all specific tasks and follow-up items mentioned in the transcript. Reconcile these with the target project's checklist (e.g., in `PKM/My Life/Projects/`) to ensure no actions are orphaned.

### Step 5: Local Binary Cleanup (Optional/Cloud-linked files)
1. **Identify Source Status:** If the original recording was downloaded from an external cloud storage link (e.g., Dropbox) per **SOP-011** to keep the local vault slim:
   * **Delete** the local temporary binary file from `PKM/Documents/sources/` (e.g., `rm PKM/Documents/sources/your-audio.mp3`).
   * Do **not** commit large binary media files to the Git repository.
2. If the user explicitly requested keeping a copy locally, ensure it is moved to a directory excluded by `.gitignore`.

### Step 6: Index & Refresh
1. Run the database mirror script `python3 Expansions/mypka-cockpit/scripts/regen-mypka-db.py` to index the new transcript text.
