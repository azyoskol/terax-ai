# Keyboard/Focus Architecture Audit & Improvement Plan

## Implementation Status

| Area | Status | Notes |
|------|--------|-------|
| Shared focus helpers | **Adopted in App + targets** | `focusWithRetry`, `focusEditorWithRetry`, `focusElementBySelectorWithRetry` replace inline retry loops. More call sites can migrate later. |
| Surface registry | **Foundation only** | `KeyboardSurfaceRegistry` exists. App registers editor + explorer, but registration is stale (refs may not exist when the `[]` effect runs). No other surface registers. |
| Surface context / `useRegisterSurface` | **Foundation only** | Hook exists but is not used by any surface component. |
| Scoped keymap | **Foundation improved, not adopted** | `useScopedKeymap` now supports modifiers, `gg` sequences, strict scope behavior, and help generation from binding descriptors. Not yet used by any panel. |
| Help overlay | **UI component only** | `KeyboardHelpOverlay` renders a list of `{key, description}`. Help is still passed manually as a static array; not generated from binding definitions. |
| GitHistory | **Partial** | Uses shared `KeyboardHelpOverlay` and shared `isEditableTarget`. Key handling is still entirely local (`handleKeyDown` with `interpretVimListKey`). |
| SourceControl | **Local handler** | Uses shared `isEditableTarget` guard. All key handling remains local. |
| FileExplorer | **Local vim tree hook** | Uses `useVimTreeNavigation` (good local abstraction). Uses shared `isEditableTarget`. Not surface-registry based. |
| MarkdownPreview | **Local** | Uses `useVimScrollNavigation` and shared `isEditableTarget`. Not surface-registry based. |
| SpaceSwitcher | **Local** | Uses `useVimListNavigation` directly on window. Not surface-registry based. |
| confirmDialog | **Shared utility** | Works well. Has its own inline editable-target check (intentional: must work with mock targets in tests). |
| Editable target guards | **Consistent** | `isEditableTarget` from `targets.ts` is now used in FileExplorer, GitDiffPane, SourceControlPanel, and MarkdownPreviewPane. |

---

## 1. Current Architecture Map

### 1.1 Global Shortcuts System

**Registration:** `useGlobalShortcuts` hook (`src/modules/shortcuts/lib/useGlobalShortcuts.ts`)
- Single `keydown` listener on `window` in **capture phase** (`{ capture: true }`)
- Iterates `SHORTCUTS` array (single source of truth in `shortcuts.ts`) on every event
- First-match-wins iteration order = priority order
- `stopImmediatePropagation()` prevents downstream listeners

**Definitions:** `src/modules/shortcuts/shortcuts.ts`
- ~50 shortcut IDs in `ShortcutId` union type
- Platform-aware via `MOD_PROP` (`"meta"` on macOS, `"ctrl"` elsewhere)
- User customizations override defaults via preferences store

**Disable logic:** `App.tsx`
- `isDisabled` callback receives `(shortcutId, KeyboardEvent)` for context-aware suppression
- Terminal focus suppresses `sidebar.toggle` (plain), `tab.next`, `ai.askSelection`
- Editor-specific shortcuts disabled when not on editor tabs
- Vim navigation disabled when preference is off

**Protected targets:**
- `isEditableTarget()` in `targets.ts` — INPUT, TEXTAREA, contentEditable
- `isTerminalTarget()` in `targets.ts` — `.xterm` ancestor
- Most shortcuts bail when editable target is focused

**Conflict prevention:**
- No runtime conflict detection
- Structural: first-match-wins, `stopImmediatePropagation()`, `isDisabled` callback
- Platform-aware bindings avoid cross-platform conflicts

### 1.2 Scoped Keyboard System

**Hooks in `src/modules/keyboard/hooks/`:**

| Hook | Purpose | Focus Management | Editable Guard |
|------|---------|------------------|----------------|
| `useVimListNavigation` | j/k/gg/G/Enter/Escape for flat lists | None | Caller-provided callback |
| `useVimTreeNavigation` | Tree navigation + operations (a/r/d/y/?/o) | None | Caller-provided callback |
| `useVimScrollNavigation` | j/k/gg/G for scroll panes | None | Internal `isEditableTarget` |
| `useTerminalPrefix` | Ctrl+Space prefix for terminal nav | `focusSourceControlPanel()` retry | `isTerminalTarget` |
| `useScopedKeymap` | Declarative single-key bindings for surfaces | None | `isEditableTarget` (configurable) |

