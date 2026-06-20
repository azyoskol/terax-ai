# Keyboard Navigation Behavior Contract

This document describes the *current* keyboard navigation behavior across the
application. It serves as a behavior contract — any refactoring must preserve
these behaviors unless explicitly changed.

---

## 1. Global / Workspace Navigation (App.tsx)

### Ctrl+Tab / Ctrl+Shift+Tab — Tab switching

| Shortcut | Binding | Handler | Behavior |
|---|---|---|---|
| `Ctrl+Tab` | `tab.next` | Opens `BufferTabPicker` | Shows an overlay list of tabs in MRU order; user picks one with j/k/Enter/Escape |
| `Ctrl+Shift+Tab` | `tab.prev` | `stepSwitcher(-1)` | Steps backwards through MRU order (undocumented fallback; mainly for muscle-memory compat) |

Both are dispatched through the global shortcut system (`useGlobalShortcuts`).
They fire only when no modifier-ignoring conditions apply (see `shortcutsDisabled`).

### Ctrl+Space — Terminal prefix mode (App.tsx `vimNavigationEnabled` effect)

While a terminal is focused, `Ctrl+Space` arms terminal prefix mode. A status-bar
indicator shows the mode is active. The next keystroke is interpreted as a prefix
command:

| Key | Action |
|---|---|
| `h` | Focus pane left |
| `j` | Focus pane down |
| `k` | Focus pane up |
| `l` | Focus pane right |
| `e` | Focus file explorer |
| `b` | Open buffer tab picker |
| `s` | Open space switcher |
| `g` | Switch sidebar to source control and focus it |
| `t` | Step tab switcher forward (like plain Tab used to) |
| `T` | Step tab switcher backward (like Shift+Tab used to) |
| `q` / `Escape` | Cancel prefix mode (no action) |

After any key the mode deactivates automatically (one-shot).

### Ctrl+h (Vim) — Focus explorer (`workspace.focusExplorer`)

Default binding: `Ctrl+h`. When `vimNavigationEnabled` is on.

- **Disabled** when focus is inside `.xterm, [data-terminal]`, an `<input>` / `<textarea>`,
  `[data-file-explorer-search]`, `[data-file-explorer-search-results]`, or
  `[data-source-control]`.
- If the active element is already in the explorer or source-control panel, the
  shortcut is consumed (no re-focus).
- If focus is elsewhere, the explorer is focused.

### Ctrl+l (Vim) — Focus editor (`workspace.focusEditor`)

Default binding: `Ctrl+l`. When `vimNavigationEnabled` is on.

- Same disabled conditions as `workspace.focusExplorer`.
- If focus is already in the editor area, the shortcut is consumed.
- If focus is in the explorer or source control, focus moves to the editor.
- Special case inside `[data-file-explorer-search-results]`: `Ctrl+l` with
  `ctrlKey` refocuses the search input.

---

## 2. Terminal Prefix Mode

See §1 above. Accessed via `Ctrl+Space` from inside an xterm element.

The mode state is managed in `App.tsx` via `terminalPrefixRef` and
`terminalPrefixActive`. The `StatusBar` component displays an indicator when
active.

---

## 3. BufferTabPicker

| Key | Behavior |
|---|---|
| `j` | Select next tab (clamped to list length) |
| `k` | Select previous tab (clamped to 0) |
| `g` (once) | Arms pending-g (800ms timeout). On second `g`: jump to first tab |
| `G` | Jump to last tab |
| `Enter` | Activate selected tab and close picker |
| `Escape` | Close picker without activating |

Implementation details:
- Uses `interpretVimListKey` from `vimKeys.ts`.
- Skips handling if the event target is editable (`isEditableTarget`).
- Calls `preventDefault` + `stopPropagation` on all handled events.
- Registers a capture-phase `window.keydown` listener while open.
- Cleans up the pending-g timeout on unmount.
- Auto-selects the currently active tab on open.
- Scrolls the selected item into view.
- Click on backdrop closes without activating.

---

## 4. FileExplorer

### Vim navigation (when `vimNavigationEnabled` is true)

