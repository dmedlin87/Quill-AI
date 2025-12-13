# Quill-AI UI/UX Critical Review

## Environment + commands used

### Runtime

- **OS**: Windows (local dev)
- **App**: Vite + React 18

### Commands

- **Run dev server**: `npm run dev`
  - Expected URL: `http://localhost:3000/`

### Test commands available (not yet run during this audit)

- `npm run test` (vitest watch)
- `npm run test:run` (vitest run)
- `npm run test:coverage`

## UI Map (screens / major components)

### Entry / Library

- **Project Library / Dashboard**: `features/project/components/ProjectDashboard.tsx`
  - Empty library hero state
  - New project modal
  - Import draft flow (file picker -> metadata modal -> ImportWizard)
- **UploadLayout wrapper**: `features/layout/UploadLayout.tsx`

### Import flow

- **Import wizard**: `features/project/components/ImportWizard.tsx`
  - Includes its own keyboard shortcuts modal

### Main editor shell

- **App shell**: `features/layout/MainLayout.tsx`
  - Left navigation rail: `features/layout/NavigationRail.tsx`
  - Chapter sidebar: `features/project/components/ProjectSidebar.tsx`
  - Main editor workspace: `features/editor/components/EditorWorkspace.tsx`
  - Right tools panel container: `features/layout/ToolsPanelContainer.tsx`
  - Right tools panel: `features/layout/ToolsPanel.tsx`
  - Zen overlay: `features/layout/ZenModeOverlay.tsx`
  - Command palette: `features/shared/components/CommandPalette.tsx`

### Main editor content

- **Editor** (Tiptap): `features/editor/components/RichTextEditor.tsx`
- **Magic bar** (selection actions): `features/editor/components/MagicBar.tsx`
- **Find & Replace**: `features/editor/components/FindReplaceModal.tsx`
- **Agent suggestion review** (diff modal): `features/editor/components/EditorWorkspace.tsx` (pending diff block) + `features/editor/components/VisualDiff.tsx`

### Tools panel tabs

- **Analysis dashboard**: `features/analysis/components/Dashboard.tsx` -> `features/analysis/components/AnalysisPanel.tsx`
- **Chat**: `features/agent/components/ChatInterface.tsx`
- **History**: `features/agent/components/ActivityFeed.tsx`
- **Memory Manager**: `features/memory/MemoryManager.tsx`
- **Voice mode**: `features/voice/components/VoiceMode.tsx`
- **Knowledge graph**: `features/lore/components/KnowledgeGraph.tsx`
- **Lore manager**: `features/lore/components/LoreManager.tsx`
- **Story versions**: `features/editor/components/StoryVersionsPanel.tsx`
- **Settings** (in ToolsPanel):
  - Theme: `features/settings/components/ThemeSelector.tsx`
  - API keys: `features/settings/components/ApiKeyManager.tsx`
  - Model build selector: `features/settings/components/ModelBuildSelector.tsx`

### Shared UI primitives / styling

- **Global theme tokens + typography**: `features/shared/styles/global.css`
- **UI primitives**:
  - Button: `features/shared/components/ui/Button.tsx`
  - Input: `features/shared/components/ui/Input.tsx`
  - Card: `features/shared/components/ui/Card.tsx`
  - Typography: `features/shared/components/ui/Typography.tsx`
- **Tooltip**: `features/shared/components/AccessibleTooltip.tsx`

## Findings (ruthless + actionable)

Severity scale: **High** = blocks core flow / major confusion / a11y failure, **Medium** = noticeable friction, **Low** = polish.

### 1) [High] Chapter list items are not keyboard-accessible

- **Impact**: Keyboard-only users cannot switch chapters; also harms screen reader usability.
- **Evidence**: Chapter entries are clickable `div`s (no `role`, no `tabIndex`, no Enter/Space handler).
- **Fix**: Convert each chapter row to a real `<button type="button">` (or `role="button" tabIndex={0}` + key handlers). Ensure focus-visible styling.
- **Pointers**: `features/project/components/ProjectSidebar.tsx`
- **Effort**: 30–60m (+ tests)

