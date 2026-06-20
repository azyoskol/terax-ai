/**
 * Surface focus registry for keyboard navigation.
 *
 * Provides a central registry where UI surfaces (editor, explorer, source
 * control, etc.) can register themselves for focus management and keyboard
 * scope detection.
 */

export type KeyboardScope =
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

export type KeyBindingHelp = {
  key: string;
  description: string;
};

export type KeyboardSurfaceHandle = {
  id: string;
  scope: KeyboardScope;
  focus: () => boolean | void;
  isFocused: () => boolean;
  getHelp?: () => KeyBindingHelp[];
};

type SurfaceListener = (surfaces: KeyboardSurfaceHandle[]) => void;

class KeyboardSurfaceRegistryImpl {
  private surfaces = new Map<string, KeyboardSurfaceHandle>();
  private listeners = new Set<SurfaceListener>();

  register(handle: KeyboardSurfaceHandle): () => void {
    this.surfaces.set(handle.id, handle);
    this.notify();
    return () => {
      this.surfaces.delete(handle.id);
      this.notify();
    };
  }

  get(id: string): KeyboardSurfaceHandle | undefined {
    return this.surfaces.get(id);
  }

  getByScope(scope: KeyboardScope): KeyboardSurfaceHandle | undefined {
    for (const surface of this.surfaces.values()) {
      if (surface.scope === scope) return surface;
    }
    return undefined;
  }

  getFocused(): KeyboardSurfaceHandle | undefined {
    for (const surface of this.surfaces.values()) {
      if (surface.isFocused()) return surface;
    }
    return undefined;
  }

  getAll(): KeyboardSurfaceHandle[] {
    return Array.from(this.surfaces.values());
  }

  focus(id: string): boolean | void {
    const surface = this.surfaces.get(id);
    if (surface) return surface.focus();
    return false;
  }

  focusScope(scope: KeyboardScope): boolean | void {
    const surface = this.getByScope(scope);
    if (surface) return surface.focus();
    return false;
  }

  subscribe(listener: SurfaceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const all = this.getAll();
    for (const listener of this.listeners) {
      listener(all);
    }
  }
}

export const keyboardSurfaceRegistry = new KeyboardSurfaceRegistryImpl();
