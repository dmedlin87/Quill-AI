# Agent Tools & Commands Reference

This document explains how the omniscient agent in Quill AI issues tool calls, how those calls are implemented, and how to safely add new tools.

At a high level:

- **Tool definitions (API schema):** `services/gemini/agentTools.ts` — function declarations grouped by category (navigation, editing, analysis, UI, knowledge, generation, memory).
- **Tool execution:** `services/gemini/toolExecutor.ts` — maps tool names to **AppBrain actions** and the **agent memory service**.
- **Command layer:** `services/commands/*.ts` and `services/commands/registry.ts` — provide undo-aware commands that operate on AppBrain + editor state.
- **AppBrain state:** `services/appBrain/index.ts` — aggregates manuscript, intelligence, analysis, lore, UI, and session state.
- **UI entry point:** `features/agent/hooks/useAgentOrchestrator.ts` — creates Gemini chat sessions with `ALL_AGENT_TOOLS` / `VOICE_SAFE_TOOLS` and runs the tool loop.

---

## 1. Architecture Overview

```text
User message → useAgentOrchestrator → Gemini (tool calls)
            → agentTools.ts (tool schema)
            → toolExecutor.ts (route by tool name)
            → CommandRegistry + AppBrainActions
            → Editor / project / AppBrain / memory changes
```

- **Tool declarations** in `agentTools.ts` describe:
  - `name` (`navigate_to_text`, `update_manuscript`, `run_analysis`, ...)
  - `description`
  - `parameters` (types, enums, required fields)
- **ToolExecutor** in `toolExecutor.ts`:
  - Routes **memory tools** (e.g. `write_memory_note`, `search_memory`) to the memory service.
  - Routes all other tools to **AppBrainActions** (navigation, editing, analysis, UI, knowledge, generation).
  - Records non-memory commands to `CommandHistory` using `CommandRegistry` metadata.
- **CommandRegistry** in `services/commands/registry.ts`:
  - Maintains `CommandMeta` entries for each tool name.
  - Knows the category (`navigation`, `editing`, `analysis`, `knowledge`, `ui`, `generation`).
  - Knows if the command is **reversible** (undoable) and provides a factory that creates the command implementation.

---

## 2. Tool Categories & Representative Tools

The agent tools are grouped into categories. Below are the most important tools, with their behavior and backing commands.

### 2.1 Navigation

**Purpose:** Move the user to relevant text or scenes.

Representative tools:

- **`navigate_to_text`**  
  - **Schema:** `NAVIGATION_TOOLS` in `services/gemini/agentTools.ts`  
  - **Command:** `NavigateToTextCommand` in `services/commands/navigation.ts`  
  - **Behavior:**
    - Searches the active chapter (or a specified chapter) for a query.  
    - Supports `searchType` = `exact`, `fuzzy`, `dialogue`, `character_mention`.
    - For dialogue/character searches, uses regex patterns to find relevant lines.
    - Scrolls editor to the match and selects the range.

- **`jump_to_chapter`**  
  - **Command:** `JumpToChapterCommand`  
  - **Behavior:** Finds a chapter by title or number (`"3"`, `"Chapter 3"`, etc.), selects it, and reports the new chapter title.

- **`jump_to_scene`**  
  - **Command:** `JumpToSceneCommand`  
  - **Behavior:** Uses structural scene data from the intelligence layer to jump to the **next/previous** scene of a given type (`action`, `dialogue`, etc.).

- **`scroll_to_position`**  
  - **Behavior in toolExecutor:** Calls `actions.scrollToPosition(position)` directly (no command object) and returns a short confirmation string.

### 2.2 Editing

**Purpose:** Apply concrete, auditable edits to the manuscript.

Representative tools:

- **`update_manuscript`**  
  - **Command:** `UpdateManuscriptCommand` in `services/commands/editing.ts`  
  - **Parameters:**
    - `searchText` / `search_text`: text to replace.  
    - `replacementText` / `replacement_text`: new text.  
    - `description`: human-readable description of the edit.
  - **Behavior:**
    - Runs inside `deps.runExclusiveEdit` to ensure safe, serialized edits.  
    - Replaces the **first** occurrence of `searchText` in the current chapter.  
    - Commits via `deps.commitEdit(newText, description, 'Agent')` so history/undo sees it.

- **`append_to_manuscript`**  
  - **Command:** `AppendTextCommand`  
  - **Behavior:** Appends text to the end of the active chapter and records the operation with `commitEdit` so it participates in undo/redo.

Agent edits are recorded in **CommandHistory** (unless they are pure memory tools). `CommandRegistry.isReversible(toolName)` marks which edits can be undone.

### 2.3 Analysis

