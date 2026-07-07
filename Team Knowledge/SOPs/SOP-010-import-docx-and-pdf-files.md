# SOP-010 - Import DOCX and PDF Files

**Default Owner:** Penn (PKM Capture Writer)  
**Status:** Active  
**Scope:** Reusable by any agent  
**Triggers:** User provides a `.docx` or `.pdf` file to import into myPKA, or requests file-preservation imports.

---

## Purpose

This SOP defines the step-by-step procedure to import binary Word (`.docx`) and PDF documents into the myPKA vault. It ensures that the lossless, raw formatting of original documents is preserved while extracting metadata, summaries, and key terms into a searchable Markdown stub.

---

## Procedure

### Step 1: File Retrieval & Naming
1. Scan `Team Inbox/` or retrieve the file from the path specified by the user.
2. Normalize the filename to **kebab-case** per [[GL-001-file-naming-conventions]], preserving the original extension.
   * *Example:* `Project Agenda Final.docx` $\rightarrow$ `project-agenda-final.docx`

### Step 2: Store Raw Binary Lossless
1. Create the `PKM/Documents/sources/` directory if it does not already exist.
2. Move the original binary file into `PKM/Documents/sources/`. 
3. This ensures the raw document (including complex formatting, track changes, or comments) is preserved in a secure, synced location.

### Step 3: Text Extraction
Perform automated extraction based on file type:
* **For `.docx` files:**
  Use Python to parse the document's internal XML structure or run a helper script utilizing `docx2txt` to extract raw paragraph text.
* **For `.pdf` files:**
  Use a Python utility (like `pypdf` or `pdfplumber`) to extract textual contents. If the PDF contains non-selectable text, request the user to provide copy-pasted details, or note that the PDF is an image-only scan.

### Step 4: Create Markdown Stub
1. Create a new markdown file in `PKM/Documents/<slug>.md` using the standard `document.md` template.
2. Populate the YAML frontmatter:
   * `title`: A human-readable title of the document.
   * `doc_type`: `contract | id | invoice | warranty | medical | tax | other` (use `other` for agendas, notes, and general docs).
   * `digital_location`: `PKM/Documents/sources/<kebab-case-name>.<ext>` (pointing directly to the preserved raw binary).
3. Populate the Body sections:
   * `## Summary`: A brief, high-level paragraph summarizing the document.
   * `## Key terms`: A list of the most critical dates, names, or action items extracted from the text.
   * `## Notes`: Any additional context (e.g., links to related Projects or Goals).

### Step 5: Clean Up & Index
1. Delete the raw file from the `Team Inbox/` once successfully filed.
2. Add the new Markdown stub link `[[<slug>]]` under the appropriate section of `PKM/Documents/INDEX.md`.
3. Run the database mirror script `python3 Expansions/mypka-cockpit/scripts/regen-mypka-db.py` to refresh the index.
