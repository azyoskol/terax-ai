# Keyboard/Focus Architecture Audit & Improvement Plan

## Implementation Status

**Completed Phases:**
- ✅ Phase 1: Shared focus helpers extracted (`focusHelpers.ts`)
- ✅ Phase 2: Surface focus registry created (`KeyboardSurfaceRegistry.ts`, `KeyboardSurfaceContext.ts`)
- ✅ Phase 3: Scoped keymap primitive created (`useScopedKeymap.ts`)
- ✅ Phase 4: Help overlay shared component created (`KeyboardHelpOverlay.tsx`), GitHistory migrated
- ✅ Phase 5: isEditableTarget duplicates fixed in FileExplorer, GitDiffPane, SourceControlPanel
- ✅ Phase 6: Tests added for focusHelpers and KeyboardSurfaceRegistry

**New Files Created:**
- `src/modules/keyboard/core/focusHelpers.ts` — Shared focus retry utilities
- `src/modules/keyboard/core/focusHelpers.test.ts` — Tests for focus helpers
- `src/modules/keyboard/core/KeyboardSurfaceRegistry.ts` — Surface focus registry
- `src/modules/keyboard/core/KeyboardSurfaceRegistry.test.ts` — Tests for registry
- `src/modules/keyboard/core/KeyboardSurfaceContext.ts` — React context for registry
- `src/modules/keyboard/hooks/useScopedKeymap.ts` — Scoped keymap primitive
- `src/modules/keyboard/components/KeyboardHelpOverlay.tsx` — Shared help overlay

**Modified Files:**
- `src/app/App.tsx` — Uses shared focus helpers, registers editor/explorer surfaces
- `src/modules/keyboard/core/targets.ts` — Uses `focusElementBySelectorWithRetry`
- `src/modules/explorer/FileExplorer.tsx` — Uses shared `isEditableTarget`
- `src/modules/editor/GitDiffPane.tsx` — Uses shared `isEditableTarget`
- `src/modules/source-control/SourceControlPanel.tsx` — Uses shared `isEditableTarget`
- `src/modules/git-history/GitHistoryPane.tsx` — Uses shared `KeyboardHelpOverlay`

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

**Disable logic:** `App.tsx:816-903`
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

**Core utilities in `src/modules/keyboard/core/`:**

| File | Purpose |
|------|---------|
| `vimList.ts` | `interpretVimListKey()` state machine, `normalizeVimKey()`, `isPlainVimKey()`, pending-g detection |
| `targets.ts` | DOM predicates (`isEditableTarget`, `isTerminalTarget`, `isInExplorer`, etc.), `focusSourceControlPanel()` |
| `confirmDialog.ts` | Shared Enter/y/Y confirm, Escape/n/N cancel handler |

### 1.3 Focus Management Architecture

**WorkspaceSurface** (`src/app/components/WorkspaceSurface.tsx`):
- Stack-and-toggle pattern: all tab surfaces mounted, inactive ones get `invisible pointer-events-none`
- Preserves terminal buffers, editor scroll positions across tab switches

**Sidebar focus orchestration** (`src/modules/sidebar/useSidebarPanel.ts`):
- `explorerReturnFocusRef` — saves/restores focus across sidebar open/close
- `lastSidebarSurfaceRef` — tracks which sub-surface was last focused (explorerTree, explorerSearch, explorerSearchResults, sourceControlChanges)
- `restoreEditorFocus()` — fallback chain: saved ref → diff view → markdown preview → CodeMirror → data-editor

