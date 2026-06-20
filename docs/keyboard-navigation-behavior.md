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
| `h` | If current entry is an expanded dir, collapse it; else move to parent |
| `j` | Move selection down |
| `k` | Move selection up |
| `l` | If current entry is a collapsed dir, expand it; else move to first child |
| `g` (once) | Arms pending-g (800ms timeout). On second `g`: jump to first entry |
| `G` | Jump to last entry |
| `Enter` | If dir: toggle expand/collapse. If file: open |
| `/` | Open search widget |
| `Ctrl+k` | Focus search input (if search is open) |
| `a` | Create file in current directory |
| `A` | Create directory in current directory |
| `R` | Refresh explorer tree |

### Non-vim navigation (always active)

Arrow keys (`ArrowDown`, `ArrowUp`, `ArrowRight`, `ArrowLeft`) and `Enter` work
identically to their vim counterparts. When `vimNavigationEnabled` is on, `j`/`k`/`h`/`l`
are normalized to Arrow keys via `normalizeVimKey`.

### Skipped conditions
Navigation is skipped when:
- A rename or pending create is in progress
- The event target is an input, textarea, or contentEditable element
- The file list is empty

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

| Key | Behavior |
|---|---|
| `j` | Move focus to next change (clamped) |
| `k` | Move focus to previous change (clamped) |
| `g` (once) | Arms pending-g (800ms timeout). On second `g`: jump to first change |
| `G` | Jump to last change |
| `l` | Open diff for focused entry |
| `Space` | Stage / unstage focused entry |
| `c` | Focus commit message input |
| `r` / `R` | Refresh source control status |
| `Enter` | Select file and open diff / focus editor |
| `s` / `S` | Stage / unstage (non-vim) |
| `d` / `D` | Request discard for unstaged changes |

### Escape from commit input

When `vimNavigationEnabled` is on and the commit message textarea is focused,
`Escape` refocuses the source control panel container.

### Skipped conditions
Vim and non-vim key handling is skipped when the event target is a
`TEXTAREA`, `INPUT`, or `contentEditable` element.

---

## 7. Shared Utilities (src/modules/explorer/lib/vimKeys.ts)

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
| any key with `ctrlKey`, `altKey`, or `metaKey` | `{ kind: "none" }` |
| other keys | `{ kind: "none" }` |

Any non-g key clears the pending-g timeout. Enter clears it too. Returns `none`
for unrecognized keys.

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