**Core utilities in `src/modules/keyboard/core/`:**

| File | Purpose |
|------|---------|
| `vimList.ts` | `interpretVimListKey()` state machine, `normalizeVimKey()`, `isPlainVimKey()`, pending-g detection |
| `targets.ts` | DOM predicates (`isEditableTarget`, `isTerminalTarget`, `isInExplorer`, etc.) |
| `confirmDialog.ts` | Shared Enter/y/Y confirm, Escape/n/N cancel handler |
| `focusHelpers.ts` | `focusWithRetry`, `focusElementBySelectorWithRetry`, `focusEditorWithRetry` |
| `KeyboardSurfaceRegistry.ts` | Central registry for keyboard surfaces (focus, scope, help) |
| `KeyboardSurfaceContext.ts` | React context + `useRegisterSurface` hook |

**Components in `src/modules/keyboard/components/`:**

| File | Purpose |
|------|---------|
| `KeyboardHelpOverlay.tsx` | Shared modal help overlay (renders `{key, description}` list) |

### 1.3 Focus Management Architecture

**WorkspaceSurface** (`src/app/components/WorkspaceSurface.tsx`):
- Stack-and-toggle pattern: all tab surfaces mounted, inactive ones get `invisible pointer-events-none`
- Preserves terminal buffers, editor scroll positions across tab switches

**Sidebar focus orchestration** (`src/modules/sidebar/useSidebarPanel.ts`):
- `explorerReturnFocusRef` — saves/restores focus across sidebar open/close
- `lastSidebarSurfaceRef` — tracks which sub-surface was last focused
- `restoreEditorFocus()` — fallback chain: saved ref → diff view → markdown preview → CodeMirror → data-editor

**Focus retry patterns:**
1. `focusWithRetry()` in `focusHelpers.ts` — generic retry, up to 30 rAF attempts
2. `focusEditorWithRetry()` in `focusHelpers.ts` — editor-specific, up to 15 attempts
3. `focusElementBySelectorWithRetry()` in `focusHelpers.ts` — DOM query + focus, up to 10 attempts
4. Single-shot `requestAnimationFrame(() => el.focus())` — many instances across codebase

### 1.4 Data Attribute Coordination

All focus detection uses `data-*` attributes queried via `element.closest()` or `document.querySelector`:

| Attribute | Module | Purpose |
|-----------|--------|---------|
| `data-editor` | Editor | Root editor scope |
| `data-markdown-preview` | Markdown | Preview pane focus target |
| `data-tab-id` | Tabs/Markdown | Identifies specific tab instance |
| `data-file-explorer` | Explorer | Root explorer scope |
| `data-file-explorer-search` | Explorer | Search input target |
| `data-file-explorer-search-results` | Explorer | Search results target |
| `data-source-control` | Source Control | Root SCM scope |
| `data-source-control-changes` | Source Control | Changes list target |
| `data-source-control-diff` | Editor/GitDiff | Diff view target |
| `data-git-history` | Git History | Root git history scope |

---

## 2. Current Keyboard Scopes

### 2.1 Actual Scopes (implicit, not formalized)

| Scope | Where Active | Key Handlers |
|-------|--------------|--------------|
| `global` | Window capture phase | `useGlobalShortcuts` |
| `editor` | CodeMirror focus | CM keymap extensions |
| `terminal` | `.xterm` focus | xterm.js native + `useTerminalPrefix` |
| `markdown-preview` | `data-markdown-preview` focus | `useVimScrollNavigation` + local keys |
| `file-explorer` | `data-file-explorer` focus | `useVimTreeNavigation` + local keys |
| `explorer-search` | `data-file-explorer-search` focus | Local handler + `useVimListNavigation` |
| `source-control` | `data-source-control` focus | Local handler with `interpretVimListKey` |
| `git-history` | `data-git-history` focus | Local handler with `interpretVimListKey` |
| `space-switcher` | Popover open | `useVimListNavigation` on window |
| `buffer-picker` | Popover open | `useVimListNavigation` on window |
| `dialog` | Alert dialog open | Radix focus trap or `handleConfirmDialogKeyDown` |
| `git-diff` | `data-source-control-diff` focus | Local handler with `interpretVimListKey` |

### 2.2 Scope Detection Method

