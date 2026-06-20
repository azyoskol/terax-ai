/**
 * Scoped keymap hook for keyboard navigation.
 *
 * Registers keyboard bindings that only fire when a specific surface is
 * focused. Supports modifiers, multi-key sequences (e.g. gg), and
 * help generation from binding descriptors.
 */
import { useEffect, useRef } from "react";
import { isEditableTarget } from "../core/targets";
import {
  keyboardSurfaceRegistry,
  type KeyboardScope,
} from "../core/KeyboardSurfaceRegistry";

export type KeyBinding = {
  /** Current `event.key` value for the first key in the binding. */
  key: string;
  description: string;

  /**
   * Optional display label for help overlay.
   * Example: "gg", "Ctrl+R", "Shift+P".
   */
  helpKey?: string;

  /**
   * Multi-key sequence, e.g. "gg".
   * The first character is matched against `key`. On match, the hook
   * waits for the remaining characters within `sequenceTimeoutMs`.
   */
  sequence?: string;

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

  /** Hide from generated help. */
  hidden?: boolean;
};

type UseScopedKeymapOptions = {
  scope: KeyboardScope;
  enabled?: boolean;
  ignoreEditableTargets?: boolean;
  /**
   * If true, bindings fire even when no surface is focused.
   * Default: false (strict scope behavior).
   */
  activeWhenNoSurface?: boolean;
  sequenceTimeoutMs?: number;
  bindings: KeyBinding[];
};

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Check if a keyboard event matches a binding's modifiers.
 *
 * Rules:
 * - If `modifiers` is omitted, require no ctrl/meta/alt.
 * - Shift is special: if omitted, do not require exact shift match.
 *   This allows uppercase event.key like "G" to match key "G" without
 *   needing explicit shift.
 * - If a modifier is explicitly set, it must match exactly.
 */
export function matchesModifiers(
  event: KeyboardEvent,
  modifiers?: KeyBinding["modifiers"],
): boolean {
  if (!modifiers) {
    return !event.ctrlKey && !event.altKey && !event.metaKey;
  }
  if (modifiers.ctrl !== undefined && !!event.ctrlKey !== modifiers.ctrl)
    return false;
  if (modifiers.meta !== undefined && !!event.metaKey !== modifiers.meta)
    return false;
  if (modifiers.alt !== undefined && !!event.altKey !== modifiers.alt)
    return false;
  // Shift: only enforce if explicitly set
  if (modifiers.shift !== undefined && !!event.shiftKey !== modifiers.shift)
    return false;
  return true;
}

/**
 * Check if a keyboard event matches a binding.
 * Does not check `when` — caller must check separately.
 */
export function matchesKeyBinding(
  event: KeyboardEvent,
  binding: KeyBinding,
): boolean {
  if (binding.key !== event.key) return false;
  if (!matchesModifiers(event, binding.modifiers)) return false;
  return true;
}

/**
 * Format a binding's display key for help overlays.
 */
function formatBindingKey(binding: KeyBinding): string {
  if (binding.helpKey) return binding.helpKey;
  if (binding.sequence) return binding.sequence;

  const parts: string[] = [];
  if (binding.modifiers?.ctrl) parts.push("Ctrl");
  if (binding.modifiers?.meta) parts.push("Meta");
  if (binding.modifiers?.alt) parts.push("Alt");
  if (binding.modifiers?.shift) parts.push("Shift");
  parts.push(binding.key);
  return parts.join("+");
}

/**
 * Generate help items from binding descriptors.
 * Excludes hidden bindings.
 */
export function getBindingHelp(
  bindings: KeyBinding[],
): { key: string; description: string }[] {
  return bindings
    .filter((b) => !b.hidden)
    .map((b) => ({ key: formatBindingKey(b), description: b.description }));
}

// ---------------------------------------------------------------------------
// Sequence state machine (pure, testable)
// ---------------------------------------------------------------------------

const DEFAULT_SEQUENCE_TIMEOUT_MS = 700;

type SequenceState = {
  pendingSequence: string | null;
  pendingTimeout: ReturnType<typeof setTimeout> | null;
  pendingBindings: KeyBinding[];
};