**Purpose:** Trigger or summarize analysis based on current selection or manuscript.

Representative tools:

- **`get_critique_for_selection`**  
  - **Command:** `GetCritiqueCommand` in `services/commands/analysis.ts`  
  - **Behavior:**
    - Reads `deps.selection` from AppBrain.  
    - If nothing is selected, returns a helpful error.  
    - Otherwise, returns a short critique stub referencing the selection and optional `focus` (`prose`, `pacing`, etc.).

- **`run_analysis`**  
  - **Command:** `RunAnalysisCommand`  
  - **Behavior:**
    - Routes to more specific analysis functions based on `section`: `pacing`, `characters`, `plot`, `setting`.  
    - Falls back to `runFullAnalysis` over the manuscript text + setting.

The **full analysis pipeline** and token guard behavior are described in `docs/ARCHITECTURE.md` and `docs/token-limits.md`.

### 2.4 UI Control

**Purpose:** Let the agent adjust the UI so users can see what the agent is referring to.

Representative tools:

- **`switch_panel`**  
  - **Command:** `SwitchPanelCommand` in `services/commands/ui.ts`  
  - **Effect:** Sets the active sidebar panel (e.g. `analysis`, `chapters`, `lore`, `chat`).

- **`toggle_zen_mode`**  
  - **Command:** `ToggleZenModeCommand`  
  - **Effect:** Toggles distraction-free editor mode via AppBrain + layout store.

- **`highlight_text`**  
  - **Command:** `HighlightTextCommand`  
  - **Effect:** Highlights a given text range with a style (e.g. warning/suggestion) to draw user attention.

- **`set_selection`**  
  - **Command:** `SetSelectionCommand`  
  - **Effect:** Programmatically sets the editor selection; used when the agent wants to focus on a region without editing it.

### 2.5 Knowledge

**Purpose:** Query structured lore and story knowledge without changing the manuscript.

Representative tools:

- **`query_lore`**  
  - **Command:** `QueryLoreCommand` in `services/commands/knowledge.ts`  
  - **Effect:** Answers natural-language questions about the lore bible and indexed story knowledge.

- **`get_character_info`**  
  - **Command:** `GetCharacterInfoCommand`  
  - **Effect:** Surfaces consolidated facts and observations for a given character.

### 2.6 Generation

**Purpose:** Generate or rewrite text while keeping edits auditable.

Representative tools:

- **`rewrite_selection`**  
  - **Command:** `RewriteSelectionCommand` in `services/commands/generation.ts`  
  - **Effect:** Uses AI to propose a replacement for the selected text, then applies it through the same editing/undo pipeline.

- **`continue_writing`**  
  - **Command:** `ContinueWritingCommand`  
  - **Effect:** Generates continuation text from the current cursor.

- **`suggest_dialogue`**  
  - **Command:** `SuggestDialogueCommand`  
  - **Effect:** Generates candidate dialogue lines for a given character and emotional/contextual prompt.

### 2.7 Memory

**Purpose:** Let the agent manage long-term story and author knowledge.

Memory tools are defined in `agentTools.ts` and routed by `toolExecutor.ts` to the memory service in `services/memory`:

- **`write_memory_note`**  
  - Creates a `MemoryNote` (see `services/memory/types.ts`) via `createMemory`.
- **`search_memory`**  
  - Uses tag- and text-based queries over the `memories` table.
- **`update_memory_note`**, **`delete_memory_note`**  
  - Update or remove existing notes.
- **`create_goal`**, **`update_goal`**  
  - Manage `AgentGoal` entries in the `goals` table.
- **`watch_entity`**  
  - Adds a `WatchedEntity` for proactive monitoring (characters, items, rules).

These tools operate primarily on the **Dexie-backed memory tables** (`memories`, `goals`, `watchedEntities`) and are further described in `docs/MEMORY_SYSTEM.md`.

In addition, the AppBrain smart context builder maintains a **bedside-note planning memory** per project:

- Implemented as a `MemoryNote` with `type: 'plan'`, `scope: 'project'`, and a `topicTags` set that includes `meta:bedside-note`.
- Created automatically when smart agent context is first built for a project (if missing).
- Reordered to appear **first** in the project memory block of the `[AGENT MEMORY]` section, acting as the project's persistent "bedside note" for long-term planning.

Behind the scenes, this bedside note now participates in a **memory chain**:

- `useMemoryIntelligence` observes fresh analysis results and active goals, then calls a specialized helper (`evolveBedsideNote`) to update the bedside note with a short plan summary.
- `ProactiveThinker` combines proactive suggestions with important reminders and also calls `evolveBedsideNote` to keep the bedside plan aligned with what the agent thinks should happen next.