No formal scope registry. Detection is ad-hoc via:
- `element.closest("[data-*]")` checks in `targets.ts`
- `isTerminalTarget()` checking `.xterm` ancestor
- `isEditableTarget()` checking INPUT/TEXTAREA/contentEditable
- Contextual checks in `App.tsx` `isDisabled` callback

---

## 3. Current Focus Flows

### 3.1 Who Focuses What

| Target | Focus Trigger | Mechanism |
|--------|---------------|-----------|
| Editor (CodeMirror) | Tab switch, Ctrl+L, file open | `activeEditorHandleRef.current?.focus()` + `focusEditorWithRetry` |
| Markdown preview | Tab switch, Ctrl+M toggle | `retryAnimationFrames` checking `[data-markdown-preview]` |
| Source Control panel | Ctrl+Shift+G, terminal prefix `g` | `focusSourceControlPanel()` → `focusElementBySelectorWithRetry` |
| File Explorer tree | Ctrl+Shift+E, Ctrl+H | `toggleExplorerFocus()` / `focusExplorer()` in sidebar |
| Explorer search | `/` in explorer, Ctrl+E | `searchRef.current?.focus()` |
| Explorer search results | Ctrl+J from search input | `scrollRef.current?.focus()` |
| Git History | Ctrl+Shift+H | IntersectionObserver auto-focus on mount |
| Git Diff pane | `l`/Enter in source control | `focusDiffOrEditor()` with rAF |
| Space switcher | Ctrl+Shift+Space | Radix popover focus trap |
| Buffer picker | Ctrl+P | Radix popover focus trap |

### 3.2 Focus Return Flows

| From | To | Mechanism |
|------|----|-----------|
| Explorer search close | Explorer tree | `requestAnimationFrame(() => containerRef.current?.focus())` |
| Git History popover close | Git History container | `requestAnimationFrame(() => containerRef.current?.focus())` |
| Source Control → Editor | CodeMirror | `restoreEditorFocus()` fallback chain |
| Sidebar → Editor | CodeMirror | `restoreEditorFocus()` with `explorerReturnFocusRef` |
| Space switcher close | Previous focus | `setSwitcherOpen(false)` + `focusEditorWithRetry` |
| Buffer picker close | Activated tab | `handleBufferActivate()` + `focusEditorWithRetry` |
| Inline rename cancel | Parent container | `requestAnimationFrame` focus restore |

---

## 4. Actual vs Target Architecture

### Focus helpers

**Current:** `focusWithRetry`, `focusEditorWithRetry`, `focusElementBySelectorWithRetry` are extracted and used in App.tsx and targets.ts. Many single-shot `requestAnimationFrame(() => el.focus())` calls remain scattered.

**Target:** All focus retry patterns use shared helpers. Single-shot defers are acceptable.

**Gap:** ~15 single-shot rAF focus calls remain in GitHistory, Explorer, Sidebar, Composer, ShellInput, InlineInput. These are fine as-is; the shared helpers cover the complex retry cases.

**Next step:** Migrate single-shot patterns only if they prove buggy.

### Surface registry

**Current:** `KeyboardSurfaceRegistry` exists. App.tsx registers editor + explorer in a `useEffect([], [])`. The registration may be stale because refs may not exist when the effect runs.

**Target:** Each focusable surface self-registers via `useRegisterSurface`.

**Gap:** Registration is centralized in App and possibly stale. No surface uses `useRegisterSurface`.

**Next step:** Move registration into surface components one by one, starting with GitHistoryPane (clear root element, simple registration).

### Scoped keymaps

**Current:** `useScopedKeymap` supports modifiers, `gg` sequences, strict scope behavior (`activeWhenNoSurface: false` by default), and help generation from binding descriptors. Not used by any panel yet.

**Target:** Panels use scoped keymaps for their key handling.

**Gap:** Not adopted yet. No priority system between keymaps. No capture/bubble configuration.

**Next step:** Migrate GitHistory first (has clear root, finite keymap, existing help overlay).

### Help overlays

**Current:** `KeyboardHelpOverlay` renders a list of `{key, description}`. `getBindingHelp()` can generate help from binding descriptors. GitHistory passes a static array. SourceControl and FileExplorer have inline help panels.

**Target:** Help text generated from binding definitions.

**Gap:** Panels pass help manually. SourceControl and FileExplorer use different help UI (inline panels, not modal overlays).

**Next step:** Keep as-is for now; the modal overlay works for GitHistory.

