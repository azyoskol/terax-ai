/**
 * Pure helpers for useScopedKeymap.
 *
 * Extracted for testability — no React, no side effects, no timers.
 */
import { type KeyBinding } from "./useScopedKeymap";

// ---------------------------------------------------------------------------
// Modifier matching
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

// ---------------------------------------------------------------------------
// Key binding matching
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Help generation
// ---------------------------------------------------------------------------

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
// Sequence state machine
// ---------------------------------------------------------------------------

export type SequenceState = {
  pendingSequence: string | null;
  pendingTimeout: ReturnType<typeof setTimeout> | null;
  pendingBindings: KeyBinding[];
};

export function createSequenceState(): SequenceState {
  return {
    pendingSequence: null,
    pendingTimeout: null,
    pendingBindings: [],
  };
}

/**
 * Clear only the timeout without resetting sequence/binding data.
 * Used before re-arming a sequence.
 */
export function clearSequenceTimeoutOnly(state: SequenceState): void {
  if (state.pendingTimeout !== null) {
    clearTimeout(state.pendingTimeout);
    state.pendingTimeout = null;
  }
}

/**
 * Full reset — clear timeout, pending sequence, and candidate bindings.
 */
export function resetSequence(state: SequenceState): void {
  clearSequenceTimeoutOnly(state);
  state.pendingSequence = null;
  state.pendingBindings = [];
}

/**
 * Arm a pending sequence. Returns true if a candidate was found.
 *
 * Does NOT call resetSequence (which would clear what we just set).
 */
export function armSequence(
  state: SequenceState,
  firstKey: string,
  bindings: KeyBinding[],
  timeoutMs: number,
): boolean {
  const candidates = bindings.filter(
    (b) => b.sequence && b.sequence[0] === firstKey && b.sequence.length > 1,
  );
  if (candidates.length === 0) return false;

  // Clear any previous timeout before re-arming
  clearSequenceTimeoutOnly(state);

  state.pendingSequence = firstKey;
  state.pendingBindings = candidates;
  state.pendingTimeout = setTimeout(() => {
    resetSequence(state);
  }, timeoutMs);

  return true;
}

/**
 * Process a keydown event within the sequence state machine.
 *
 * Returns "sequence-fired" if a sequence completed and fired,
 * "sequence-armed" if the key armed a new sequence,
 * "sequence-broken" if a pending sequence was cleared without firing,
 * "no-sequence" if there was no pending sequence to consider.
 */
export function processSequenceKey(
  state: SequenceState,
  e: KeyboardEvent,
): "sequence-fired" | "sequence-armed" | "sequence-broken" | "no-sequence" {
  // Modified keys clear pending sequence, then allow single-key matching
  if (e.ctrlKey || e.altKey || e.metaKey) {
    if (state.pendingSequence) {
      resetSequence(state);
      return "sequence-broken";
    }
    return "no-sequence";
  }

  // No pending sequence — nothing to do
  if (!state.pendingSequence) {
    return "no-sequence";
  }

  const fullSequence = state.pendingSequence + e.key;

  // Match only against pending candidate bindings, not all bindings
  const matchingSequence = state.pendingBindings.find(
    (b) => b.sequence === fullSequence,
  );

  if (matchingSequence) {
    resetSequence(state);
    return "sequence-fired";
  }

  // Sequence broken — clear and fall through to single-key matching
  resetSequence(state);
  return "sequence-broken";
}