This bedside note is not a separate tool; it is just a specially tagged, **evolving** `MemoryNote` that can still be read and updated via the normal memory tools (e.g. `search_memory`, `update_memory_note`).

---

## 3. Tool Sets: Text vs Voice vs Quick

`services/gemini/agentTools.ts` defines three combined tool sets:

- **`ALL_AGENT_TOOLS`**  
  - Full tool surface for text chat.  
  - Includes navigation, editing, analysis, UI, knowledge, generation, and memory tools.

- **`VOICE_SAFE_TOOLS`**  
  - Subset used in voice mode, optimized for latency and safety.  
  - Includes navigation, knowledge, and non-destructive analysis / UI tools.  
  - Excludes tools like `highlight_text` and potentially heavy analysis commands.

- **`QUICK_TOOLS`**  
  - Minimal set for low-latency interactions: navigation, a core edit command, and basic knowledge lookup.

`useAgentOrchestrator` picks the appropriate tool list based on `mode`:

- `mode = 'text'` → `ALL_AGENT_TOOLS`
- `mode = 'voice'` → `VOICE_SAFE_TOOLS`

---

## 4. Adding a New Tool (Checklist)

When you want to add a new agent capability (for example, a "summarize current chapter" tool), follow this flow.

### 4.1 Design the behavior

- Decide which **category** it belongs to:
  - `navigation`, `editing`, `analysis`, `knowledge`, `ui`, `generation`, or `memory`.
- Decide whether it is **reversible** (can be undone) and whether it should appear in **voice** / **quick** tool sets.

### 4.2 Implement the command / action

- If the tool **edits or navigates** the manuscript or UI:
  - Add a new `AppBrainCommand` implementation under `services/commands/` (e.g. `summarizeChapter.ts` or extend an existing file if appropriate).
  - Wire it to AppBrain/environment via the appropriate `Dependencies` type (`NavigationDependencies`, `EditingDependencies`, etc.).
- If the tool operates **purely on memory**:
  - Extend the memory service in `services/memory/index.ts` or the relevant helper module (`autoObserver`, `sessionTracker`, etc.).

### 4.3 Register the command

- In `services/commands/registry.ts`:
  - Add a `CommandMeta` entry with:
    - `name`: **must** match the tool name you will use in `agentTools.ts`.
    - `category`: one of the known categories.
    - `description`: one-line explanation for logs / UIs.
    - `reversible`: `true` if the command supports undo via CommandHistory.
    - `factory`: returns a new instance of your command class.

This allows `CommandRegistry` and `ToolExecutor` to record executions and expose metadata.

### 4.4 Define the tool schema

- In `services/gemini/agentTools.ts`:
  - Add a `FunctionDeclaration` for your tool in the appropriate tool array (e.g. `ANALYSIS_TOOLS`).
  - Include:
    - `name`: exactly the same as the command name.
    - `description`: detailed instructions for the model.
    - `parameters`: a JSON schema object describing arguments (types, enums, required fields).
- If appropriate, add it to:
  - `VOICE_SAFE_TOOLS` (for safe voice use).  
  - `QUICK_TOOLS` (for latency-sensitive operations).

### 4.5 Wire through ToolExecutor (if needed)

- For most tools, `executeAppBrainToolCall` already switches on `toolName` and calls the right `actions.*` method.
- If you add a new tool:
  - Extend the `switch (toolName)` in `executeAppBrainToolCall` to call the correct AppBrain action or dependency method.
  - For memory tools, add the name to `MEMORY_TOOL_NAMES` and handle them in `executeMemoryToolCall`.

### 4.6 Add tests

- Add or extend tests under `tests/services/` and/or `tests/features/agent/` to cover:
  - Tool schema sanity (at least basic shape / name).
  - Command behavior in isolation (using fake AppBrain/dependency objects).
  - End-to-end flows for critical tools (via `useAgentOrchestrator` where appropriate).

---

## 5. Debugging Tool Calls

When a tool call misbehaves:

- **Check the schema** in `agentTools.ts`  
  - Are parameter names/types aligned with what the model is sending?
- **Check `toolExecutor.ts`**  
  - Does `executeAppBrainToolCall` or `executeMemoryToolCall` handle the tool name correctly?
  - Is the tool recorded in history when expected?
- **Check `CommandRegistry`**  
  - Is the command registered with the correct name/category/reversible flag?
- **Check AppBrain actions / dependencies**  
  - Are the underlying methods actually performing the intended navigation/edit/analysis?

For a deeper view of how tools interact with AppBrain and memory, see:

- `docs/ARCHITECTURE.md`  
- `docs/AGENT_ARCHITECTURE.md`  
- `docs/APP_BRAIN_FLOW.md`  
- `docs/MEMORY_SYSTEM.md`