**Focus retry patterns:**
1. `retryAnimationFrames()` in `App.tsx:176-183` — up to 30 rAF attempts, verifies `activeElement`
2. `focusSourceControlPanel()` in `targets.ts:67-78` — up to 10 rAF attempts, queries DOM
3. Single-shot `requestAnimationFrame(() => el.focus())` — ~20+ instances across codebase

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
| `data-spaces-list` | Spaces | Space switcher list |
| `data-nav-index` | Spaces | Vim navigation target |

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
| Editor (CodeMirror) | Tab switch, Ctrl+L, file open | `activeEditorHandleRef.current?.focus()` + rAF retry |
| Markdown preview | Tab switch, Ctrl+M toggle | `retryAnimationFrames` checking `[data-markdown-preview]` |
| Source Control panel | Ctrl+Shift+G, terminal prefix `g` | `focusSourceControlPanel()` with 10-frame retry |
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
| Space switcher close | Previous focus | `setSwitcherOpen(false)` + rAF retry on editor |
| Buffer picker close | Activated tab | `handleBufferActivate()` + rAF retry on editor |
| Inline rename cancel | Parent container | `requestAnimationFrame` focus restore |

---

## 4. Problems / Risks

### 4.1 Duplicated Editable Target Guards

**Current locations:**
- `targets.ts:2-16` — shared `isEditableTarget()`
- `FileExplorer.tsx:486-492` — inline duplicate (INPUT/TEXTAREA/contentEditable check)
- `confirmDialog.ts:16-20` — inline duplicate
- `GitDiffPane.tsx:303-309` — inline duplicate
- `SourceControlPanel.tsx:406-412` — inline duplicate

**Why risky:** Inconsistent behavior if one copy is updated but not others. New developers may not know which to use.

**Suggested fix:** Import `isEditableTarget` from `keyboard/core/targets.ts` everywhere.

**Priority:** Fix now (trivial, no behavior change).

---

### 4.2 Duplicated Focus Retry Patterns

**Current locations:**
- `App.tsx:176-183` — `retryAnimationFrames()` (up to 30 attempts)
- `targets.ts:67-78` — `focusSourceControlPanel()` (up to 10 attempts)
- `App.tsx:306-320, 603-616, 1109-1121` — editor focus retry (up to 15 attempts)
- `useSidebarPanel.ts:141,192,206,222,236` — sidebar focus (single rAF)
- `FileExplorer.tsx:660,691` — explorer focus (single rAF)
- `GitHistoryPane.tsx:405,531,890` — git history focus (single rAF)
- `MarkdownPreviewPane.tsx:71` — markdown focus (single rAF)

**Why risky:** At least 4 different retry implementations with different max attempts and verification logic. Easy to introduce bugs when copying.

**Suggested fix:** Extract `focusWithRetry(selector, { maxAttempts, verify })` utility.

**Priority:** Fix now (extract utility, replace obvious duplicates).

---

### 4.3 Inconsistent Escape Behavior

**Current locations:**
- Global shortcuts: Escape closes switchers, command palette
- Git History: Escape clears selection (line 681)
- Source Control: Escape from commit textarea returns panel focus (line 797)
- Explorer: Escape from search closes search
- Explorer: Escape from tree does nothing
- Markdown: Escape does nothing
- Space switcher: Escape closes popover
- Confirm dialogs: Escape cancels

**Why risky:** Users expect consistent Escape behavior (usually "go back" or "close"). Some panels don't respond to Escape at all.

**Suggested fix:** Document expected Escape behavior per scope. Add Escape handlers where missing if appropriate.

**Priority:** Later (behavior design decision).

---

### 4.4 Inconsistent Enter/Space Behavior

**Current locations:**
- Tree navigation: Enter opens file/toggles directory
- Source Control: Enter opens diff
- Git History: Enter opens commit details
- Space switcher: Enter switches to space/opens tab
- Confirm dialogs: Enter confirms
- Markdown: Enter switches to edit mode (non-standard)

**Why risky:** Enter/Space have different meanings depending on context. Users may accidentally trigger actions.

**Suggested fix:** Document expected Enter/Space behavior per scope.

**Priority:** Later (behavior design decision).

---

### 4.5 GitDiffPane Bypasses Shared Hook

**Current location:** `GitDiffPane.tsx:257-342`

**Why risky:** Implements its own vim scroll navigation with `interpretVimListKey` + manual `scrollDiff` instead of using `useVimScrollNavigation`. The fallback `<pre>` scrolling path is unique, but the CM path could use the shared hook.

**Suggested fix:** Refactor to use `useVimScrollNavigation` with a custom scroll target callback.

