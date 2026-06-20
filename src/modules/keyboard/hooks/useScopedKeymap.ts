/**
 * Scoped keymap hook for keyboard navigation.
 *
 * Registers keyboard bindings that only fire when a specific surface is
 * focused. Replaces ad-hoc onKeyDown handlers with a declarative API.
 */
import { useEffect, useRef } from "react";
import { isEditableTarget } from "../core/targets";
import {
  keyboardSurfaceRegistry,
  type KeyboardScope,
} from "../core/KeyboardSurfaceRegistry";

export type KeyBinding = {
  key: string;
  description: string;
  action: (event: KeyboardEvent) => void;
  when?: () => boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

type UseScopedKeymapOptions = {
  scope: KeyboardScope;
  enabled?: boolean;
  ignoreEditableTargets?: boolean;
  bindings: KeyBinding[];
};

/**
 * Register scoped keyboard bindings for a surface.
 *
 * Bindings only fire when:
 * 1. The surface with the given scope is focused (or no surface is focused)
 * 2. `enabled` is true (defaults to true)
 * 3. The event target is not an editable element (when `ignoreEditableTargets` is true)
 * 4. The `when` condition returns true (if provided)
 */
export function useScopedKeymap({
  scope,
  enabled = true,
  ignoreEditableTargets = true,
  bindings,
}: UseScopedKeymapOptions): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (ignoreEditableTargets && isEditableTarget(e.target)) return;

      const focused = keyboardSurfaceRegistry.getFocused();
      if (focused && focused.scope !== scope) return;

      for (const binding of bindingsRef.current) {
        if (binding.key !== e.key) continue;
        if (binding.when && !binding.when()) continue;

        if (binding.preventDefault) e.preventDefault();
        if (binding.stopPropagation) e.stopPropagation();
        binding.action(e);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scope, enabled, ignoreEditableTargets]);
}

/**
 * Get all keybinding help for a scope from registered bindings.
 * Useful for generating help overlays.
 */
export function getScopeHelp(
  _scope: KeyboardScope,
  bindings: KeyBinding[],
): { key: string; description: string }[] {
  return bindings.map((b) => ({ key: b.key, description: b.description }));
}