| Key | Behavior |
|---|---|
| `j` | Move selection down |
| `k` | Move selection up |
| `gg` | Jump to first visible item |
| `G` | Jump to last visible item |
| `h` | Collapse selected dir; move to parent when already collapsed |
| `l` | Expand selected dir; move to first child when already expanded |
| `Enter` | Open selected file; toggle dir expand/collapse |
| `o` | Same as Enter (open / activate) |
| `/` | Open search widget |
| `Ctrl+k` | Focus search input when search is open |
| `a` | Create file in current/selected directory |
| `A` | Create directory in current/selected directory |
| `R` | Refresh explorer tree |
| `r` | Rename selected file/folder (inline) |
| `d` | Delete selected file/folder (opens confirmation dialog) |
| `x` | Delete selected file/folder (opens confirmation dialog) |
| `y` | Copy absolute path to clipboard |
| `Y` | Copy relative path to clipboard (from workspace root) |
| `O` | Reveal selected item in OS file manager |
| `?` | Toggle keyboard help overlay |

### Delete confirmation behavior

`d` and `x` never delete immediately. They open an `AlertDialog`:
- Title: "Delete file?" or "Delete folder?"
- Body shows the item name; folder deletion mentions recursive removal.
- Cancel dismisses without any change.
- Confirm calls `fs_delete` and clears the selection if it pointed to the deleted path.
- If deletion fails, selection stays on the failed item.

### Non-vim navigation (always active)

Arrow keys (`ArrowDown`, `ArrowUp`, `ArrowRight`, `ArrowLeft`) and `Enter` work
identically to their vim counterparts.

### Skipped conditions
Navigation is skipped when:
- A rename or pending create is in progress
- A delete confirmation dialog is open
- The event target is an input, textarea, or contentEditable element
- The file list is empty (search/create/refresh still work)

---

## 5. ExplorerSearch

### Input field

| Key | Behavior |
|---|---|
| `Escape` | Close search |
| `Ctrl+j` | Jump focus to results list (or focus tree if no results) |
| `ArrowDown` | Select next result (wraps around) |
| `ArrowUp` | Select previous result (wraps around) |
| `Enter` | Activate selected result (open file / toggle folder) |

### Results list

| Key | Behavior |
|---|---|
| `j` | Select next result (clamped to list length) |
| `k` | Select previous result (clamped to 0) |
| `g` (once) | Arms pending-g (800ms timeout). On second `g`: jump to first result |
| `G` | Jump to last result |
| `Enter` | Activate selected result |
| `Ctrl+k` | Focus back to search input |
| `Ctrl+l` | Focus back to search input |
| (non-vim) `ArrowDown` / `ArrowUp` — also work |

### Global listener (while results open)

A capture-phase `window.keydown` listener handles `g` key for gg navigation
from outside the results list. If focus is in an editable target or a modifier
is held, the listener bails out.

---

## 6. SourceControlPanel

### Vim navigation (when `vimNavigationEnabled` is true)

| Key | Behavior |
|---|---|
| `j` | Move focus to next changed file (clamped) |
| `k` | Move focus to previous changed file (clamped) |
| `gg` | Jump to first changed file |
| `G` | Jump to last changed file |
| `l` / `Enter` | Open diff for focused entry and move focus to diff view |
| `Space` | Stage / unstage focused entry |
| `c` | Focus commit message input |
| `r` / `R` | Refresh source control status |
| `f` | Fetch from remote (when upstream configured and not busy) |
| `P` | Pull fast-forward (when behind remote and not diverged) |
| `p` | Push (when push is available and not busy) |
| `b` | Focus branch selector element |
| `g` | Open Commit Graph (also arms pending-g for gg) |
| `?` | Toggle keyboard help overlay |
| `Ctrl/Cmd+R` | Refresh (always active, not vim-only) |

### Empty-state behavior
When the working tree is clean: `c`, `r`, `f`, `P`, `p`, `b`, `g`, `?` still work.
File navigation (`j`/`k`/`gg`/`G`/`l`/`Space`) does nothing when there are no changed files.

### Non-vim keys (always active)

| Key | Behavior |
|---|---|
| `ArrowDown` / `ArrowUp` | Navigate files |
| `Enter` | Open diff for focused entry |
| `Space` / `s` / `S` | Stage / unstage focused entry |
| `d` / `D` | Request discard for unstaged changes |
| `Ctrl/Cmd+Enter` | Commit (when in commit message textarea) |
| `Ctrl/Cmd+G` | Generate commit message (when AI available) |
| `Escape` | Return focus to panel container (when in commit textarea, vim mode) |

### Skipped conditions
All key handling is skipped when the event target is a `TEXTAREA`, `INPUT`, or
`contentEditable` element (except `Ctrl+Enter` and `Ctrl+G` which are handled
inside the commit textarea itself).

### Data attributes on action buttons

