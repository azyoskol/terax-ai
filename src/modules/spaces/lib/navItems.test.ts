import { describe, expect, it } from "vitest";
import type { Tab } from "@/modules/tabs";
import type { SpaceMeta } from "./store";
import { buildNavItems } from "./navItems";

function space(id: string): SpaceMeta {
  return {
    id,
    name: id,
    root: `/root/${id}`,
    env: { kind: "local" },
    createdAt: 0,
    updatedAt: 0,
  };
}

function tab(id: number, spaceId: string): Tab {
  return {
    id,
    kind: "terminal",
    title: `tab-${id}`,
    spaceId,
    paneTree: { kind: "leaf", id },
    activeLeafId: id,
  };
}

describe("buildNavItems", () => {
  it("returns only space items when all collapsed", () => {
    const spaces = [space("a"), space("b")];
    const tabsBySpace = new Map<string, Tab[]>([
      ["a", [tab(1, "a")]],
      ["b", [tab(2, "b")]],
    ]);
    const expanded = new Set<string>();

    const items = buildNavItems(spaces, tabsBySpace, expanded);

    expect(items).toEqual([
      { kind: "space", spaceId: "a" },
      { kind: "space", spaceId: "b" },
    ]);
  });

  it("includes tabs for expanded spaces", () => {
    const spaces = [space("a"), space("b")];
    const tabsBySpace = new Map<string, Tab[]>([
      ["a", [tab(1, "a"), tab(2, "a")]],
      ["b", [tab(3, "b")]],
    ]);
    const expanded = new Set(["a"]);

    const items = buildNavItems(spaces, tabsBySpace, expanded);

    expect(items).toEqual([
      { kind: "space", spaceId: "a" },
      { kind: "tab", spaceId: "a", tabId: 1 },
      { kind: "tab", spaceId: "a", tabId: 2 },
      { kind: "space", spaceId: "b" },
    ]);
  });

  it("handles space with no tabs", () => {
    const spaces = [space("a")];
    const tabsBySpace = new Map<string, Tab[]>();
    const expanded = new Set(["a"]);

    const items = buildNavItems(spaces, tabsBySpace, expanded);

    expect(items).toEqual([{ kind: "space", spaceId: "a" }]);
  });

  it("returns empty for empty spaces", () => {
    const items = buildNavItems([], new Map(), new Set());
    expect(items).toEqual([]);
  });

  it("preserves space order", () => {
    const spaces = [space("c"), space("a"), space("b")];
    const tabsBySpace = new Map<string, Tab[]>();
    const expanded = new Set<string>();

    const items = buildNavItems(spaces, tabsBySpace, expanded);

    expect(items.map((i) => i.kind === "space" ? i.spaceId : null)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("preserves tab order within expanded space", () => {
    const spaces = [space("a")];
    const tabsBySpace = new Map<string, Tab[]>([
      ["a", [tab(3, "a"), tab(1, "a"), tab(2, "a")]],
    ]);
    const expanded = new Set(["a"]);

    const items = buildNavItems(spaces, tabsBySpace, expanded);

    expect(items).toEqual([
      { kind: "space", spaceId: "a" },
      { kind: "tab", spaceId: "a", tabId: 3 },
      { kind: "tab", spaceId: "a", tabId: 1 },
      { kind: "tab", spaceId: "a", tabId: 2 },
    ]);
  });
});
