# Keyboard/Focus Architecture Audit & Improvement Plan

## Implementation Status

| Area | Status | Notes |
|------|--------|-------|
| Shared focus helpers | **Adopted** | `focusWithRetry`, `focusEditorWithRetry`, `focusElementBySelectorWithRetry` in use. Single-shot rAF patterns remain acceptable for non-retry cases. |
| Surface registry | **Partial** | `KeyboardSurfaceRegistry` exists. Editor registered from App (stale; TODO: migrate to EditorPane). GitHistory, SourceControl, FileExplorer self-register via `useRegisterSurface`. |
| Surface context / `useRegisterSurface` | **Adopted — GitHistory, SourceControl, FileExplorer** | `useRegisterSurface` used in `GitHistoryPane`, `SourceControlPanel`, `FileExplorerContent`. MarkdownPreview, SpaceSwitcher, EditorPane pending. |
| Scoped keymap | **Adopted — GitHistory** | `useScopedKeymap` drives GitHistory key handling with scope-filtered bindings, `gg` sequence, ArrowKey aliases, and `when` guards. Generates help via `getBindingHelp`. Not yet used by SourceControl or FileExplorer. |
| Help overlay | **Help-from-bindings — GitHistory** | GitHistory help is generated from `gitHistoryBindings` via `getBindingHelp`. SourceControl and FileExplorer still use manually maintained inline help panels. |
| GitHistory | **Fully migrated** | Uses `useScopedKeymap` + `useRegisterSurface`. `handleKeyDown` removed. `y` copies short SHA, `Y` copies full SHA. `?` toggles help overlay backed by binding descriptors. Focus restore on popover close in place. |
| SourceControl | **Partially improved** | Row click now calls `focusDiffOrEditor()` (consistent with keyboard Enter/l). Textarea Esc uses `rAF + explicit blur + panelRootRef`. Discard dialog uses `handleConfirmDialogKeyDown`. Key handling still local (`handlePanelKeyDown`). Self-registers surface. |
| FileExplorer | **Self-registers surface** | `useVimTreeNavigation` retained (good local abstraction). Delete dialog uses `handleConfirmDialogKeyDown`. Now self-registers as `file-explorer` surface. Key handling unchanged. |
| MarkdownPreview | **Local** | Uses `useVimScrollNavigation` and shared `isEditableTarget`. Not surface-registry based. |
| SpaceSwitcher | **Local** | Uses `useVimListNavigation` on window. Delete dialog uses `handleConfirmDialogKeyDown`. Not surface-registry based. |
| confirmDialog | **Shared utility** | Used in SourceControl (discard), FileExplorer (delete), SpaceSwitcher (delete). |
| Editable target guards | **Consistent** | `isEditableTarget` from `targets.ts` used consistently. GitHistory no longer needs it directly (useScopedKeymap handles internally). |

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
| `git-history` | `data-git-history` focus | `useScopedKeymap` (migrated from `interpretVimListKey`) |
| `space-switcher` | Popover open | `useVimListNavigation` on window |
| `buffer-picker` | Popover open | `useVimListNavigation` on window |
| `dialog` | Alert dialog open | Radix focus trap or `handleConfirmDialogKeyDown` |
| `git-diff` | `data-source-control-diff` focus | Local handler with `interpretVimListKey` |

### 2.2 Scope Detection Method

`KeyboardSurfaceRegistry` exists and is partially adopted. Detection is a mix of:
- `element.closest("[data-*]")` checks in `targets.ts`
- `isTerminalTarget()` checking `.xterm` ancestor
- `isEditableTarget()` checking INPUT/TEXTAREA/contentEditable
- Contextual checks in `App.tsx` `isDisabled` callback
- `getFocused()` on the registry for registered surfaces

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

**Current:** `KeyboardSurfaceRegistry` exists. Editor is still registered from App.tsx (stale; TODO: migrate to EditorPane). GitHistory, SourceControl, and FileExplorer self-register via `useRegisterSurface` in their component bodies.

**Target:** Each focusable surface self-registers via `useRegisterSurface`.

**Gap:** Editor registration still in App and potentially stale. MarkdownPreview and SpaceSwitcher are not yet surface-registry based.

**Next step:** Migrate editor registration into EditorPane via `useRegisterSurface`. Add MarkdownPreview and SpaceSwitcher registration.

### Scoped keymaps

**Current:** `useScopedKeymap` supports modifiers, `gg` sequences, strict scope behavior (`activeWhenNoSurface: false` by default), and help generation from binding descriptors. Pure helpers are in `scopedKeymapCore.ts`. **Adopted by GitHistory**; SourceControl and FileExplorer still use local handlers.

**Target:** Panels use scoped keymaps for their key handling.

**Gap:** SourceControl and FileExplorer not yet migrated. No priority system between keymaps. No capture/bubble configuration.

**Next step:** Migrate SourceControl key handling to `useScopedKeymap`.

### Help overlays

**Current:** `KeyboardHelpOverlay` renders a list of `{key, description}`. `getBindingHelp()` generates help from binding descriptors. **GitHistory uses `getBindingHelp(gitHistoryBindings)`** — help is driven by the binding definitions, not a separate array. SourceControl and FileExplorer still use manually maintained inline help panels.

**Target:** Help text generated from binding definitions for all surfaces.

**Gap:** SourceControl and FileExplorer help text is manually maintained and not derived from binding descriptors. Help items don't distinguish between vim-mode and non-vim-mode bindings.

**Next step:** Derive SourceControl help from binding descriptors when migrating to `useScopedKeymap`.