### 2) [High] Tools panel header displays raw enum value (likely looks like “ANALYSIS”, “CHAT”, etc.)

- **Impact**: Feels unfinished / “dev UI”; reduces comprehension.
- **Evidence**: Header prints `{activeTab}` directly.
- **Fix**: Map `SidebarTab` -> human labels (e.g., “Analysis”, “AI Chat”, “Story Versions”).
- **Pointers**: `features/layout/ToolsPanel.tsx`
- **Effort**: 10–20m

### 3) [High] Modal dialogs generally lack accessible dialog semantics + focus management

- **Impact**: Screen reader users may not understand a modal opened; keyboard users can tab “behind” dialogs; Escape-to-close inconsistent.
- **Evidence**:
  - `ExportModal`: overlay has no `role="dialog"`, no `aria-modal`, no focus trap, no Escape close.
  - ProjectDashboard modal: same pattern.
  - CommandPalette: overlay modal lacks focus trap.
- **Fix**:
  - Introduce a small shared `Modal` primitive (no new deps) handling:
    - `role="dialog"` + `aria-modal="true"`
    - Escape-to-close
    - focus on open + restore focus on close
    - basic focus trap (Tab cycles inside)
  - Convert `ExportModal`, ProjectDashboard modal, CommandPalette to use it.
- **Pointers**:
  - `features/export/components/ExportModal.tsx`
  - `features/project/components/ProjectDashboard.tsx`
  - `features/shared/components/CommandPalette.tsx`
- **Effort**: 1–3h depending on scope

### 4) [High] `alert()` used for export failures (poor UX + inaccessible)

- **Impact**: Jarring, not theme-consistent, not screen-reader friendly.
- **Evidence**: `alert('Export failed. Please try again.')`
- **Fix**: Render an inline error banner in the modal (aria-live region), keep modal open.
- **Pointers**: `features/export/components/ExportModal.tsx`
- **Effort**: 20–40m (+ tests)

### 5) [High] Inconsistent theme system usage across top-level screens (hard-coded colors)

- **Impact**: Theme toggles feel unreliable; UI looks like multiple apps stitched together.
- **Evidence**:
  - Dashboard uses hard-coded dark gradients and Tailwind grays.
  - UploadLayout uses fixed light gray background.
  - Editor uses CSS tokens (`var(--surface-*)`).
- **Fix**: Replace hard-coded backgrounds with semantic tokens where feasible (start with wrappers, not full redesign).
- **Pointers**:
  - `features/project/components/ProjectDashboard.tsx`
  - `features/layout/UploadLayout.tsx`
- **Effort**: 1–2h (incremental)

### 6) [High] Potential missing component import: `QuotaExhaustedModal`

- **Impact**: Can break app load if module truly missing.
- **Evidence**: `App.tsx` imports `@/features/settings/components/QuotaExhaustedModal`, but file not present in `features/settings/components/`.
- **Fix**: Either add the component, or remove/replace import.
- **Pointers**: `App.tsx`, `features/settings/components/`
- **Effort**: 10–30m (confirm by loading app)

### 7) [Medium] NavigationRail lacks explicit focus-visible styling (likely invisible focus)

- **Impact**: Keyboard users can get “lost” (especially with icon-only nav).
- **Evidence**: Buttons have hover styles but no `focus-visible:*` classes.
- **Fix**: Add consistent `focus-visible:ring` to nav buttons (or use shared Button primitive / shared class).
- **Pointers**: `features/layout/NavigationRail.tsx`
- **Effort**: 20–40m

### 8) [Medium] `AccessibleTooltip` attaches `aria-describedby` to a wrapper div, not the interactive element

