# Markdown Keyboard Navigation Design

## Purpose

Implement Vim-like Markdown navigation that respects both rendered (preview) and raw (edit) modes, without key conflicts between app-level handlers and CodeMirror's Vim mode.

## Current State

- `useVimScrollNavigation` hook exists and handles `j`/`k`/`gg`/`G` scrolling with editable-target guard and pending-G cleanup
- `MarkdownPreviewPane` already uses this hook and focuses the scroll container on visibility change
- `setMarkdownView` (in `useTabs.ts`) toggles tabs between `kind: "markdown"` (rendered) and `kind: "editor"` (raw), with a dirty-check blocking switch to rendered when unsaved edits exist
- `MarkdownViewToggle` component provides rendered/raw pill buttons in both modes
- No markdown-specific keyboard shortcuts or command palette items exist yet

## Changes

### 1. Preview mode keys (`MarkdownPreviewPane.tsx`)

Add `data-markdown-preview` attribute to the scrollable container.

In `handleKeyDown`, after the scroll navigation hook runs:

| Key | Action |
|-----|--------|
| `e` | Switch to raw/edit mode |
| `i` | Switch to raw/edit mode |
| `Enter` | Switch to raw/edit mode |

These keys are guarded: ignored if the event target is editable (input, textarea, contentEditable). Since this component only renders in preview mode, no additional mode check is needed.

Import `isEditableTarget` from `@/modules/keyboard/core/targets`.

### 2. Command palette items (`commands.ts`)

Extend `CommandPaletteActionContext` with:
```ts
setMarkdownView?: (id: number, mode: "rendered" | "raw") => void;
```

Add three command items (shown only when active tab is a markdown file):

| Command ID | Title | Condition | Action |
|---|---|---|---|
| `markdown.preview` | "Markdown: Switch to preview" | Active tab is raw editor with `.md` path | `setMarkdownView(id, "rendered")` |
| `markdown.edit` | "Markdown: Switch to edit" | Active tab is rendered markdown | `setMarkdownView(id, "raw")` |
| `markdown.toggleMode` | "Markdown: Toggle preview/edit" | Active tab is any markdown file | Toggle between modes |

### 3. Wire context (`App.tsx`)

Pass `setMarkdownView` from the `useTabs` return value to `createCommandItems`.

### 4. Shortcut registration (`shortcuts.ts`)

Add `markdown.toggleMode` shortcut:

| Property | Value |
|---|---|
| `id` | `markdown.toggleMode` |
| `label` | "Markdown: Toggle preview/edit" |
| `group` | `"View"` |
| `defaultBindings` | `[{ ctrl: true, shift: true, key: "v" }]` |

No conflicts found in existing shortcut registry (`Ctrl+Shift+V` is unused).

### 5. Documentation (`docs/keyboard-navigation-behavior.md`)

Add section "9. Markdown files" covering:

**Preview / rendered mode:**
- `j` scrolls down
- `k` scrolls up
- `gg` scrolls to top
- `G` scrolls to bottom
- `e` / `i` / `Enter` switch to raw/edit mode

**Raw / edit mode:**
- Keyboard owned by CodeMirror/editor/Vim mode
- `Escape` not used to switch to preview (stays in editor Vim mode)
- Preview/raw switching via explicit command (`Ctrl+Shift+V`) or toolbar button

### 6. Tests

**`useVimScrollNavigation.test.ts`** — already covers j/k/gg/G, disabled mode, editable target, pending-G cleanup. No changes needed.

**New tests for markdown preview behavior** (in `MarkdownPreviewPane.test.ts` or similar):
- `e` in preview mode calls `onSetView("raw")`
- `i` in preview mode calls `onSetView("raw")`
- `Enter` in preview mode calls `onSetView("raw")`
- `e`/`i`/`Enter` on editable target does nothing
- `j` in preview mode scrolls (not switches mode)
- Preview container has `data-markdown-preview` attribute
- Preview container receives focus when tab becomes visible

## Non-goals

- No changes to `useVimScrollNavigation` hook (mode switching is markdown-specific)
- No changes to raw/edit mode keyboard handling (CodeMirror owns it)
- No Escape→preview toggle in any mode

## Files affected

| File | Change |
|---|---|
| `src/modules/markdown/MarkdownPreviewPane.tsx` | Add data attribute, e/i/Enter mode switching |
| `src/modules/command-palette/commands.ts` | Add 3 markdown commands, extend context type |
| `src/modules/command-palette/types.ts` | May need type update for context |
| `src/modules/shortcuts/shortcuts.ts` | Add markdown.toggleMode |
| `src/app/App.tsx` | Wire setMarkdownView to command palette context |
| `docs/keyboard-navigation-behavior.md` | Add Markdown section |
| New test file | Markdown preview behavior tests |
