export function normalizeVimKey(key: string): string {
  switch (key) {
    case "h":
      return "ArrowLeft";
    case "j":
      return "ArrowDown";
    case "k":
      return "ArrowUp";
    case "l":
      return "ArrowRight";
    default:
      return key;
  }
}

export const GG_TIMEOUT_MS = 800;

type KeyLike = { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean };

export function isPlainVimKey(e: KeyLike): boolean {
  return !e.ctrlKey && !e.altKey && !e.metaKey;
}

export function isPendingGKey(e: KeyLike): boolean {
  return isPlainVimKey(e) && e.key === "g";
}

export function isCapitalGKey(e: KeyLike): boolean {
  return !e.ctrlKey && !e.altKey && !e.metaKey && e.key === "G";
}