- **Impact**: Tooltip may not be announced for the actual focused control.
- **Evidence**: `aria-describedby` is set on a `<div>` wrapping `{children}`.
- **Fix**: Accept a single ReactElement child and clone it with `aria-describedby`, or render a wrapper that forwards `aria-describedby` to the first focusable descendant.
- **Pointers**: `features/shared/components/AccessibleTooltip.tsx`
- **Effort**: 1–2h (be careful; many callsites)

### 9) [Medium] ProjectSidebar word count computed per render per chapter

- **Impact**: With many/large chapters, sidebar can become sluggish.
- **Evidence**: `chapter.content.trim().split(/\s+/)` in render loop.
- **Fix**: Cache word count in store (chapter metadata) or memoize per chapter ID/content hash.
- **Pointers**: `features/project/components/ProjectSidebar.tsx`
- **Effort**: 1–2h

### 10) [Medium] Chat message list uses heavy animation + layout for every message

- **Impact**: Jank with long sessions; scroll performance degrades.
- **Evidence**: `AnimatePresence mode="popLayout"` + `motion.div layout` for each message.
- **Fix**: Reduce per-message layout animations; consider disabling animation after N messages; keep the 200 message cap.
- **Pointers**: `features/agent/components/ChatInterface.tsx`
- **Effort**: 1–2h

### 11) [Medium] “Find & Replace” modal is draggable and floating but lacks clear accessibility semantics

- **Impact**: Screen readers may not understand it; focus can jump behind; drag UX can be confusing.
- **Evidence**: Fixed-position `motion.div` with drag; no `role="dialog"` / `aria-label` for dialog container.
- **Fix**: Add `role="dialog" aria-label="Find and replace"`, Escape close already exists; consider optional focus trap.
- **Pointers**: `features/editor/components/FindReplaceModal.tsx`
- **Effort**: 20–60m

### 12) [Medium] ProjectDashboard “book cover” cards have no visible focus affordance

- **Impact**: Keyboard navigation on the library page is hard.
- **Evidence**: Buttons are styled for hover/transform but no focus-visible ring.
- **Fix**: Add `focus-visible:ring` (and avoid transform causing layout shift on focus).
- **Pointers**: `features/project/components/ProjectDashboard.tsx`
- **Effort**: 20–40m

### 13) [Medium] Multiple competing “header” systems in the editor view

- **Impact**: Confusing hierarchy: `EditorHeader` (top bar) + `WorkspaceHeader` (inside editor) + Zen overlay hover zones.
- **Evidence**:
  - `MainLayout` renders `EditorHeader` and also `EditorWorkspace` which renders its own header.
- **Fix**: Clarify responsibility:
  - One global header for app-level actions (export, usage, voice).
  - One editor-local header for chapter title/analysis.
  - Ensure both behave consistently in Zen Mode.
- **Pointers**:
  - `features/layout/EditorHeader.tsx`
  - `features/editor/components/EditorWorkspace.tsx`
- **Effort**: 2–4h (careful; scope control)

### 14) [Low] Hard-coded emoji icons in settings / status labels

- **Impact**: Inconsistent tone; can read oddly in screen readers.
- **Evidence**: ApiKeyManager uses emoji for tier indicators.
- **Fix**: Replace with existing icon set (or add `aria-hidden` on decorative emoji).
- **Pointers**: `features/settings/components/ApiKeyManager.tsx`
- **Effort**: 20–40m

### 15) [Low] Inconsistent token naming usage (`--ink-*`, `--parchment-*`, `--surface-*`) across components

- **Impact**: Makes UI changes risky; visual drift.
- **Evidence**: Some components use `--surface-*`, others use `--parchment-*` directly.
- **Fix**: Prefer semantic tokens (`--surface-*`, `--text-*`, `--border-*`, `--interactive-*`).
- **Pointers**: multiple (`ProjectSidebar`, editor headers, etc.)
- **Effort**: ongoing (incremental)

### 16) [Low] CommandPalette “Toggle Tools Panel” only collapses (no toggle)