**Priority:** Fix now (reduces duplication, no behavior change).

---

### 4.6 Help Overlays May Drift from Real Keybindings

**Current locations:**
- `useVimTreeNavigation` returns help bindings as data
- `SourceControlPanel` builds help list manually
- `GitHistoryPane` builds help list manually
- `SpaceSwitcher` builds help list manually

**Why risky:** Help text is maintained separately from actual key handling. If a keybinding changes, the help overlay must be updated manually.

**Suggested fix:** Derive help text from keybinding definitions where possible.

**Priority:** Later (maintenance burden, not a bug).

---

### 4.7 Pending-g Pattern Duplicated Across Hooks

**Current locations:**
- `useVimListNavigation.ts:140-151` — `clearPendingG` + cleanup effect
- `useVimTreeNavigation.ts:294-305` — identical pattern
- `useVimScrollNavigation.ts:76-85` — identical pattern

**Why risky:** Triple maintenance burden. If the timeout or cleanup logic changes, all three must be updated.

**Suggested fix:** Extract `usePendingG()` hook that encapsulates the ref + cleanup.

**Priority:** Fix now (trivial extraction).

---

### 4.8 Target Resolution Inconsistency

**Current locations:**
- `useVimListNavigation.ts:48-50` — `e.target ?? document.activeElement`
- `useVimTreeNavigation.ts:46-53` — `nativeEvent()` helper with same logic
- `useVimScrollNavigation.ts:19-21` — same pattern

**Why risky:** Three slightly different implementations of the same target resolution. Minor inconsistency but confusing.

**Suggested fix:** Extract `getEventTarget(e)` utility.

**Priority:** Later (cosmetic, no behavior impact).

---

### 4.9 No Scope Registry for Keyboard Handling

**Current situation:** Focus detection is ad-hoc via `element.closest("[data-*]")` scattered across `targets.ts`, `App.tsx`, and `useSidebarPanel.ts`.

**Why risky:** Adding a new panel requires adding new data attributes, new `isIn*()` predicates, new `isDisabled` cases, and new focus return logic. No single place to register a new scope.

**Suggested fix:** Introduce `KeyboardSurfaceHandle` interface and registry.

**Priority:** Later (larger refactor, do incrementally).

---

### 4.10 Space Switcher Registers on Window Directly

**Current location:** `SpaceSwitcher.tsx:242-249`

**Why risky:** Uses `window.addEventListener("keydown", ..., { capture: true })` directly instead of `useGlobalShortcuts` or a scoped hook. This bypasses the centralized shortcut system and could conflict with global shortcuts.

**Suggested fix:** Use a scoped keymap hook or integrate with the global system.

**Priority:** Fix now (cleaner architecture).

---

## 5. Proposed Target Architecture

### 5.1 Keyboard Scopes (Formalized)

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

### 5.2 Surface Focus Registry

```typescript
type KeyboardSurfaceHandle = {
  id: string;
  scope: KeyboardScope;
  focus: () => boolean | void;
  isFocused: () => boolean;
  getHelp?: () => KeyBindingHelp[];
};
```

Registry maintains a `Map<string, KeyboardSurfaceHandle>` with registration/deregistration via React context.

### 5.3 Scoped Keymap Hook

```typescript
type KeyBinding = {
  key: string;
  description: string;
  action: (event: KeyboardEvent) => void;
  when?: () => boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  dangerous?: boolean;
};

function useScopedKeymap({
  scope,
  enabled,
  ignoreEditableTargets,
  bindings,
}: {
  scope: KeyboardScope;
  enabled?: boolean;
  ignoreEditableTargets?: boolean;
  bindings: KeyBinding[];
}): void;
```

### 5.4 Shared Focus Helpers

```typescript
function focusWithRetry(
  selector: string,
  options?: { maxAttempts?: number; verify?: (el: HTMLElement) => boolean }
): void;

function focusElementBySelectorWithRetry(selector: string): void;

function restoreFocusAfterPopoverClose(containerRef: RefObject<HTMLElement>): void;

function restoreFocusAfterDialogClose(returnTo: HTMLElement | null): void;

function focusActiveWorkspaceSurface(): void;

function focusActiveSidebarSurface(): void;
```

