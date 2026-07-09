# SOPs - Index

**SOPs are agent skills.** Each SOP is a canonical procedure — a step-by-step recipe for one job. They are LLM-agnostic and reusable across agents: an SOP has a **default owner** (the specialist who runs it most often), but any agent can invoke an SOP when they need its procedure. Think of SOPs the way Claude skills work — discrete, named, callable.

Filename pattern: `SOP-NNN-<title>.md`. See [[GL-001-file-naming-conventions]] for slug rules. Numbering follows authorship order, not topic — gaps are intentional and reserve slots for future agents.

## Active SOPs

| SOP | Title | Default owner | Description |
|---|---|---|---|
| SOP-001 | [[SOP-001-how-to-add-a-new-specialist]] | Nolan | Step-by-step procedure to draft and onboard a new team specialist. References [[GL-001-file-naming-conventions]]. |
| SOP-002 | [[SOP-002-convert-mypka-to-sqlite]] | Silas (run by the user via paste-into-LLM prompt) | Generate a SQLite mirror of your myPKA on demand. Markdown stays canonical; SQLite is a derived performance layer. Body is a paste-into-LLM prompt. |
| SOP-010 | [[SOP-010-import-docx-and-pdf-files]] | Penn | Import binary DOCX and PDF documents, storing original lossless binaries while generating searchable Markdown stubs. |
| SOP-011 | [[SOP-011-import-audio-and-video-recordings]] | Penn | Document cloud-linked meeting recordings in myPKA, checking for identifying details. |
| SOP-012 | [[SOP-012-voice-to-text-transcription]] | Mack/Penn | Transcribe audio meeting recordings into searchable text stubs in myPKA. |

*Reserved (genuinely open for future agents):* SOP-003 onward. Agent packs installed from the myICOR Expansion Packs page claim the lowest free slots at install time (per [[WS-003-install-an-expansion]] §3.2); for example, the App Developer Pack claims 003 to 005 and the Designer Pack 006 to 009 when installed. Do not back-fill these slots without coordinating across the team.

## How to add a new SOP

1. Pick the next unused number (`SOP-NNN`) — by authorship order, not topic. Don't reuse reserved numbers.
2. Filename: `SOP-NNN-<kebab-case-title>.md`.
3. Header includes the default owner, status, triggers, references, and an explicit "Reusable by any agent" note — the SOP is a skill, not 1:1 ownership.
4. Reference [[GL-001-file-naming-conventions]] and any other Guideline instead of duplicating its content.
5. Add a row to this index.
