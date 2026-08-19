import type { Cat } from './catDocument';
import { afterlifeStateForCat, isDeadCat } from './afterlife';

export type FamilyEdgeKind = 'parent' | 'adoptive' | 'mate';

export interface FamilyGraphNode {
  id: string;
  cat: Cat;
  generation: number;
  row: number;
  connectionCount: number;
}

export interface FamilyGraphEdge {
  source: string;
  target: string;
  kind: FamilyEdgeKind;
}

export interface FamilyGraph {
  nodes: FamilyGraphNode[];
  edges: FamilyGraphEdge[];
  width: number;
  height: number;
}

const relationIds = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item) => item !== null && item !== undefined && item !== '')
    .map(String);
};

  const deadCatStateOrder = ['starclan', 'unknown_residence', 'dark_forest'];

export function buildFamilyGraph(cats: Cat[], focusId?: string | null): FamilyGraph {
  const catsById = new Map<string, Cat>();
  for (const cat of cats) {
    const id = String(cat?.ID ?? '');
    if (id && !catsById.has(id)) catsById.set(id, cat);
  }

  const parentIds = new Map<string, string[]>();
  const edges: FamilyGraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (source: string, target: string, kind: FamilyEdgeKind) => {
    if (!catsById.has(source) || !catsById.has(target) || source === target) return;
    const key = kind === 'mate'
      ? `${kind}:${[source, target].sort().join(':')}`
      : `${kind}:${source}:${target}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ source, target, kind });
  };

  for (const [id, cat] of catsById) {
    const biologicalParents = relationIds([cat.parent1, cat.parent2]);
    parentIds.set(id, biologicalParents.filter((parentId) => catsById.has(parentId)));
    for (const parentId of biologicalParents) addEdge(parentId, id, 'parent');
    for (const parentId of relationIds(cat.adoptive_parents)) addEdge(parentId, id, 'adoptive');
    for (const mateId of relationIds(cat.mate)) addEdge(id, mateId, 'mate');
    for (const mateId of relationIds(cat.previous_mates)) addEdge(id, mateId, 'mate');
  }

  const focusedIds = new Set<string>();
  if (focusId && catsById.has(focusId)) {
    const connected = new Map<string, string[]>();
    for (const edge of edges) {
      connected.set(edge.source, [...(connected.get(edge.source) ?? []), edge.target]);
      connected.set(edge.target, [...(connected.get(edge.target) ?? []), edge.source]);
    }
    const pending = [focusId];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (focusedIds.has(id)) continue;
      focusedIds.add(id);
      pending.push(...(connected.get(id) ?? []));
    }
  }

  const visibleIds = focusedIds.size > 0 ? focusedIds : new Set(catsById.keys());
  const visibleCatsById = new Map([...catsById].filter(([id]) => visibleIds.has(id)));
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const visibleParentIds = new Map([...parentIds].map(([id, parents]) => [id, parents.filter((parentId) => visibleIds.has(parentId))]));

  const generationMemo = new Map<string, number>();
  const generationFor = (id: string, visiting = new Set<string>()): number => {
    const cached = generationMemo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    const nextVisiting = new Set(visiting).add(id);
    const generation = Math.max(0, ...(visibleParentIds.get(id) ?? []).map((parentId) => generationFor(parentId, nextVisiting) + 1));
    generationMemo.set(id, generation);
    return generation;
  };

  const grouped = new Map<number, string[]>();
  for (const id of visibleCatsById.keys()) {
    const generation = generationFor(id);
    const group = grouped.get(generation) ?? [];
    group.push(id);
    grouped.set(generation, group);
  }

  const nodes: FamilyGraphNode[] = [];
  for (const [generation, ids] of [...grouped.entries()].sort(([a], [b]) => a - b)) {
    const connectionCount = (id: string) => visibleEdges.filter((edge) => edge.source === id || edge.target === id).length;
    const counts = new Map(ids.map((id) => [id, connectionCount(id)]));
    ids.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
      || ((counts.get(a) === 0 && counts.get(b) === 0 && isDeadCat(visibleCatsById.get(a)) && isDeadCat(visibleCatsById.get(b)))
        ? deadCatStateOrder.indexOf(afterlifeStateForCat(visibleCatsById.get(a))) - deadCatStateOrder.indexOf(afterlifeStateForCat(visibleCatsById.get(b)))
        : 0)
      || ((counts.get(a) === 0 && counts.get(b) === 0) ? Number(isDeadCat(visibleCatsById.get(a))) - Number(isDeadCat(visibleCatsById.get(b))) : 0)
      || String(visibleCatsById.get(a)?.name_prefix ?? '').localeCompare(String(visibleCatsById.get(b)?.name_prefix ?? ''))
      || a.localeCompare(b));
    ids.forEach((id, row) => nodes.push({ id, cat: visibleCatsById.get(id)!, generation, row, connectionCount: counts.get(id) ?? 0 }));
  }

  const columnCount = Math.max(1, grouped.size);
  const rowCount = Math.max(1, ...[...grouped.values()].map((ids) => ids.length));
  return {
    nodes,
    edges: visibleEdges,
    width: columnCount * 280 + 80,
    height: rowCount * 170 + 80,
  };
}