- **Impact**: UX mismatch: command label says toggle but action always collapses.
- **Evidence**: `setToolsCollapsed(true)`.
- **Fix**: Add real toggle action in store (or read current state and invert).
- **Pointers**: `features/shared/components/CommandPalette.tsx`, `features/layout/store/useLayoutStore.ts`
- **Effort**: 20–40m

### 17) [Low] `UploadLayout` uses a distinct style system (gray background) vs app themes

- **Impact**: Visual seam when transitioning into editor.
- **Evidence**: `bg-[#f3f4f6] text-gray-900`.
- **Fix**: Use tokens to match the rest of the app (or explicitly brand it as “library mode”).
- **Pointers**: `features/layout/UploadLayout.tsx`
- **Effort**: 20–40m

## Accessibility (what to test + initial code-based risks)

### Keyboard-only pass (manual)

- **Target flows**:
  - Library -> open/create project -> editor
  - NavigationRail tab switching
  - Tools panel interactions
  - Command palette open/close
  - Export modal open/close
- **Known blockers from code**:
  - Chapter selection in `ProjectSidebar` is not keyboard focusable (see Finding #1).

### Focus visibility

- **Known risks from code**:
  - Many non-primitive buttons don’t include `focus-visible` styles (`NavigationRail`, `ProjectDashboard`).

### Forms / labels

- **Mostly OK** where `Input` is used; mixed elsewhere (raw `<input>` with label text but no `htmlFor` in some places).

### Modals (focus trap / Escape / restore focus)

- **Known risks**: Many overlays are presentational only (see Finding #3).

### Headings / landmarks

- Mixed: some screens use `h1/h2` appropriately, but ToolsPanel uses `h3` and prints enum; needs consistency.

## Performance / polish

### Likely jank sources

- **Large lists + expensive calculations**: chapter sidebar word count calculation (Finding #9).
- **Animation-heavy lists**: chat message list (Finding #10), storyboard card grid.
- **Runtime Tailwind CDN**: `index.html` loads Tailwind via CDN; watch for layout shift / delayed styling.

### Practical mitigations (low-risk)

- Prefer memoized derived values / store-level cached metrics for sidebar.
- Reduce animation density after content grows (e.g., disable layout animations after N items).
- Use semantic tokens consistently to reduce “one-off CSS” drift.

## Top 10 Fixes (prioritized)

1. **Fix ProjectSidebar keyboard accessibility** (Finding #1)
2. **Modal accessibility baseline** (role/aria + Escape + focus management) (Finding #3)
3. **Replace `alert()` with inline error UI in ExportModal** (Finding #4)
4. **ToolsPanel header humanization** (Finding #2)
5. **Add focus-visible styles to NavigationRail + library cards** (Findings #7, #12)
6. **Confirm and fix missing `QuotaExhaustedModal` import** (Finding #6)
7. **Unify theme usage for library/upload wrappers** (Findings #5, #17)
8. **Command palette: fix true toggle for tools panel** (Finding #16)
9. **Chat performance: reduce layout animations after N messages** (Finding #10)
10. **AccessibleTooltip aria-describedby targeting** (Finding #8)

## Quick Wins (≤1h each)

- ToolsPanel header label mapping (Finding #2)
- ExportModal inline error + remove alert (Finding #4)
- Command palette tools “toggle” correctness (Finding #16)
- Add focus-visible rings to NavigationRail buttons (Finding #7)
- Add focus-visible rings to ProjectDashboard cards (Finding #12)

## Notes / open verification

To fully satisfy the “real navigation/observation” requirement, capture screenshots/notes from:

- Library empty state
- Library with 1–2 projects
- Editor view (with Tools panel open on at least Chat + Settings)
- Command palette open
- Export modal open
- (Optional) ImportWizard screen

Once you share those screenshots, I’ll update this report with concrete runtime evidence (copy, hierarchy issues, “what now?” moments, and any visual bugs).