| Attribute | Element |
|---|---|
| `data-source-control-branch` | Branch label area in header |
| `data-source-control-commit-graph` | Commit Graph button |
| `data-source-control-fetch` | Fetch icon button |
| `data-source-control-pull` | Pull icon button |
| `data-source-control-refresh` | Refresh icon button |
| `data-source-control-push` | Push button |
| `data-source-control-help` | Keyboard help overlay |

---

## 7. SpaceSwitcher

### Vim navigation (when `vimNavigationEnabled` is true)

| Key | Behavior |
|---|---|
| `j` | Select next item (space or tab, clamped) |
| `k` | Select previous item (clamped) |
| `gg` | Jump to first item |
| `G` | Jump to last item |
| `Enter` / `l` | Activate selected item (switch space / jump to tab) and close |
| `h` | Collapse selected space (if expanded) |
| `Escape` | Close switcher without activating |
| `a` / `n` | Create new space |
| `r` | Rename selected space (enters inline rename mode) |
| `m` | Move current active tab to selected space |
| `d` / `x` | Delete selected space (opens confirmation dialog; last space protected) |
| `?` | Toggle keyboard help overlay |

### Delete confirmation behavior

`d` and `x` never delete the last remaining space. When there is more than one
space, they open an `AlertDialog` with Cancel and Delete buttons. If the space
has tabs, the dialog body shows how many tabs will be removed.

### Dispatch details

- Uses `interpretVimListKey` for `j`/`k`/`gg`/`G`/`Enter`/`Escape`, same pattern as BufferTabPicker.
- `h`, `l`, `a`/`n`, `r`, `d`/`x`, `m`, `?` are handled via `onUnhandledPlainKey`.
- Skips all handling if the event target is editable (`isEditableTarget`).
- Enter/Escape activate even when `vimNavigationEnabled` is off.
- `j`/`k`/`gg`/`G`/`h`/`l`/`a`/`n`/`r`/`d`/`x`/`m`/`?` only work when `vimNavigationEnabled` is on.
- Resets selection index to 0 on open; resets `showHelp` to false on open.

### Props

`SpaceSwitcher` accepts `activeTabId: number | null` (passed from App.tsx active
tab ID) used by the `m` key to identify which tab to move.

---

## 8. Shared Utilities (src/modules/keyboard/core/vimList.ts)

### `interpretVimListKey(e, pendingGRef)`

| Input | Output |
|---|---|
| `j` (plain) | `{ kind: "next" }` |
| `k` (plain) | `{ kind: "prev" }` |
| `g` (plain, first press) | `{ kind: "armG" }` + arms 800ms timeout |
| `g` (plain, second press within timeout) | `{ kind: "first" }` + clears timeout |
| `G` (plain) | `{ kind: "last" }` |
| `Enter` (plain) | `{ kind: "activate" }` |
| `Escape` (plain) | `{ kind: "escape" }` |
| any key with `ctrlKey`, `altKey`, or `metaKey` | `{ kind: "none" }` (pending g cleared) |
| other keys | `{ kind: "none" }` (pending g cleared) |

Any non-`g` key clears the pending-g timeout before evaluating the action
(including modified keys, `G`, `Enter`, `Escape`, `j`, `k`, and unknown keys).
Returns `none` for unrecognized keys.

### `normalizeVimKey(key)`

| Input | Output |
|---|---|
| `h` | `ArrowLeft` |
| `j` | `ArrowDown` |
| `k` | `ArrowUp` |
| `l` | `ArrowRight` |
| anything else | unchanged |

### Guard helpers

- `isPlainVimKey(e)` — true when no ctrl/alt/meta modifier is pressed
- `isPendingGKey(e)` — true for a plain unmodified `g`
- `isCapitalGKey(e)` — true for a plain unmodified `G`
- `isEditableTarget(target)` — true for INPUT, TEXTAREA, contentEditable
- `isTerminalTarget(target)` — true if target is inside `.xterm`

---

## 9. Architecture / Migration Notes

### File layout

```
src/modules/keyboard/
  core/
    vimList.ts                  — shared utilities (normalizeVimKey,
                                  interpretVimListKey, guard helpers)
    vimList.test.ts
    listNavigation.test.ts
  hooks/
    useVimListNavigation.ts     — hook wrapping interpretVimListKey
                                   with state management
    useVimListNavigation.test.ts
    useVimScrollNavigation.ts   — hook for j/k/gg/G scroll container nav
    useVimScrollNavigation.test.ts
```