### 5.5 Shared Keymap Help

Use the same `KeyBinding[]` definitions for:
- Actual handlers (via `useScopedKeymap`)
- `?` help overlays (via `getHelp()` on surface handle)
- Documentation/checklists where practical

---

## 6. Incremental Migration Plan

### Phase 0 — Stabilization Only

**Goal:** Fix obvious bugs without architecture changes.

**Tasks:**
- [ ] Source Control row click opens diff (verify current behavior)
- [ ] Esc from commit textarea returns panel focus (verify current behavior)
- [ ] Git Graph focus after details closes (verify current behavior)
- [ ] Confirm dialogs Enter/y/n/Esc (verify current behavior)

**Files likely touched:** None (verification only)
**Risk level:** None
**Acceptance criteria:** All behaviors work as expected
**What not to change:** Any keyboard handling logic

---

### Phase 1 — Shared Focus Helpers

**Goal:** Extract duplicated focus retry patterns into shared utilities.

**Tasks:**
- [ ] Create `src/modules/keyboard/core/focusHelpers.ts`
- [ ] Extract `focusWithRetry(selector, options)` from `App.tsx:176-183`
- [ ] Extract `focusElementBySelectorWithRetry(selector)` from `targets.ts:67-78`
- [ ] Replace `retryAnimationFrames` in `App.tsx` with `focusWithRetry`
- [ ] Replace `focusSourceControlPanel` in `targets.ts` with `focusElementBySelectorWithRetry`
- [ ] Replace editor focus retry loops in `App.tsx:306-320, 603-616, 1109-1121`
- [ ] Export from `keyboard/core/index.ts`

**Files likely touched:**
- `src/modules/keyboard/core/focusHelpers.ts` (new)
- `src/modules/keyboard/core/index.ts`
- `src/app/App.tsx`
- `src/modules/keyboard/core/targets.ts`

**Risk level:** Low
**Acceptance criteria:**
- All existing focus behaviors unchanged
- `pnpm test` passes
- `pnpm check-types` passes
- `pnpm lint` passes

**What not to change:**
- `useSidebarPanel.ts` focus logic (do in Phase 2)
- Component-level single-rAF calls (leave as-is for now)

---

### Phase 2 — Surface Focus Registry

**Goal:** Introduce a registry for keyboard surfaces with focus management.

**Tasks:**
- [ ] Create `src/modules/keyboard/core/KeyboardSurfaceRegistry.ts`
- [ ] Create `KeyboardSurfaceContext` provider
- [ ] Wrap app in provider
- [ ] Register Editor surface
- [ ] Register MarkdownPreview surface
- [ ] Register SourceControl surface
- [ ] Register FileExplorer surface
- [ ] Register GitHistory surface
- [ ] Update `useSidebarPanel.ts` to use registry
- [ ] Update `App.tsx` focus logic to use registry

**Files likely touched:**
- `src/modules/keyboard/core/KeyboardSurfaceRegistry.ts` (new)
- `src/modules/keyboard/core/KeyboardSurfaceContext.ts` (new)
- `src/app/App.tsx`
- `src/modules/sidebar/useSidebarPanel.ts`
- `src/modules/editor/EditorPane.tsx`
- `src/modules/markdown/MarkdownPreviewPane.tsx`
- `src/modules/source-control/SourceControlPanel.tsx`
- `src/modules/explorer/FileExplorer.tsx`
- `src/modules/git-history/GitHistoryPane.tsx`

**Risk level:** Medium
**Acceptance criteria:**
- All surfaces register on mount, deregister on unmount
- Registry provides `focusSurface(id)` and `getFocusedSurface()`
- Existing focus behaviors unchanged
- Tests pass

**What not to change:**
- Actual focus return logic in `useSidebarPanel.ts` (keep existing fallback chain)
- Help overlays

---

### Phase 3 — Scoped Keymap Primitive

**Goal:** Implement `useScopedKeymap` and migrate one panel.

