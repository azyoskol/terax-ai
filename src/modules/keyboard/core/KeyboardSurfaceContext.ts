/**
 * React context and hook for the keyboard surface registry.
 */
import { createContext, useContext, useEffect, useRef } from "react";
import {
  keyboardSurfaceRegistry,
  type KeyboardSurfaceHandle,
  type KeyboardScope,
} from "./KeyboardSurfaceRegistry";

const KeyboardSurfaceContext = createContext(
  () => keyboardSurfaceRegistry,
);

export function useKeyboardSurfaceRegistry() {
  return useContext(KeyboardSurfaceContext)();
}

/**
 * Register a keyboard surface on mount, deregister on unmount.
 * Returns the registry instance for direct access.
 */
export function useRegisterSurface(
  handle: KeyboardSurfaceHandle,
): typeof keyboardSurfaceRegistry {
  const registry = useKeyboardSurfaceRegistry();
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const h: KeyboardSurfaceHandle = {
      get id() {
        return handleRef.current.id;
      },
      get scope() {
        return handleRef.current.scope;
      },
      focus: () => handleRef.current.focus(),
      isFocused: () => handleRef.current.isFocused(),
      ...(handleRef.current.getHelp
        ? { getHelp: () => handleRef.current.getHelp?.() ?? [] }
        : {}),
    };
    return registry.register(h);
  }, [registry]);

  return registry;
}

/**
 * Focus a surface by scope. Returns true if a surface was found and focused.
 */
export function focusSurfaceByScope(scope: KeyboardScope): boolean | void {
  return keyboardSurfaceRegistry.focusScope(scope);
}

/**
 * Focus a surface by id. Returns true if a surface was found and focused.
 */
export function focusSurfaceById(id: string): boolean | void {
  return keyboardSurfaceRegistry.focus(id);
}

/**
 * Get the currently focused surface, if any.
 */
export function getFocusedSurface(): KeyboardSurfaceHandle | undefined {
  return keyboardSurfaceRegistry.getFocused();
}
