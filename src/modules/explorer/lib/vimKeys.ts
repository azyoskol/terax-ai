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
