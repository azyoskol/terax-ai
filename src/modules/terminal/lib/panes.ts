export type PaneId = number;

export type SplitDir = "row" | "col";

export type PaneNode =
  | { kind: "leaf"; id: PaneId; cwd?: string }
  | {
      kind: "split";
      id: PaneId;
      dir: SplitDir;
      children: PaneNode[];
    };

export function isLeaf(
  n: PaneNode,
): n is Extract<PaneNode, { kind: "leaf" }> {
  return n.kind === "leaf";
}

export function leafIds(n: PaneNode): PaneId[] {
  if (isLeaf(n)) return [n.id];
  return n.children.flatMap(leafIds);
}

export function findLeafCwd(n: PaneNode, id: PaneId): string | undefined {
  if (isLeaf(n)) return n.id === id ? n.cwd : undefined;
  for (const c of n.children) {
    const found = findLeafCwd(c, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function setLeafCwd(
  n: PaneNode,
  id: PaneId,
  cwd: string,
): PaneNode {
  if (isLeaf(n)) {
    if (n.id !== id || n.cwd === cwd) return n;
    return { ...n, cwd };
  }
  let changed = false;
  const next = n.children.map((c) => {
    const u = setLeafCwd(c, id, cwd);
    if (u !== c) changed = true;
    return u;
  });
  return changed ? { ...n, children: next } : n;
}

/**
 * Insert a new leaf next to `targetId` in direction `dir`.
 *
 * If the target's enclosing split already runs in `dir`, the new leaf is
 * appended as a sibling there (avoids nested same-direction splits — keeps
 * the tree shallow and the resize handles aligned).
 */
export function splitLeaf(
  tree: PaneNode,
  targetId: PaneId,
  newSplitId: PaneId,
  newLeafId: PaneId,
  dir: SplitDir,
  newCwd?: string,
): PaneNode {
  if (tree.kind === "split" && tree.dir === dir) {
    const idx = tree.children.findIndex(
      (c) => c.kind === "leaf" && c.id === targetId,
    );
    if (idx >= 0) {
      const newLeaf: PaneNode = { kind: "leaf", id: newLeafId, cwd: newCwd };
      return {
        ...tree,
        children: [
          ...tree.children.slice(0, idx + 1),
          newLeaf,
          ...tree.children.slice(idx + 1),
        ],
      };
    }
  }
  if (isLeaf(tree)) {
    if (tree.id !== targetId) return tree;
    const newLeaf: PaneNode = { kind: "leaf", id: newLeafId, cwd: newCwd };
    return {
      kind: "split",
      id: newSplitId,
      dir,
      children: [tree, newLeaf],
    };
  }
  return {
    ...tree,
    children: tree.children.map((c) =>
      splitLeaf(c, targetId, newSplitId, newLeafId, dir, newCwd),
    ),
  };
}

/**
 * Remove a leaf and collapse single-child splits left in its wake. Returns
 * `null` when the entire subtree is gone.
 */
export function removeLeaf(
  tree: PaneNode,
  targetId: PaneId,
): PaneNode | null {
  if (isLeaf(tree)) return tree.id === targetId ? null : tree;
  const newChildren: PaneNode[] = [];
  for (const c of tree.children) {
    const r = removeLeaf(c, targetId);
    if (r !== null) newChildren.push(r);
  }
  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...tree, children: newChildren };
}

export function nextLeafId(
  tree: PaneNode,
  currentId: PaneId,
  delta: 1 | -1,
): PaneId {
  const ids = leafIds(tree);
  if (ids.length === 0) return currentId;
  const idx = ids.indexOf(currentId);
  if (idx < 0) return ids[0];
  return ids[(idx + delta + ids.length) % ids.length];
}

// Closest neighbor of `leafId` within its enclosing split — prefer the
// next sibling, fall back to the previous. Used to pick the new focus
// when a pane closes (so focus stays in the same neighborhood instead of
// snapping to the first pane in the tree).
export function siblingLeafOf(
  tree: PaneNode,
  leafId: PaneId,
): PaneId | null {
  if (isLeaf(tree)) return null;
  for (let i = 0; i < tree.children.length; i++) {
    const c = tree.children[i];
    if (isLeaf(c) && c.id === leafId) {
      const sibling = tree.children[i + 1] ?? tree.children[i - 1];
      if (!sibling) return null;
      return leafIds(sibling)[0] ?? null;
    }
  }
  for (const c of tree.children) {
    if (!isLeaf(c)) {
      const r = siblingLeafOf(c, leafId);
      if (r !== null) return r;
    }
  }
  return null;
}

export function hasLeaf(tree: PaneNode, id: PaneId): boolean {
  return leafIds(tree).includes(id);
}

export type Direction = "left" | "right" | "up" | "down";

// Virtual rectangle for a leaf pane. Coordinates are in [0,1] unit space.
export type PaneRect = {
  id: PaneId;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Recursively computes virtual rectangles for all leaves.
// Splits divide space equally among children (equal-weight assumption).
// Actual panel sizes from react-resizable-panels are not available in PaneNode.
function computeLeafRects(
  node: PaneNode,
  x: number,
  y: number,
  width: number,
  height: number,
  out: PaneRect[],
): void {
  if (isLeaf(node)) {
    out.push({ id: node.id, x, y, width, height });
    return;
  }
  const n = node.children.length;
  if (n === 0) return;
  const share = 1 / n;
  for (let i = 0; i < n; i++) {
    const frac = i * share;
    if (node.dir === "row") {
      computeLeafRects(
        node.children[i],
        x + width * frac,
        y,
        width * share,
        height,
        out,
      );
    } else {
      computeLeafRects(
        node.children[i],
        x,
        y + height * frac,
        width,
        height * share,
        out,
      );
    }
  }
}

function leafRects(tree: PaneNode): PaneRect[] {
  const rects: PaneRect[] = [];
  computeLeafRects(tree, 0, 0, 1, 1, rects);
  return rects;
}

function overlap(a: PaneRect, b: PaneRect, axis: "x" | "y"): number {
  if (axis === "x") {
    const lo = Math.max(a.x, b.x);
    const hi = Math.min(a.x + a.width, b.x + b.width);
    return Math.max(0, hi - lo);
  }
  const lo = Math.max(a.y, b.y);
  const hi = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, hi - lo);
}

function centerDistance(a: PaneRect, b: PaneRect): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function axisDistance(a: PaneRect, b: PaneRect, direction: Direction): number {
  switch (direction) {
    case "right":
      return b.x - (a.x + a.width);
    case "left":
      return a.x - (b.x + b.width);
    case "down":
      return b.y - (a.y + a.height);
    case "up":
      return a.y - (b.y + b.height);
  }
}

function treeDistance(
  tree: PaneNode,
  fromId: PaneId,
  toId: PaneId,
): number {
  function findPath(node: PaneNode, target: PaneId): PaneNode[] | null {
    if (isLeaf(node)) return node.id === target ? [node] : null;
    for (const c of node.children) {
      const p = findPath(c, target);
      if (p) return [node, ...p];
    }
    return null;
  }
  const pathA = findPath(tree, fromId);
  const pathB = findPath(tree, toId);
  if (!pathA || !pathB) return Infinity;
  let common = 0;
  while (common < pathA.length && common < pathB.length && pathA[common] === pathB[common]) {
    common++;
  }
  return pathA.length + pathB.length - 2 * common;
}

export function findDirectionalPane(
  tree: PaneNode,
  currentId: PaneId,
  direction: Direction,
): PaneId {
  const rects = leafRects(tree);
  const current = rects.find((r) => r.id === currentId);
  if (!current) return currentId;

  const isHoriz = direction === "left" || direction === "right";
  const perpAxis: "x" | "y" = isHoriz ? "y" : "x";

  type Candidate = {
    id: PaneId;
    axisDist: number;
    perpOverlap: number;
    dist: number;
    tdist: number;
  };
  const candidates: Candidate[] = [];

  for (const r of rects) {
    if (r.id === currentId) continue;

    let strictlyInDir = false;
    if (isHoriz) {
      strictlyInDir =
        direction === "right"
          ? r.x >= current.x + current.width
          : r.x + r.width <= current.x;
    } else {
      strictlyInDir =
        direction === "down"
          ? r.y >= current.y + current.height
          : r.y + r.height <= current.y;
    }
    if (!strictlyInDir) continue;

    candidates.push({
      id: r.id,
      axisDist: axisDistance(current, r, direction),
      perpOverlap: overlap(current, r, perpAxis),
      dist: centerDistance(current, r),
      tdist: treeDistance(tree, currentId, r.id),
    });
  }

  if (candidates.length === 0) return currentId;

  candidates.sort((a, b) => {
    if (a.axisDist !== b.axisDist) return a.axisDist - b.axisDist;
    if (a.perpOverlap > 0 && b.perpOverlap > 0) {
      return b.perpOverlap - a.perpOverlap;
    }
    if (a.perpOverlap > 0) return -1;
    if (b.perpOverlap > 0) return 1;
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.tdist - b.tdist;
  });

  return candidates[0].id;
}
