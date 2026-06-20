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
import {
  matchesKeyBinding as matchesKeyBindingCore,
  createSequenceState,
  armSequence as armSequenceCore,
  resetSequence,
  type SequenceState,
} from "./scopedKeymapCore";

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
// Pure helpers — re-exported from core for backward compatibility
// ---------------------------------------------------------------------------

export { matchesModifiers, matchesKeyBinding, getBindingHelp } from "./scopedKeymapCore";

// ---------------------------------------------------------------------------
// Sequence state machine (for cleanup on unmount)
// ---------------------------------------------------------------------------

const DEFAULT_SEQUENCE_TIMEOUT_MS = 700;

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
      resetSequence(seqRef.current);
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
        resetSequence(seqRef.current);
        return;
      }

      const seq = seqRef.current;

      // Pre-read pending sequence before processing
      const pendingFirstKey = seq.pendingSequence;
      const pendingBindings = seq.pendingBindings;

      // Modified keys clear pending sequence, then allow single-key matching
      if (e.ctrlKey || e.altKey || e.metaKey) {
        if (pendingFirstKey) {
          resetSequence(seq);
          // Fall through to single-key matching for modified keys
        }
      } else if (pendingFirstKey) {
        // Sequence in progress — check for completion
        const fullSequence = pendingFirstKey + e.key;
        const matchingBinding = pendingBindings.find(
          (b) => b.sequence === fullSequence,
        );

        if (matchingBinding) {
          resetSequence(seq);
          if (matchingBinding.when && !matchingBinding.when()) return;
          if (matchingBinding.preventDefault) e.preventDefault();
          if (matchingBinding.stopPropagation) e.stopPropagation();
          matchingBinding.action(e);
          return;
        }

        // Sequence broken — clear and fall through to single-key matching
        resetSequence(seq);
      }

      // Single-key matching
      for (const binding of bindingsRef.current) {
        if (!matchesKeyBindingCore(e, binding)) continue;
        if (binding.when && !binding.when()) continue;

        // Sequence binding: arm the sequence, do not fire action on first key
        if (binding.sequence && binding.sequence.length > 1) {
          if (
            armSequenceCore(seq, e.key, bindingsRef.current, sequenceTimeoutMs)
          ) {
            if (binding.preventDefault) e.preventDefault();
            if (binding.stopPropagation) e.stopPropagation();
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