### Panel-specific key handlers

**Current:** Each panel has its own `handleKeyDown` using `interpretVimListKey` or custom logic.

**Target:** Panels use `useScopedKeymap` with shared vim interpretation.

**Gap:** `useScopedKeymap` doesn't support Vim sequences yet, so panels can't migrate.

**Next step:** Add sequence support to `useScopedKeymap` first.

### Dialog/popover focus restore

**Current:** Each dialog/popover handles focus restore independently (rAF, fallback chains).

**Target:** Shared focus restore helpers.

**Gap:** Focus restore is mostly working; the patterns are consistent enough.

**Next step:** No urgent work needed.

### Tests

**Current:** Basic tests for `focusHelpers` and `KeyboardSurfaceRegistry`.

**Target:** Focus lifecycle tests, scoped keymap tests, registry integration tests.

**Gap:** Tests are minimal (export checks, basic registry ops).

**Next step:** Add more tests in a dedicated testing phase.

---

## 5. Known Limitations

### `useScopedKeymap` limitations

1. Not adopted by any panel yet — foundation only
2. No priority system between keymaps
3. No capture/bubble configuration (always uses bubble phase on window)
4. Help generation is available from binding descriptors, but panels do not use it yet
5. Does not replace `interpretVimListKey` yet — panels still use their own vim handling
6. Sequence support is simple (same-scope `gg` style) — no arbitrary trie for complex multi-key combos
7. Attaches to `window` via `addEventListener` — no component-level scoping

### `KeyboardSurfaceRegistry` limitations

1. Registration in App may be stale (refs may not exist when effect runs)
2. `useRegisterSurface` exists but is unused
3. No surface currently self-registers
4. `getFocused()` iterates all surfaces — O(n) per keystroke
5. No subscription for "which scope is focused" changes

### Help overlay limitations

1. SourceControl and FileExplorer use inline help panels, not the shared component
2. Help text is manually maintained, not derived from binding definitions
3. Help items don't distinguish between vim-mode and non-vim-mode bindings

### Migration note: next candidate for adoption

**GitHistory** is the best first candidate for `useScopedKeymap` adoption because it has:
- Clear focus root `[data-git-history]`
- Finite keymap (j/k, gg/G, Enter, Space, r, o, y, ?, Esc)
- Existing `selectedRow` state (no complex tree)
- Existing help overlay (already uses `KeyboardHelpOverlay`)
- No complex tree expand/collapse logic

SourceControl should be migrated only after GitHistory is stable and proven.

---

## 6. Known Bugs / Urgent Issues

These are separate from architecture work:

- SourceControl row click may not open diff consistently
- Escape from commit textarea focus return may be inconsistent
- GitHistory details popover focus after close may be unreliable
- Confirmation dialogs Enter/y/n/Esc may have edge cases with editable targets

---

## 7. Proposed Target Architecture

### 7.1 Keyboard Scopes (Formalized)

```typescript
type KeyboardScope =
  | "global"
  | "terminal"
  | "editor"
  | "markdown-preview"
  | "file-explorer"
  | "explorer-search"
  | "source-control"
  | "git-history"
  | "git-diff"
  | "space-switcher"
  | "buffer-picker"
  | "dialog"
  | "popover";
```

### 7.2 Surface Focus Registry

```typescript
type KeyboardSurfaceHandle = {
  id: string;
  scope: KeyboardScope;
  focus: () => boolean | void;
  isFocused: () => boolean;
  getHelp?: () => KeyBindingHelp[];
};
```

### 7.3 Scoped Keymap (Implemented, Not Adopted)

```typescript
type KeyBinding = {
  key: string;
  description: string;
  helpKey?: string;           // display label for help
  sequence?: string;          // e.g., "gg"
  modifiers?: {
    ctrl?: boolean;
    meta?: boolean;
    alt?: boolean;
    shift?: boolean;
  };
  action: (event: KeyboardEvent) => void;
  when?: () => boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  hidden?: boolean;           // exclude from help
};
```

**Available options:**
- `activeWhenNoSurface` — default `false`, strict scope behavior
- `sequenceTimeoutMs` — default `700ms`

**Pure helpers exported:**
- `matchesKeyBinding(event, binding)` — check if event matches binding
- `matchesModifiers(event, modifiers)` — check modifier match
- `getBindingHelp(bindings)` — generate help items from descriptors

### 7.4 Shared Keymap Help