### Panel-specific key handlers

**Current:** GitHistory uses `useScopedKeymap` with named action callbacks, scope filtering, `gg` sequence, and ArrowKey aliases. SourceControl and FileExplorer still have their own `handleKeyDown` using `interpretVimListKey` / `useVimTreeNavigation`.

**Target:** All panels use `useScopedKeymap` with shared vim interpretation.

**Gap:** SourceControl and FileExplorer not yet migrated. No capture/bubble priority config.

**Next step:** Migrate SourceControl to `useScopedKeymap`, then FileExplorer.

### Dialog/popover focus restore

**Current:** Each dialog/popover handles focus restore independently (rAF, fallback chains).

**Target:** Shared focus restore helpers.

**Gap:** Focus restore is mostly working; the patterns are consistent enough.

**Next step:** No urgent work needed.

### Tests

**Current:** Tests for `focusHelpers`, `KeyboardSurfaceRegistry`, `scopedKeymapCore` (sequence state machine, modifier matching, help generation, key binding matching). 596 tests total.

**Target:** Focus lifecycle tests, scoped keymap hook-level tests, registry integration tests.

**Gap:** Hook-level tests for `useScopedKeymap` require DOM environment (jsdom) which is not available. Pure function tests cover all critical logic: sequence arming, sequence completion, sequence timeout, modified key reset, modifier matching, scope filtering.

**Next step:** Add jsdom for hook-level integration tests, or accept pure function coverage as sufficient.

---

## 5. Known Limitations

### `useScopedKeymap` limitations

1. Adopted by GitHistory; SourceControl and FileExplorer still use local handlers
2. No priority system between keymaps
3. No capture/bubble configuration (always uses bubble phase on window)
4. Sequence support is simple (same-scope `gg` style) — no arbitrary trie for complex multi-key combos
5. Attaches to `window` via `addEventListener` — no component-level scoping
6. Hook-level tests require DOM environment (not available in current test setup)

### `KeyboardSurfaceRegistry` limitations

1. Editor registration in App is still stale (refs may not exist when `[]` effect runs); tracked by TODO in App.tsx
2. `getFocused()` iterates all surfaces — O(n) per keystroke (acceptable for current panel count)
3. No subscription for "which scope is focused" changes

### Help overlay limitations

1. SourceControl and FileExplorer use inline help panels, not the shared component
2. SourceControl and FileExplorer help text is manually maintained; only GitHistory derives help from binding definitions
3. Help items don't distinguish between vim-mode and non-vim-mode bindings

### Known Bugs — Fixed

- ~~SourceControl row click may not open diff consistently~~ — **Fixed**: unified `openDiffForEntry` helper; async-safe with `await` and double rAF
- ~~Escape from commit textarea focus return may be inconsistent~~ — **Fixed**: rAF + explicit blur + `panelRootRef`
- ~~GitHistory details popover focus after close may be unreliable~~ — **Confirmed working**: `closePopover` uses rAF + `onCloseAutoFocus` override
- ~~Confirmation dialogs Enter/y/n/Esc edge cases~~ — **Confirmed working**: `handleConfirmDialogKeyDown` in use across SourceControl, FileExplorer, SpaceSwitcher

### Next steps

- Migrate SourceControl key handling to `useScopedKeymap`
- Migrate FileExplorer surface registration and optionally key handling
- Migrate editor registration to EditorPane via `useRegisterSurface`
- Add MarkdownPreview and SpaceSwitcher surface registration

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

### 7.3 Scoped Keymap (Implemented, Partially Adopted)

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

**Pure helpers exported (from `scopedKeymapCore.ts`, re-exported by `useScopedKeymap.ts`):**
- `matchesKeyBinding(event, binding)` — check if event matches binding
- `matchesModifiers(event, modifiers)` — check modifier match
- `getBindingHelp(bindings)` — generate help items from descriptors
- `armSequence(state, key, bindings, timeout)` — arm a pending sequence
- `resetSequence(state)` — clear pending sequence state
- `processSequenceKey(state, event)` — process a key in sequence context
- `createSequenceState()` — create empty sequence state

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
- [x] SourceControl row click opens diff
- [x] Esc from commit textarea returns panel focus
- [x] GitGraph focus after details closes
- [x] Confirm dialogs Enter/y/n/Esc edge cases

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
- [x] Register GitHistoryPane via `useRegisterSurface`
- [x] Register SourceControlPanel via `useRegisterSurface`
- [x] Register FileExplorer via `useRegisterSurface`
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
- [x] Add modifier descriptor model (`{ ctrl, shift, alt, meta }`)
- [x] Add `gg`/sequence support with pending-g state
- [x] Add strict focused-scope behavior by default
- [x] Add optional `activeWhenNoSurface` flag
- [x] Return/export help items from binding descriptors

**Files likely touched:** useScopedKeymap.ts
**Risk level:** Medium
**Acceptance criteria:** `useScopedKeymap` can handle all current panel keyboard patterns
**What not to change:** Existing panel key handlers (they continue to work)

---

### Phase 4 — Migrate GitHistory to `useScopedKeymap`

**Goal:** Use `useScopedKeymap` for GitHistory keyboard handling.

**Tasks:**
- [x] Convert GitHistory `handleKeyDown` to `useScopedKeymap` bindings
- [x] Keep domain actions (open details, refresh, copy SHA) local
- [x] Move key interpretation to shared layer

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
| `src/modules/keyboard/hooks/scopedKeymapCore.ts` | Pure helpers for scoped keymap (sequence state, modifier matching, help) |
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
