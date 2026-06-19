import { describe, expect, it } from "vitest";
import {
  findDirectionalPane,
  type PaneNode,
} from "./panes";

function leaf(id: number): PaneNode {
  return { kind: "leaf", id };
}

function row(...children: PaneNode[]): PaneNode {
  return { kind: "split", id: 0, dir: "row", children };
}

function col(...children: PaneNode[]): PaneNode {
  return { kind: "split", id: 0, dir: "col", children };
}

describe("findDirectionalPane", () => {
  describe("simple row split (left/right)", () => {
    const tree = row(leaf(1), leaf(2), leaf(3));

    it("moves right from first pane", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(2);
    });

    it("moves right from middle pane", () => {
      expect(findDirectionalPane(tree, 2, "right")).toBe(3);
    });

    it("stays at last pane when pressing right", () => {
      expect(findDirectionalPane(tree, 3, "right")).toBe(3);
    });

    it("moves left from last pane", () => {
      expect(findDirectionalPane(tree, 3, "left")).toBe(2);
    });

    it("moves left from middle pane", () => {
      expect(findDirectionalPane(tree, 2, "left")).toBe(1);
    });

    it("stays at first pane when pressing left", () => {
      expect(findDirectionalPane(tree, 1, "left")).toBe(1);
    });

    it("up/down returns current pane in row-only tree", () => {
      expect(findDirectionalPane(tree, 1, "up")).toBe(1);
      expect(findDirectionalPane(tree, 1, "down")).toBe(1);
    });
  });

  describe("simple col split (up/down)", () => {
    const tree = col(leaf(1), leaf(2), leaf(3));

    it("moves down from first pane", () => {
      expect(findDirectionalPane(tree, 1, "down")).toBe(2);
    });

    it("moves down from middle pane", () => {
      expect(findDirectionalPane(tree, 2, "down")).toBe(3);
    });

    it("stays at last pane when pressing down", () => {
      expect(findDirectionalPane(tree, 3, "down")).toBe(3);
    });

    it("moves up from last pane", () => {
      expect(findDirectionalPane(tree, 3, "up")).toBe(2);
    });

    it("moves up from middle pane", () => {
      expect(findDirectionalPane(tree, 2, "up")).toBe(1);
    });

    it("stays at first pane when pressing up", () => {
      expect(findDirectionalPane(tree, 1, "up")).toBe(1);
    });

    it("left/right returns current pane in col-only tree", () => {
      expect(findDirectionalPane(tree, 1, "left")).toBe(1);
      expect(findDirectionalPane(tree, 1, "right")).toBe(1);
    });
  });

  describe("nested row inside col", () => {
    // col
    // ├── row
    // │   ├── leaf 1 (top-left)
    // │   └── leaf 2 (top-right)
    // └── leaf 3 (bottom, full width)
    const tree = col(row(leaf(1), leaf(2)), leaf(3));

    it("moves right within inner row", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(2);
    });

    it("moves left within inner row", () => {
      expect(findDirectionalPane(tree, 2, "left")).toBe(1);
    });

    it("moves down from inner row to next col child", () => {
      expect(findDirectionalPane(tree, 1, "down")).toBe(3);
      expect(findDirectionalPane(tree, 2, "down")).toBe(3);
    });

    it("moves up from col child to inner row", () => {
      const result = findDirectionalPane(tree, 3, "up");
      expect(result === 1 || result === 2).toBe(true);
    });
  });

  describe("nested col inside row", () => {
    // row
    // ├── col
    // │   ├── leaf 1 (top-left)
    // │   └── leaf 2 (bottom-left)
    // └── leaf 3 (right, full height)
    const tree = row(col(leaf(1), leaf(2)), leaf(3));

    it("moves down within inner col", () => {
      expect(findDirectionalPane(tree, 1, "down")).toBe(2);
    });

    it("moves up within inner col", () => {
      expect(findDirectionalPane(tree, 2, "up")).toBe(1);
    });

    it("moves right from inner col to next row child", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(3);
      expect(findDirectionalPane(tree, 2, "right")).toBe(3);
    });

    it("moves left from row child to inner col", () => {
      const result = findDirectionalPane(tree, 3, "left");
      expect(result === 1 || result === 2).toBe(true);
    });
  });

  describe("2x2 grid (position-aware)", () => {
    // row
    // ├── col
    // │   ├── leaf 1 (top-left)
    // │   └── leaf 2 (bottom-left)
    // └── col
    //     ├── leaf 3 (top-right)
    //     └── leaf 4 (bottom-right)
    const tree = row(col(leaf(1), leaf(2)), col(leaf(3), leaf(4)));

    it("1(down) -> 2", () => {
      expect(findDirectionalPane(tree, 1, "down")).toBe(2);
    });

    it("1(right) -> 3", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(3);
    });

    it("4(up) -> 3", () => {
      expect(findDirectionalPane(tree, 4, "up")).toBe(3);
    });

    it("4(left) -> 2", () => {
      expect(findDirectionalPane(tree, 4, "left")).toBe(2);
    });

    it("2(right) -> 4 (same row overlap)", () => {
      expect(findDirectionalPane(tree, 2, "right")).toBe(4);
    });

    it("3(left) -> 1 (same row overlap)", () => {
      expect(findDirectionalPane(tree, 3, "left")).toBe(1);
    });

    it("2(up) -> 1", () => {
      expect(findDirectionalPane(tree, 2, "up")).toBe(1);
    });

    it("3(down) -> 4", () => {
      expect(findDirectionalPane(tree, 3, "down")).toBe(4);
    });
  });

  describe("three-column with nested row", () => {
    // row
    // ├── leaf 1 (left column, full height)
    // ├── col
    // │   ├── leaf 2 (middle column, top half)
    // │   └── leaf 3 (middle column, bottom half)
    // └── leaf 4 (right column, full height)
    const tree = row(leaf(1), col(leaf(2), leaf(3)), leaf(4));

    it("1(right) -> 2 (immediate spatial neighbor)", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(2);
    });

    it("4(left) -> 2 (equidistant, lower id wins)", () => {
      expect(findDirectionalPane(tree, 4, "left")).toBe(2);
    });

    it("2(right) -> 4", () => {
      expect(findDirectionalPane(tree, 2, "right")).toBe(4);
    });

    it("3(left) -> 1", () => {
      expect(findDirectionalPane(tree, 3, "left")).toBe(1);
    });

    it("1(down) stays (spans full height)", () => {
      expect(findDirectionalPane(tree, 1, "down")).toBe(1);
    });

    it("4(down) stays (spans full height)", () => {
      expect(findDirectionalPane(tree, 4, "down")).toBe(4);
    });

    it("2(up) stays (already at top)", () => {
      expect(findDirectionalPane(tree, 2, "up")).toBe(2);
    });

    it("3(up) -> 2 (same column, strictly above)", () => {
      expect(findDirectionalPane(tree, 3, "up")).toBe(2);
    });
  });

  describe("single leaf", () => {
    const tree = leaf(1);

    it("returns current for all directions", () => {
      expect(findDirectionalPane(tree, 1, "left")).toBe(1);
      expect(findDirectionalPane(tree, 1, "right")).toBe(1);
      expect(findDirectionalPane(tree, 1, "up")).toBe(1);
      expect(findDirectionalPane(tree, 1, "down")).toBe(1);
    });
  });

  describe("unknown leaf id", () => {
    const tree = row(leaf(1), leaf(2));

    it("returns the unknown id unchanged", () => {
      expect(findDirectionalPane(tree, 99, "right")).toBe(99);
    });
  });

  describe("fallback when no perpendicular overlap", () => {
    // row
    // ├── col
    // │   ├── leaf 1 (top-left, small)
    // │   └── leaf 2 (bottom-left, small)
    // └── leaf 3 (right, full height)
    const tree = row(col(leaf(1), leaf(2)), leaf(3));

    it("1(right) -> 3 (no horizontal overlap but nearest)", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(3);
    });

    it("2(right) -> 3 (no horizontal overlap but nearest)", () => {
      expect(findDirectionalPane(tree, 2, "right")).toBe(3);
    });
  });

  describe("asymmetric 2x3 grid", () => {
    // row
    // ├── col
    // │   ├── leaf 1
    // │   ├── leaf 2
    // │   └── leaf 3
    // └── col
    //     ├── leaf 4
    //     └── leaf 5
    const tree = row(col(leaf(1), leaf(2), leaf(3)), col(leaf(4), leaf(5)));

    it("1(right) -> 4 (top overlap)", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(4);
    });

    it("2(right) -> 4 (y-overlap with leaf 4)", () => {
      expect(findDirectionalPane(tree, 2, "right")).toBe(4);
    });

    it("3(right) -> 5 (bottom overlap)", () => {
      expect(findDirectionalPane(tree, 3, "right")).toBe(5);
    });

    it("4(left) -> 1 (top overlap)", () => {
      expect(findDirectionalPane(tree, 4, "left")).toBe(1);
    });

    it("5(left) -> 3 (bottom overlap)", () => {
      expect(findDirectionalPane(tree, 5, "left")).toBe(3);
    });
  });

  describe("3x3 grid", () => {
    // row
    // ├── col
    // │   ├── leaf 1
    // │   ├── leaf 2
    // │   └── leaf 3
    // ├── col
    // │   ├── leaf 4
    // │   ├── leaf 5
    // │   └── leaf 6
    // └── col
    //     ├── leaf 7
    //     ├── leaf 8
    //     └── leaf 9
    const tree = row(
      col(leaf(1), leaf(2), leaf(3)),
      col(leaf(4), leaf(5), leaf(6)),
      col(leaf(7), leaf(8), leaf(9)),
    );

    it("1(right) -> 4 (top overlap)", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(4);
    });

    it("5(right) -> 8 (middle overlap in next column)", () => {
      expect(findDirectionalPane(tree, 5, "right")).toBe(8);
    });

    it("9(left) -> 6 (bottom overlap)", () => {
      expect(findDirectionalPane(tree, 9, "left")).toBe(6);
    });

    it("5(down) -> 6 (same column, strictly below)", () => {
      expect(findDirectionalPane(tree, 5, "down")).toBe(6);
    });

    it("2(up) -> 1 (same column, strictly above)", () => {
      expect(findDirectionalPane(tree, 2, "up")).toBe(1);
    });
  });

  describe("deeply nested splits", () => {
    // col
    // ├── row
    // │   ├── leaf 1
    // │   └── leaf 2
    // └── row
    //     ├── leaf 3
    //     └── leaf 4
    const tree = col(row(leaf(1), leaf(2)), row(leaf(3), leaf(4)));

    it("1(right) -> 2", () => {
      expect(findDirectionalPane(tree, 1, "right")).toBe(2);
    });

    it("1(down) -> 3 (bottom overlap)", () => {
      expect(findDirectionalPane(tree, 1, "down")).toBe(3);
    });

    it("2(down) -> 4 (bottom overlap)", () => {
      expect(findDirectionalPane(tree, 2, "down")).toBe(4);
    });

    it("4(left) -> 3", () => {
      expect(findDirectionalPane(tree, 4, "left")).toBe(3);
    });

    it("3(up) -> 1 (top overlap)", () => {
      expect(findDirectionalPane(tree, 3, "up")).toBe(1);
    });

    it("4(up) -> 2 (top overlap)", () => {
      expect(findDirectionalPane(tree, 4, "up")).toBe(2);
    });
  });
});