Use the same binding definitions for:
- Actual handlers (via `useScopedKeymap`)
- `?` help overlays (via `getHelp()` on surface handle)
- Documentation/checklists where practical

### 7.5 Focus Return Helpers

```typescript
function focusWithRetry(fn: () => boolean, options?: { maxAttempts?: number }): void;
function focusElementBySelectorWithRetry(selector: string): void;
function focusEditorWithRetry(editorHandle: { focus: () => void } | null): void;
```

---

## 8. Incremental Migration Plan

### Phase 0 — Stabilize current UX bugs

**Goal:** Fix known keyboard UX issues without architecture changes.

**Tasks:**
- [ ] SourceControl row click opens diff
- [ ] Esc from commit textarea returns panel focus
- [ ] GitGraph focus after details closes
- [ ] Confirm dialogs Enter/y/n/Esc edge cases

**Files likely touched:** SourceControlPanel.tsx, GitHistoryPane.tsx, confirmDialog.ts
**Risk level:** Low
**Acceptance criteria:** All behaviors work as expected
**What not to change:** Any architecture or keyboard handling structure

---

### Phase 1 — Complete helper adoption

**Goal:** Replace remaining duplicated focus retry and editable guard patterns.

**Tasks:**
- [ ] Replace duplicated focus retry loops with `focusHelpers` where safe
- [ ] Replace remaining inline editable-target checks with `isEditableTarget`
- [ ] Keep behavior unchanged

**Files likely touched:** useSidebarPanel.ts, GitHistoryPane.tsx, FileExplorer.tsx
**Risk level:** Low
**Acceptance criteria:** All existing focus behaviors unchanged
**What not to change:** Focus return logic in useSidebarPanel, panel key handlers

---

### Phase 2 — Surface self-registration

**Goal:** Move registration from App into individual surface components.

**Tasks:**
- [ ] Register GitHistoryPane via `useRegisterSurface`
- [ ] Register SourceControlPanel via `useRegisterSurface`
- [ ] Register FileExplorer via `useRegisterSurface`
- [ ] Register MarkdownPreviewPane via `useRegisterSurface`
- [ ] Register EditorPane/EditorStack via `useRegisterSurface`
- [ ] Remove stale registration from App.tsx
- [ ] Keep existing behavior

**Files likely touched:** GitHistoryPane.tsx, SourceControlPanel.tsx, FileExplorer.tsx, MarkdownPreviewPane.tsx, EditorPane.tsx, App.tsx
**Risk level:** Medium
**Acceptance criteria:** All surfaces register on mount, deregister on unmount
**What not to change:** Actual focus return logic

---

### Phase 3 — Improve `useScopedKeymap`

**Goal:** Add modifier support, sequence support, and strict focus mode.

**Tasks:**
- [ ] Add modifier descriptor model (`{ ctrl, shift, alt, meta }`)
- [ ] Add `gg`/sequence support with pending-g state
- [ ] Add strict focused-scope behavior by default
- [ ] Add optional `activeWhenNoSurface` flag
- [ ] Return/export help items from binding descriptors

**Files likely touched:** useScopedKeymap.ts
**Risk level:** Medium
**Acceptance criteria:** `useScopedKeymap` can handle all current panel keyboard patterns
**What not to change:** Existing panel key handlers (they continue to work)

---

### Phase 4 — Migrate GitHistory to `useScopedKeymap`

**Goal:** Use `useScopedKeymap` for GitHistory keyboard handling.

**Tasks:**
- [ ] Convert GitHistory `handleKeyDown` to `useScopedKeymap` bindings
- [ ] Keep domain actions (open details, refresh, copy SHA) local
- [ ] Move key interpretation to shared layer

**Files likely touched:** GitHistoryPane.tsx
**Risk level:** Medium
**Acceptance criteria:** GitHistory keyboard behavior unchanged
**What not to change:** Other panels

---

### Phase 5 — Migrate SourceControl carefully

**Goal:** Use `useScopedKeymap` for SourceControl keyboard handling.

**Tasks:**
- [ ] Wait until SourceControl behavior is stable
- [ ] Convert SourceControl `handlePanelKeyDown` to `useScopedKeymap` bindings
- [ ] Keep domain actions local

**Files likely touched:** SourceControlPanel.tsx
**Risk level:** Medium-High
**Acceptance criteria:** SourceControl keyboard behavior unchanged
**What not to change:** Other panels

---