**Tasks:**
- [ ] Create `src/modules/keyboard/hooks/useScopedKeymap.ts`
- [ ] Implement scope-based filtering (ignore events outside scope)
- [ ] Implement editable target guard option
- [ ] Migrate GitHistory keyboard handling to use `useScopedKeymap`
- [ ] Keep existing behavior, just restructure

**Files likely touched:**
- `src/modules/keyboard/hooks/useScopedKeymap.ts` (new)
- `src/modules/git-history/GitHistoryPane.tsx`

**Risk level:** Medium
**Acceptance criteria:**
- GitHistory keyboard behavior unchanged
- Help text derivable from bindings
- Tests pass

**What not to change:**
- Global shortcuts system
- Other panels' keyboard handling

---

### Phase 4 — Help from Keymap Definitions

**Goal:** Derive help overlays from keybinding definitions.

**Tasks:**
- [ ] Add `getHelp()` to `KeyboardSurfaceHandle`
- [ ] Implement help generation from `KeyBinding[]` in GitHistory
- [ ] Implement help generation from `KeyBinding[]` in SourceControl
- [ ] Implement help generation from `KeyBinding[]` in FileExplorer
- [ ] Remove manually maintained help lists where replaced

**Files likely touched:**
- `src/modules/git-history/GitHistoryPane.tsx`
- `src/modules/source-control/SourceControlPanel.tsx`
- `src/modules/explorer/FileExplorer.tsx`
- `src/modules/keyboard/core/KeyboardSurfaceRegistry.ts`

**Risk level:** Low
**Acceptance criteria:**
- Help overlays show same content as before
- Help text automatically updates when bindings change
- Tests pass

**What not to change:**
- Actual keyboard handling logic
- Help overlay UI components

---

### Phase 5 — SourceControl/FileExplorer Cleanup

**Goal:** Reduce local keydown complexity in SourceControl and FileExplorer.

**Tasks:**
- [ ] Migrate SourceControl to `useScopedKeymap`
- [ ] Migrate FileExplorer to `useScopedKeymap`
- [ ] Keep domain actions (stage, unstage, delete, rename) local
- [ ] Move key interpretation to shared layer
- [ ] Replace inline `isEditableTarget` duplicates with import

**Files likely touched:**
- `src/modules/source-control/SourceControlPanel.tsx`
- `src/modules/explorer/FileExplorer.tsx`
- `src/modules/explorer/InlineInput.tsx` (if needed)

**Risk level:** Medium
**Acceptance criteria:**
- All keyboard behaviors unchanged
- Local keydown handlers reduced in complexity
- Tests pass

**What not to change:**
- Domain-specific actions (git operations, file operations)
- Focus management logic

---

### Phase 6 — Docs and Tests

**Goal:** Document the architecture and add tests.

**Tasks:**
- [ ] Update `docs/keyboard-navigation-behavior.md`
- [ ] Add scope-level tests for `useScopedKeymap`
- [ ] Add focus lifecycle tests for key panels
- [ ] Add integration tests for focus return flows
- [ ] Update this document with final architecture

**Files likely touched:**
- `docs/keyboard-navigation-behavior.md`
- `src/modules/keyboard/hooks/__tests__/useScopedKeymap.test.ts` (new)
- `src/modules/keyboard/core/__tests__/focusHelpers.test.ts` (new)
- `src/modules/keyboard/core/__tests__/KeyboardSurfaceRegistry.test.ts` (new)

**Risk level:** None
**Acceptance criteria:**
- Documentation accurate
- Tests cover key behaviors
- CI passes

**What not to change:**
- Runtime behavior

---

## 7. Testing Strategy

### 7.1 Unit Tests

- `useScopedKeymap` — verify scope filtering, editable target guard, binding matching
- `focusWithRetry` — verify retry logic, max attempts, verification callback
- `KeyboardSurfaceRegistry` — verify register/deregister, focus routing
- `interpretVimListKey` — verify all action types (already has tests)
- `handleConfirmDialogKeyDown` — verify confirm/cancel behavior