### Compatibility re-export

`src/modules/explorer/lib/vimKeys.ts` is a temporary compatibility re-export:

```ts
export * from "@/modules/keyboard/core/vimList";
```

It will be removed once all remaining consumers (FileExplorer, ExplorerSearch,
SourceControlPanel, GitDiffPane) are migrated to the new import paths.

### Migrated consumers

| Component | Uses | Notes |
|---|---|---|
| BufferTabPicker | `useVimListNavigation` | Hook manages j/k/gg/G/Enter/Escape + editable target guard + pending-g cleanup |
| SpaceSwitcher | `useVimListNavigation` | Hook + `onUnhandledPlainKey` for h/l expand/collapse. The early modifier guard (`if (e.ctrlKey ...) return`) before `interpretVimListKey` was removed — the function handles modifiers internally. |
| ExplorerSearch | `useVimListNavigation` | Hook manages results-list Vim navigation (j/k/gg/G/Enter). Input-specific behavior (Escape, Ctrl+j, ArrowDown/ArrowUp wrap) remains local because of different wrap/focus semantics. Ctrl+k/Ctrl+l (focus input) handled before the hook. Global window listener forwards only `g` to the hook (so gg from outside the results list routes to search results, not the tree); other keys call `clearPendingG`. |
| SourceControlPanel | `interpretVimListKey` (core) | Uses `interpretVimListKey` directly (not the hook) because of non-contiguous focusable indices (banners, headers interleaved with entries) and virtualized scrolling via `@tanstack/react-virtual`. Domain actions (`l`, `c`, `r`/`R`, Space) remain local. ArrowDown/ArrowUp/s/S/d/D handled in non-vim fallback section. |
| GitDiffPane | `interpretVimListKey` (core) | Scrolls a CodeMirror view (not a list). Uses `interpretVimListKey` directly with `scrollDiff` callbacks for j/k/gg/G. |

### Not yet migrated

- FileExplorer
- Terminal prefix mode in App.tsx
- Workspace focus shortcuts (`workspace.focusExplorer`, `workspace.focusEditor`)

These still import from the compatibility re-export at `@/modules/explorer/lib/vimKeys`.

---

## 10. Markdown files

### Preview / rendered mode

When a `.md` file is opened, it renders in preview mode. The preview container is
focusable and responds to Vim navigation keys:

| Key | Behavior |
|---|---|
| `j` | Scroll down (60px step) |
| `k` | Scroll up (60px step) |
| `g` (once) | Arms pending-g (800ms timeout). On second `g`: scroll to top |
| `G` | Scroll to bottom |
| `e` | Switch to raw/edit mode and focus the CodeMirror editor |
| `i` | Switch to raw/edit mode and focus the CodeMirror editor |
| `Enter` | Switch to raw/edit mode and focus the CodeMirror editor |

These keys are not handled when focus is inside an input, textarea, or
contentEditable element.

### Raw / edit mode

When a markdown tab is in raw/edit mode, it is rendered as an `EditorTab` with
CodeMirror. Keyboard handling is owned by CodeMirror/editor Vim mode:

- `j` / `k` are line-motion keys (CodeMirror native or Vim mode)
- `gg` / `G` jump to first/last line
- `Escape` is not intercepted by the application — it stays inside the editor's
  Vim mode
- Switching to preview mode is done through:
  - `Ctrl+Shift+V` keyboard shortcut
  - "Markdown: Toggle preview/edit" command palette action
  - "Markdown: Switch to preview / edit" command palette actions
  - Toolbar "Rendered" / "Raw" pill buttons

### Commands

| Command | Shortcut | Description |
|---|---|---|
| `markdown.toggleMode` | `Ctrl+Shift+V` | Toggle between rendered preview and raw editor |
| `markdown.preview` | — | Switch current markdown tab to rendered preview |
| `markdown.edit` | — | Switch current markdown tab to raw editor |

### Technical notes

- The `useVimScrollNavigation` hook provides `j`/`k`/`gg`/`G` scrolling in the
  rendered preview container, using `interpretVimListKey` for key interpretation
  and `isEditableTarget` for target filtering.
- Mode-switching keys (`e`/`i`/`Enter`) are handled in `MarkdownPreviewPane`
  after the scroll hook processes the event, ensuring no conflict between
  scroll and switch actions.
- The toggle shortcut only fires when the active tab is a markdown file
  (either `kind: "markdown"` or `kind: "editor"` with a `.md` path).