### Phase 6 — Help from keymap definitions

**Goal:** Derive help overlays from binding definitions.

**Tasks:**
- [ ] GitHistory help first
- [ ] SourceControl help second
- [ ] FileExplorer help third
- [ ] One binding definition drives handler + help overlay + docs

**Files likely touched:** GitHistoryPane.tsx, SourceControlPanel.tsx, FileExplorer.tsx
**Risk level:** Low
**Acceptance criteria:** Help overlays show same content as before
**What not to change:** Actual keyboard handling logic

---

### Phase 7 — Tests

**Goal:** Add comprehensive tests for keyboard architecture.

**Tasks:**
- [ ] Focus lifecycle tests (focus moves correctly between panels)
- [ ] Scoped keymap tests (bindings fire in correct scope)
- [ ] Registry tests (register/deregister/focus)
- [ ] Panel smoke tests (each panel's key handling)

**Files likely touched:** Test files only
**Risk level:** None
**Acceptance criteria:** Tests pass, cover key behaviors
**What not to change:** Runtime behavior

---

## 9. Testing Strategy

### 9.1 Unit Tests

- `useScopedKeymap` — verify scope filtering, editable target guard, binding matching
- `focusWithRetry` — verify retry logic, max attempts, verification callback
- `KeyboardSurfaceRegistry` — verify register/deregister, focus routing
- `interpretVimListKey` — verify all action types (already has tests)
- `handleConfirmDialogKeyDown` — verify confirm/cancel behavior

### 9.2 Integration Tests

- Focus return after popover close
- Focus return after dialog close
- Scope transitions (e.g., clicking from explorer to source control)
- Global shortcut suppression in correct contexts

### 9.3 Manual Smoke Checklist

**Global shortcuts:**
- [ ] Cmd/Ctrl+P opens command palette
- [ ] Cmd/Ctrl+Shift+P opens command palette (commands)
- [ ] Cmd/Ctrl+B toggles sidebar
- [ ] Cmd/Ctrl+Shift+E focuses explorer
- [ ] Cmd/Ctrl+Shift+G focuses source control
- [ ] Cmd/Ctrl+Shift+H focuses git history
- [ ] Cmd/Ctrl+Shift+Space opens space switcher
- [ ] Cmd/Ctrl+P (in buffer picker) works
- [ ] Cmd/Ctrl+1-9 switches tabs

**Terminal focus:**
- [ ] Cmd/Ctrl+B in terminal does NOT toggle sidebar (shell gets it)
- [ ] Cmd/Ctrl+K in terminal clears (if macOS)
- [ ] Ctrl+Space prefix works in terminal
- [ ] Prefix `e` focuses explorer
- [ ] Prefix `g` focuses source control

**Explorer navigation:**
- [ ] j/k moves selection
- [ ] gg goes to first, G goes to last
- [ ] Enter opens file, o opens file
- [ ] h collapses directory, l expands
- [ ] / opens search
- [ ] Ctrl+J jumps to search results
- [ ] Escape from search closes search
- [ ] a creates file, A creates folder
- [ ] r renames, d/x deletes
- [ ] y copies path, Y copies relative path
- [ ] ? toggles help

**Source Control navigation:**
- [ ] j/k moves selection
- [ ] gg goes to first, G goes to last
- [ ] Space stages/unstages
- [ ] Enter/l opens diff
- [ ] c focuses commit input
- [ ] Escape from commit textarea returns focus
- [ ] r refreshes, f fetches, P pulls, p pushes
- [ ] b focuses branch badge
- [ ] g opens git graph
- [ ] ? toggles help

**Git History navigation:**
- [ ] j/k moves selection
- [ ] gg goes to first, G goes to last
- [ ] Space opens/closes commit details
- [ ] Enter opens commit details
- [ ] r refreshes
- [ ] o opens on remote
- [ ] y/Y copies SHA
- [ ] Escape clears selection
- [ ] ? toggles help

**Markdown Preview:**
- [ ] j/k scrolls down/up
- [ ] gg scrolls to top, G scrolls to bottom
- [ ] e/i/Enter switches to edit mode
- [ ] Focus returns after mode switch

**Space Switcher:**
- [ ] j/k moves selection
- [ ] Enter switches to space
- [ ] h/l collapses/expands
- [ ] a/n creates space
- [ ] r renames
- [ ] d/x deletes (with confirm)
- [ ] m moves active tab
- [ ] Escape closes
- [ ] ? toggles help

**Focus return:**
- [ ] Closing explorer search returns focus to tree
- [ ] Closing git history popover returns focus to container
- [ ] Closing space switcher returns focus to previous surface
- [ ] Closing buffer picker returns focus to activated tab
- [ ] Sidebar → Editor returns focus correctly

---

## 10. Open Questions

1. **Should Escape in the file explorer tree clear the selection?** Currently it does nothing. Git History clears selection on Escape.

2. **Should Enter in markdown preview switch to edit mode?** Currently it does, but this is non-standard. Most markdown previews use Enter for line breaks.

3. **How should we handle conflicting vim modes?** Editor has its own vim mode via CodeMirror. Explorer, source control, and git history have custom vim handling. Should these be unified or kept separate?

4. **Should help overlays be modal or non-modal?** Currently they're toggled with `?` and stay open until `?` is pressed again. Should they auto-close on any keypress?

5. **Should we support custom user keybindings per scope?** Currently user customizations only apply to global shortcuts. Scoped keybindings (j/k in explorer, etc.) are not customizable.

---

## 11. Appendix: File Reference

### Core Keyboard Files

| File | Purpose |
|------|---------|
| `src/modules/keyboard/core/vimList.ts` | Vim key normalization and interpretation |
| `src/modules/keyboard/core/targets.ts` | DOM target detection predicates |
| `src/modules/keyboard/core/confirmDialog.ts` | Shared confirm dialog handler |
| `src/modules/keyboard/core/focusHelpers.ts` | Shared focus retry utilities |
| `src/modules/keyboard/core/KeyboardSurfaceRegistry.ts` | Surface focus registry |
| `src/modules/keyboard/core/KeyboardSurfaceContext.ts` | React context + useRegisterSurface |
| `src/modules/keyboard/hooks/useVimListNavigation.ts` | Generic vim list navigation |
| `src/modules/keyboard/hooks/useVimTreeNavigation.ts` | File explorer tree navigation |
| `src/modules/keyboard/hooks/useVimScrollNavigation.ts` | Vim scroll navigation |
| `src/modules/keyboard/hooks/useTerminalPrefix.ts` | Terminal Ctrl+Space prefix |
| `src/modules/keyboard/hooks/useScopedKeymap.ts` | Scoped keymap primitive |
| `src/modules/keyboard/components/KeyboardHelpOverlay.tsx` | Shared help overlay |

### Shortcut Files

| File | Purpose |
|------|---------|
| `src/modules/shortcuts/shortcuts.ts` | Shortcut definitions and matching |
| `src/modules/shortcuts/lib/useGlobalShortcuts.ts` | Global shortcut registration |
| `src/modules/shortcuts/lib/useShortcutLabel.ts` | Shortcut display labels |

### Focus Management Files

| File | Purpose |
|------|---------|
| `src/app/App.tsx` | Global shortcut handlers, `isDisabled` logic, stale registry registration |
| `src/app/components/WorkspaceSurface.tsx` | Stack-and-toggle surface management |
| `src/modules/sidebar/useSidebarPanel.ts` | Sidebar focus orchestration |
| `src/modules/sidebar/SidebarRail.tsx` | Sidebar rail UI |

### Panel Files (Keyboard-Relevant)

| File | Purpose |
|------|---------|
| `src/modules/explorer/FileExplorer.tsx` | Explorer keyboard handling (uses `useVimTreeNavigation`) |
| `src/modules/explorer/ExplorerSearch.tsx` | Search keyboard handling |
| `src/modules/explorer/InlineInput.tsx` | Inline rename focus |
| `src/modules/source-control/SourceControlPanel.tsx` | Source control keyboard handling (local) |
| `src/modules/git-history/GitHistoryPane.tsx` | Git history keyboard handling (uses shared help overlay) |
| `src/modules/markdown/MarkdownPreviewPane.tsx` | Markdown preview keyboard handling (uses `useVimScrollNavigation`) |
| `src/modules/editor/EditorPane.tsx` | Editor keyboard handling (CM keymap) |
| `src/modules/editor/GitDiffPane.tsx` | Git diff keyboard handling (uses `interpretVimListKey`) |
| `src/modules/spaces/SpaceSwitcher.tsx` | Space switcher keyboard handling (uses `useVimListNavigation`) |
| `src/modules/spaces/components/InlineRename.tsx` | Space rename focus |