### 7.2 Integration Tests

- Focus return after popover close
- Focus return after dialog close
- Scope transitions (e.g., clicking from explorer to source control)
- Global shortcut suppression in correct contexts

### 7.3 Manual Smoke Checklist

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

## 8. Open Questions

1. **Should Escape in the file explorer tree clear the selection?** Currently it does nothing. Git History clears selection on Escape.

2. **Should Enter in markdown preview switch to edit mode?** Currently it does, but this is non-standard. Most markdown previews use Enter for line breaks.

3. **Should we add a formal scope transition API?** Currently scope detection is implicit via `element.closest()`. A formal API would make transitions explicit but adds complexity.

4. **How should we handle conflicting vim modes?** Editor has its own vim mode via CodeMirror. Explorer, source control, and git history have custom vim handling. Should these be unified or kept separate?

5. **Should help overlays be modal or non-modal?** Currently they're toggled with `?` and stay open until `?` is pressed again. Should they auto-close on any keypress?

6. **Should we support custom user keybindings per scope?** Currently user customizations only apply to global shortcuts. Scoped keybindings (j/k in explorer, etc.) are not customizable.

7. **How should we handle focus in split panes?** Currently focus is managed per-surface, not per-pane. Split editor panes may need pane-aware focus management.

---

## 9. Appendix: File Reference

### Core Keyboard Files

| File | Purpose |
|------|---------|
| `src/modules/keyboard/core/vimList.ts` | Vim key normalization and interpretation |
| `src/modules/keyboard/core/targets.ts` | DOM target detection predicates |
| `src/modules/keyboard/core/confirmDialog.ts` | Shared confirm dialog handler |
| `src/modules/keyboard/core/focusHelpers.ts` | (Phase 1) Shared focus retry utilities |
| `src/modules/keyboard/hooks/useVimListNavigation.ts` | Generic vim list navigation |
| `src/modules/keyboard/hooks/useVimTreeNavigation.ts` | File explorer tree navigation |
| `src/modules/keyboard/hooks/useVimScrollNavigation.ts` | Vim scroll navigation |
| `src/modules/keyboard/hooks/useTerminalPrefix.ts` | Terminal Ctrl+Space prefix |
| `src/modules/keyboard/hooks/useScopedKeymap.ts` | (Phase 3) Scoped keymap primitive |

### Shortcut Files

| File | Purpose |
|------|---------|
| `src/modules/shortcuts/shortcuts.ts` | Shortcut definitions and matching |
| `src/modules/shortcuts/lib/useGlobalShortcuts.ts` | Global shortcut registration |
| `src/modules/shortcuts/lib/useShortcutLabel.ts` | Shortcut display labels |

### Focus Management Files

| File | Purpose |
|------|---------|
| `src/app/App.tsx` | Global shortcut handlers, `isDisabled` logic |
| `src/app/components/WorkspaceSurface.tsx` | Stack-and-toggle surface management |
| `src/modules/sidebar/useSidebarPanel.ts` | Sidebar focus orchestration |
| `src/modules/sidebar/SidebarRail.tsx` | Sidebar rail UI |

### Panel Files (Keyboard-Relevant)

| File | Purpose |
|------|---------|
| `src/modules/explorer/FileExplorer.tsx` | Explorer keyboard handling |
| `src/modules/explorer/ExplorerSearch.tsx` | Search keyboard handling |
| `src/modules/explorer/InlineInput.tsx` | Inline rename focus |
| `src/modules/source-control/SourceControlPanel.tsx` | Source control keyboard handling |
| `src/modules/git-history/GitHistoryPane.tsx` | Git history keyboard handling |
| `src/modules/markdown/MarkdownPreviewPane.tsx` | Markdown preview keyboard handling |
| `src/modules/editor/EditorPane.tsx` | Editor keyboard handling |
| `src/modules/editor/GitDiffPane.tsx` | Git diff keyboard handling |
| `src/modules/spaces/SpaceSwitcher.tsx` | Space switcher keyboard handling |
| `src/modules/spaces/components/InlineRename.tsx` | Space rename focus |
