import type { Tab } from "@/modules/tabs";
import type { SpaceMeta } from "./store";

export type NavItem =
  | { kind: "space"; spaceId: string }
  | { kind: "tab"; spaceId: string; tabId: number };

export function buildNavItems(
  spaces: SpaceMeta[],
  tabsBySpace: Map<string, Tab[]>,
  expanded: Set<string>,
): NavItem[] {
  const items: NavItem[] = [];
  for (const sp of spaces) {
    items.push({ kind: "space", spaceId: sp.id });
    if (expanded.has(sp.id)) {
      const spTabs = tabsBySpace.get(sp.id) ?? [];
      for (const t of spTabs) {
        items.push({ kind: "tab", spaceId: sp.id, tabId: t.id });
      }
    }
  }
  return items;
}
