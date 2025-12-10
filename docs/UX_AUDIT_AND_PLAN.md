# UX/UI Audit & Modernization Plan

## 1. Executive Summary

A comprehensive review of the application reveals a functional but visually fragmented user experience. The application currently serves three distinct visual themes ("Parchment", "Tech SaaS", and "Skeuomorphic Board") which creates disjointed transitions for the user. Additionally, the lack of a centralized component library has led to significant code duplication and inconsistent interaction patterns.

The primary goal of this modernization plan is to unify the visual language under a cohesive Design System and refactor key features to use shared primitives.

## 2. Visual Consistency Findings

### Theme A: "Parchment & Ink" (The Core Experience)

* **Locations**: `ProjectSidebar`, `EditorWorkspace`, `AnalysisPanel`.
* **Characteristics**:
  * Heavy use of CSS Variables (`var(--parchment-50)`, `var(--ink-900)`).
  * Typography: Serif dominant (`Crimson Pro` implied).
  * Aesthetic: Warm, minimalist, "writer-focused".
* **Status**: This appears to be the intended primary brand aesthetic.

### Theme B: "Tech SaaS" (The Tools)

* **Locations**: `ChatInterface`, `Settings`.
* **Characteristics**:
  * Heavy use of raw Tailwind utility colors (`bg-indigo-600`, `text-slate-500`, `bg-gray-50`).
  * Typography: Sans-serif dominant.
  * Aesthetic: Cool, high-contrast, standard web app feel.
  * **Conflict**: The jarring switch from "Parchment" editor to "Indigo/Slate" chat breaks immersion.

### Theme C: "Physical Skeuomorphism" (The Planning)

* **Locations**: `StoryBoard`.
* **Characteristics**:
  * Heavy use of inline styles for textures (Cork board SVG, noise).
  * "Index Card" styling with ruled lines and drop shadows.
  * Hardcoded gradients (`from-amber-900` to `to-amber-800`).
* **Conflict**: While distinct and fun, it shares no DNA with the Editor or Chat, making the "Switch to Editor" transition feel like changing apps.

## 3. Structural & Component Audit

### Layout & Structure

* **Redundancy**: `MainLayout.tsx` acts as the application shell, but `EditorLayout.tsx` exists and appears to duplicate some layout logic. This creates ambiguity about where global state (like Zen Mode) should natively live.
* **Navigation**: `NavigationRail` is consistent, but the "Headers" across features (Editor Header vs. Board Header vs. Chat Header) use different heights, padding, and font sizes.

### Component Primitives

* **Missing Primitives**: The codebase lacks a `features/design-system` or robust `shared/components` library.
  * **Buttons**: Hardcoded repeatedly (e.g., `<button className="px-4 py-2 bg-indigo-600...">`).
  * **Inputs**: No standard Input component; inconsistent focus states (Ring color varies from Indigo to Magic to Ink).
  * **Cards**: Analysis uses `IssueCard`, StoryBoard uses custom `div` logic, Editor uses `CommentCard`.
* **Tooltips**: Inconsistent usage. `AccessibleTooltip` is available but underused; many elements rely on browser-default `title` attributes.

### Interactions

* **Modals**: `FindReplaceModal` and standard browser alerts are blocking.
* **Transitions**: Framer Motion is present but variants are defined locally in each file, leading to slightly different animation curves across features.

## 4. Prioritized Action Plan

### Phase 1: Design System Foundation (High Priority)

* [ ] **Establish Token System**: Enforce the "Parchment & Ink" theme guidelines. Map "Tech" colors (Indigo/Slate) to semantic variables (`--interactive-accent`, `--surface-secondary`) to ensure consistency.
  * *Decision*: Adopt the "Parchment" theme as the master aesthetic.
* [ ] **Create Core Primitives**: Build the following components in `features/shared/components` or a new `features/design-system`:
  * `Button` (Variants: Primary, Ghost, Icon)
  * `Input` / `TextArea`
  * `Card` / `Surface`
  * `Modal` / `Dialog`
  * `Popover`

### Phase 2: Structural Unification (Medium Priority)

* [ ] **Refactor Layouts**: Investigate `EditorLayout.tsx` usage. If redundant, deprecate it. Ensure `MainLayout.tsx` handles the transition between `StoryBoard` and `EditorWorkspace` smoothly.
* [ ] **Standardize Headers**: Create a `ViewHeader` component that standardizes height, title typography, and action button placement for all views (Editor, Board, Analysis).

### Phase 3: Feature Refactoring (Medium Priority)

* [ ] **Refactor ChatInterface**: Replace hardcoded Tailwind colors with Design System variables.
* [ ] **Refactor StoryBoard**: Tame the extreme skeuomorphism. Keep the "Board" feel but use Design System colors/fonts/shadows so it feels like *part of the same desk* as the Editor.
* [ ] **Refactor Settings**: Replace `ExperienceSelector` and other settings inputs with standard primitives.

### Phase 4: UX Polish (Low Priority)

* [ ] **Non-Blocking Interactions**: Convert `FindReplaceModal` to a persistent floating panel (like `ToolsPanel`) to allow editing while searching.
* [ ] **Unified Motion**: Centralize Framer Motion variants in `features/shared/animations.ts` and apply to all page transitions.

## 5. Quick Wins (Can be done immediately)

1. Replace browser-default `title` attributes with `AccessibleTooltip` in `MainLayout` and `EditorLayout`.
2. Standardize the "Deep Mode" toggle in `ChatInterface` to match the `EditorHeader` toggle styles.
3. Update `StoryBoard` background color to use a CSS variable derived from the theme instead of a hardcoded linear gradient.
