import type { TreeItem } from "./tree";

// Turns the flat items map into a tree. Pure and deterministic: every device computes the same tree (FP-4.6).

export interface TreeNode {
  item: TreeItem;
  children: TreeNode[];
}

export type SortMode = "manual" | "name" | "created" | "edited";

export interface ResolveOptions {
  sort?: SortMode;
  /** Display name for sorting by name (doc titles live in their own docs). */
  nameOf?: (item: TreeItem) => string;
  /** Last-edited time for sorting by "edited"; falls back to createdAt. */
  editedAt?: (item: TreeItem) => number | undefined;
}

export function resolveTree(items: TreeItem[], opts: ResolveOptions = {}) {
  const live = new Map(items.filter((i) => !i.deletedAt).map((i) => [i.id, i]));

  // Effective parent: must be an existing, non-deleted folder, otherwise root (EC13 display rule)
  const parent = new Map<string, string | null>();
  for (const i of live.values()) {
    const p = i.parentId ? live.get(i.parentId) : undefined;
    parent.set(i.id, p?.type === "folder" ? p.id : null);
  }

  // Break folder cycles (EC12): the smallest id in each loop goes to root
  const broken: string[] = [];
  for (const start of live.keys()) {
    const path: string[] = [];
    let cur: string | null = start;
    while (cur && !path.includes(cur)) {
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
    if (cur) {
      const loop = path.slice(path.indexOf(cur));
      const victim = [...loop].sort()[0];
      parent.set(victim, null);
      broken.push(victim);
    }
  }

  const nodes = new Map([...live.values()].map((i) => [i.id, { item: i, children: [] } as TreeNode]));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const p = parent.get(node.item.id);
    (p ? nodes.get(p)!.children : roots).push(node);
  }

  const name = opts.nameOf ?? ((i: TreeItem) => i.name ?? "");
  const edited = (i: TreeItem) => opts.editedAt?.(i) ?? i.createdAt;
  const compare = (a: TreeNode, b: TreeNode) => {
    const x = a.item, y = b.item;
    if (opts.sort && opts.sort !== "manual" && x.type !== y.type) return x.type === "folder" ? -1 : 1;
    const byId = x.id < y.id ? -1 : 1; // tie-breaker keeps the order identical everywhere
    switch (opts.sort ?? "manual") {
      case "name": return name(x).localeCompare(name(y), undefined, { sensitivity: "base" }) || byId;
      case "created": return y.createdAt - x.createdAt || byId;
      case "edited": return edited(y) - edited(x) || byId;
      default: return x.order < y.order ? -1 : x.order > y.order ? 1 : byId;
    }
  };
  const sortAll = (list: TreeNode[]) => {
    list.sort(compare);
    list.forEach((n) => sortAll(n.children));
  };
  sortAll(roots);
  return { roots, broken: [...new Set(broken)] };
}
