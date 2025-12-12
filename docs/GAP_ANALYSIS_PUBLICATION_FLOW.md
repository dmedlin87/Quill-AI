# GAP Analysis: Non-Tech Author “Import → Refine → Publish” Flow

## Scope

This audit focuses on a non-technical author workflow:

- **Import:** Microsoft Word (`.docx`) rough draft into Quill AI
- **Refine:** AI-guided editorial assistance (proactive + reactive)
- **Publish:** Export a publication-ready manuscript in industry-standard format

Code inspected:

- **Import UI:** `features/project/components/ProjectDashboard.tsx`, `features/project/components/FileUpload.tsx`, `features/project/components/ImportWizard.tsx`
- **Parsing:** `services/manuscriptParser.ts`
- **Export:** `services/pdfExport.ts`, `types/export.ts`
- **Guidance:** `features/agent/hooks/useProactiveSuggestions.ts`, `services/memory/proactive.ts`, `services/appBrain/proactiveThinker.ts`, `services/core/agentOrchestratorMachine.ts`, `services/core/agentStateFactory.ts`

---

## 1) Status of `.docx` Import/Export

### `.docx` import

**Current status: Missing (critical gap).**

Evidence:

- **File picker accepts only** `.txt,.md` in the main “Import Draft” entry point:
  - `features/project/components/ProjectDashboard.tsx` sets:
    - `accept=".txt,.md"`
    - Reads file via `await file.text()` (text-only)
- The standalone upload component is also text-only:
  - `features/project/components/FileUpload.tsx`:
    - Accepts `.txt,.md`
    - Allows `file.type === 'text/plain'` or `.md/.txt`
    - Uses `await file.text()`
- **No `.docx` parsing exists in the parser**:
  - `services/manuscriptParser.ts` accepts a `rawText: string` and performs regex-based heuristics.
- Repo search shows **no usage of** `mammoth` / `docx` libs and no `.docx` accept strings in app code.

Implication:

- A non-technical author starting from Word cannot import their primary draft format.
- Even if Word “Save As .txt” is possible, it’s a multi-step workaround that causes format loss and is not “simple.”

**Recommended gap-fix direction:**

- Integrate a `.docx → text` converter:
  - **Browser-first**: `mammoth` (client-side extraction of raw text from docx zip)
  - Alternative: `docx` library (better for *writing* docx; less ideal for extraction)
- Add a parser entry point that accepts:
  - `ArrayBuffer` / `Uint8Array` for `.docx`
  - Plain string for `.txt/.md`

### `.docx` export

**Current status: Missing (critical gap).**

Evidence:

- Export implementation is PDF-only via `jsPDF`:
  - `services/pdfExport.ts` exports `PDFExportService` / `pdfExportService`
- Repo search did not show any `.docx` export service, nor any export UI component.

Implication:

- Many editors/agents expect a Word manuscript or RTF, not PDF.
- PDF is often undesirable for collaborative editing (track changes, comments).

**Recommended gap-fix direction:**

- Implement `.docx` export (and optionally `.rtf`) as first-class targets.
  - If you want near-Word compatibility: `docx` (generate docx) is a common TS option.
  - Consider exporting both:
    - **Submission PDF** (for reading)
    - **Editing DOCX** (for editors)

---

## 2) Missing “One-Click” compliance features for publication standards

### PDF formatting vs industry-standard manuscript formatting

**Current status: Generic PDF layout (not manuscript-standard).**

What `PDFExportService` does today (`services/pdfExport.ts`):

- Uses **A4**, millimeter units, portrait.
- Uses hard-coded margins `MARGIN_X = 20mm`, `MARGIN_Y = 20mm`.
- Uses **Helvetica** fonts.
- Uses a title page with centered title + “By {author}” + generated date.
- Manuscript body is rendered via `splitTextToSize` and `doc.text` with configurable:
  - `fontScale`
  - `lineHeight`
  - `includeChapterTitles` (simple regex removal of lines starting with “Chapter”)

What’s missing for “industry standard” (e.g., Shunn-style / standard manuscript):

- **US Letter (8.5"x11")** option (A4 is common internationally, but US submissions often want Letter).
- **Courier / monospaced 12pt** option (standard manuscript often expects Courier 12).
- **Double-spacing** default (lineHeight likely can approximate, but defaults are not enforcement).
- **1-inch margins** specifically (20mm ≈ 0.79", not 1").
- **Running header**: Author / Title / Page # (top right), starting page 2.
- **Proper title page** formatting (contact info, word count, etc. depending on submission).
- **Scene breaks** formatting rules (e.g., `#` / `***` centered).
- **Paragraph indentation** rules and block formatting (no first-line indent logic exists; it just prints wrapped lines).