function createSequenceState(): SequenceState {
  return {
    pendingSequence: null,
    pendingTimeout: null,
    pendingBindings: [],
  };
}

function clearSequenceTimeout(state: SequenceState): void {
  if (state.pendingTimeout !== null) {
    clearTimeout(state.pendingTimeout);
    state.pendingTimeout = null;
  }
  state.pendingSequence = null;
  state.pendingBindings = [];
}

function armSequence(
  state: SequenceState,
  firstKey: string,
  bindings: KeyBinding[],
  timeoutMs: number,
): boolean {
  // Find bindings whose sequence starts with this key
  const candidates = bindings.filter(
    (b) => b.sequence && b.sequence[0] === firstKey,
  );
  if (candidates.length === 0) return false;

  state.pendingSequence = firstKey;
  state.pendingBindings = candidates;
  clearSequenceTimeout(state);
  state.pendingTimeout = setTimeout(() => {
    clearSequenceTimeout(state);
  }, timeoutMs);
  return true;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Register scoped keyboard bindings for a surface.
 *
 * Bindings fire only when:
 * 1. The surface with the given scope is focused
 *    (or `activeWhenNoSurface` is true and no surface is focused)
 * 2. `enabled` is true (defaults to true)
 * 3. The event target is not an editable element
 *    (when `ignoreEditableTargets` is true)
 * 4. The `when` condition returns true (if provided)
 * 5. Modifiers match (no modifiers required unless specified)
 * 6. If a sequence is pending, the full sequence is completed
 */
export function useScopedKeymap({
  scope,
  enabled = true,
  ignoreEditableTargets = true,
  activeWhenNoSurface = false,
  sequenceTimeoutMs = DEFAULT_SEQUENCE_TIMEOUT_MS,
  bindings,
}: UseScopedKeymapOptions): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const activeWhenNoSurfaceRef = useRef(activeWhenNoSurface);
  activeWhenNoSurfaceRef.current = activeWhenNoSurface;

  const seqRef = useRef<SequenceState>(createSequenceState());

  // Cleanup sequence timeout on unmount
  useEffect(() => {
    return () => {
      clearSequenceTimeout(seqRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (ignoreEditableTargets && isEditableTarget(e.target)) return;

      // Strict scope check
      const focused = keyboardSurfaceRegistry.getFocused();
      if (!focused) {
        if (!activeWhenNoSurfaceRef.current) return;
      } else if (focused.scope !== scopeRef.current) {
        // Clear any pending sequence when scope changes
        clearSequenceTimeout(seqRef.current);
        return;
      }

      const seq = seqRef.current;

      // Modified keys clear pending sequence
      if (e.ctrlKey || e.altKey || e.metaKey) {
        if (seq.pendingSequence) clearSequenceTimeout(seq);
      }

      // Check for sequence completion
      if (seq.pendingSequence) {
        const fullSequence = seq.pendingSequence + e.key;
        const matchingSequence = bindingsRef.current.find(
          (b) => b.sequence === fullSequence,
        );

        if (matchingSequence) {
          // Sequence completed
          clearSequenceTimeout(seq);
          if (matchingSequence.when && !matchingSequence.when()) return;
          if (matchingSequence.preventDefault) e.preventDefault();
          if (matchingSequence.stopPropagation) e.stopPropagation();
          matchingSequence.action(e);
          return;
        }

        // Sequence broken — clear and fall through to single-key matching
        clearSequenceTimeout(seq);
      }

      // Single-key matching
      for (const binding of bindingsRef.current) {
        if (!matchesKeyBinding(e, binding)) continue;
        if (binding.when && !binding.when()) continue;

        // Check if this key starts a sequence
        if (binding.sequence && binding.sequence.length > 1) {
          if (armSequence(seq, e.key, bindingsRef.current, sequenceTimeoutMs)) {
            return; // Armed, wait for next key
          }
        }

        if (binding.preventDefault) e.preventDefault();
        if (binding.stopPropagation) e.stopPropagation();
        binding.action(e);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    scope,
    enabled,
    ignoreEditableTargets,
    activeWhenNoSurface,
    sequenceTimeoutMs,
  ]);
}