**Recommended “one-click” compliance direction:**

- Add an export preset system:
  - `ExportPreset.StandardManuscriptUS`
  - `ExportPreset.Shunn`
  - `ExportPreset.GenericPDF`
- Each preset should define:
  - Page size: Letter vs A4
  - Margins: 1" exact
  - Font: Courier
  - Line spacing: double
  - Header/footer renderer (page numbers)

### Export UX wiring

**Current status: likely incomplete / not discoverable.**

Evidence:

- Export types exist (`types/export.ts`) and PDF service exists, but a quick search did not find a dedicated export panel/button in `features/**` that calls `pdfExportService`.

Implication:

- Even the existing PDF export may not be exposed as a “Publish” step.

---

## 3) Complexity bottlenecks in current UX (non-technical author)

### Import UX bottlenecks

- **Format mismatch:** UI explicitly markets `.txt/.md` only.
  - Non-tech users generally have `.docx`.
- **Chapter parsing expectations:**
  - `services/manuscriptParser.ts` is heuristics-based and assumes a relatively clean text dump.
  - Word docs often include:
    - styled headings (not plain “CHAPTER 1” lines)
    - page headers/footers (not always caught)
    - section breaks, scene separators, extra whitespace
- **Two separate upload implementations** (`ProjectDashboard` import + `FileUpload`) both text-only.
  - This increases maintenance burden and risk of inconsistent behavior.

### Refinement / guidance bottlenecks

#### Current status

Guidance is suggestion-driven, not a deterministic “publication roadmap.”

Evidence:

- `features/agent/hooks/useProactiveSuggestions.ts`:
  - Generates suggestions on `CHAPTER_SWITCHED` events (memory-based)
  - Can start a background `ProactiveThinker` when `enableProactiveThinking` + `getAppBrainState` provided
  - No explicit “Project Completion/Export” mode or checklist state
- `services/memory/proactive.ts`:
  - Deterministic suggestions are mostly:
    - watched entities present
    - related memories by tags
    - active goals relevance
    - reminders (unresolved issues / stalled goals)
  - This is helpful, but not a structured publishing pipeline.
- `services/appBrain/proactiveThinker.ts`:
  - Uses the LLM to emit 1–3 suggestions from recent activity
  - Also evolves bedside notes with “proactive opportunities”
  - Still not a deterministic milestone tracker (it’s opportunistic).
- `services/core/agentOrchestratorMachine.ts`:
  - Tracks agent execution status (idle/thinking/executing/error), not “project completion states.”

Implication:

- A non-tech author needs a “guided mode” that answers:
  - “What’s next?”
  - “Am I done?”
  - “Make it compliant and export it.”
- Current system can *suggest*, but does not appear to *own* a structured end-to-end process.

### Publish UX bottlenecks

- Even if PDF export is available, it does not enforce or advertise manuscript-standard compliance.
- No `.docx` export means the user cannot hand the manuscript to an editor in the expected format.

---

## Recommended next increments (high ROI)

### Critical gaps (blockers)

- **Add `.docx` import** (client-side) and route it into the existing `parseManuscript(text)` pipeline.
- **Add `.docx` export** (and/or `.rtf`) for editor compatibility.

### “One-click publish” capabilities

- Add export presets for standard manuscript formats:
  - US Letter, 1" margins, Courier 12, double spaced, header/page numbers
- Add a “Publish” UI affordance:
  - single button from editor/project screen
  - preview + export target selection (PDF/DOCX)

### Guided roadmap (“Non-Tech Author mode”)

- Implement a deterministic project completion state (checklist) rather than purely reactive suggestions.
  - Candidate location: add a new agent mode/state concept in `services/core/agentStateFactory.ts` (or adjacent) that can produce a “Roadmap to Publication” object, e.g.:
    - Import complete
    - Chapters validated
    - Analysis run
    - Key issues resolved
    - Manuscript formatted
    - Exported

---

## Task completion status

- **Audit completed** for the referenced import/export/guidance code.
- **Report created** at `docs/GAP_ANALYSIS_PUBLICATION_FLOW.md`.
