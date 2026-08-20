import type { Cat } from './catDocument';

export type EditableFamilyRelationship = 'parent' | 'adoptive' | 'mate';
export type FamilyRelationshipOperation = 'add' | 'remove';
export type BiologicalParentSlot = 'parent1' | 'parent2';

export interface FamilyRelationshipCommand {
  operation: FamilyRelationshipOperation;
  relationship: EditableFamilyRelationship;
  sourceId: string;
  targetId: string;
  replaceParentSlot?: BiologicalParentSlot;
}

export type FamilyRelationshipMutationResult =
  | { kind: 'success'; cats: Cat[]; message: string }
  | { kind: 'rejected'; message: string }
  | {
    kind: 'parent-slot-required';
    sourceId: string;
    targetId: string;
    parent1Id: string;
    parent2Id: string;
  };

export interface RemovableFamilyRelationship {
  relationship: EditableFamilyRelationship;
  sourceId: string;
  targetId: string;
}

const idForCat = (cat: Cat): string => String(cat?.ID ?? '');

const relationshipIds = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((entry) => entry !== null && entry !== undefined && entry !== '').map(String)
    : []
);

const appendUniqueId = (value: unknown, id: string): string[] => {
  const ids = relationshipIds(value);
  return ids.includes(id) ? ids : [...ids, id];
};

const removeId = (value: unknown, id: string): string[] => relationshipIds(value).filter((entry) => entry !== id);

const hasAncestor = (catsById: Map<string, Cat>, descendantId: string, ancestorId: string, visited = new Set<string>()): boolean => {
  if (descendantId === ancestorId) return true;
  if (visited.has(descendantId)) return false;
  visited.add(descendantId);
  const cat = catsById.get(descendantId);
  if (!cat) return false;
  return [cat.parent1, cat.parent2]
    .filter((parentId) => parentId !== null && parentId !== undefined && parentId !== '')
    .map(String)
    .some((parentId) => hasAncestor(catsById, parentId, ancestorId, visited));
};

export function findRemovableFamilyRelationships(cats: Cat[], firstId: string, secondId: string): RemovableFamilyRelationship[] {
  const sourceId = String(firstId);
  const targetId = String(secondId);
  if (!sourceId || !targetId || sourceId === targetId) return [];
  const catsById = new Map(cats.map((cat) => [idForCat(cat), cat]));
  const first = catsById.get(sourceId);
  const second = catsById.get(targetId);
  if (!first || !second) return [];

  const removable: RemovableFamilyRelationship[] = [];
  const addIfPresent = (parent: Cat, child: Cat, relationship: 'parent' | 'adoptive') => {
    const parentId = idForCat(parent);
    const childId = idForCat(child);
    const parentIds = relationship === 'parent'
      ? [child.parent1, child.parent2].filter((id) => id !== null && id !== undefined && id !== '').map(String)
      : relationshipIds(child.adoptive_parents);
    if (parentIds.includes(parentId)) removable.push({ relationship, sourceId: parentId, targetId: childId });
  };

  addIfPresent(first, second, 'parent');
  addIfPresent(second, first, 'parent');
  addIfPresent(first, second, 'adoptive');
  addIfPresent(second, first, 'adoptive');
  if (relationshipIds(first.mate).includes(targetId) || relationshipIds(second.mate).includes(sourceId)) {
    removable.push({ relationship: 'mate', sourceId, targetId });
  }
  return removable;
}

export function applyFamilyRelationshipCommand(cats: Cat[], command: FamilyRelationshipCommand): FamilyRelationshipMutationResult {
  const sourceId = String(command.sourceId);
  const targetId = String(command.targetId);
  if (!sourceId || !targetId) return { kind: 'rejected', message: 'Choose two cats before editing a relationship.' };
  if (sourceId === targetId) return { kind: 'rejected', message: 'A cat cannot be connected to itself.' };

  const catsById = new Map(cats.map((cat) => [idForCat(cat), cat]));
  const source = catsById.get(sourceId);
  const target = catsById.get(targetId);
  if (!source || !target) return { kind: 'rejected', message: 'One of the selected cats no longer exists in this save.' };

  const nextCats = structuredClone(cats);
  const nextById = new Map(nextCats.map((cat) => [idForCat(cat), cat]));
  const nextSource = nextById.get(sourceId)!;
  const nextTarget = nextById.get(targetId)!;

  if (command.relationship === 'mate') {
    const sourceMates = relationshipIds(source.mate);
    const targetMates = relationshipIds(target.mate);
    const linked = sourceMates.includes(targetId) || targetMates.includes(sourceId);
    if (command.operation === 'add') {
      if (linked) return { kind: 'rejected', message: 'These cats are already current mates.' };
      nextSource.mate = appendUniqueId(nextSource.mate, targetId);
      nextTarget.mate = appendUniqueId(nextTarget.mate, sourceId);
      return { kind: 'success', cats: nextCats, message: 'Added reciprocal current-mate relationship.' };
    }
    if (!linked) return { kind: 'rejected', message: 'These cats are not current mates.' };
    nextSource.mate = removeId(nextSource.mate, targetId);
    nextTarget.mate = removeId(nextTarget.mate, sourceId);
    return { kind: 'success', cats: nextCats, message: 'Removed reciprocal current-mate relationship.' };
  }

  const parentId = sourceId;
  const childId = targetId;
  if (command.relationship === 'adoptive') {
    const adoptiveParents = relationshipIds(target.adoptive_parents);
    if (command.operation === 'add') {
      if (adoptiveParents.includes(parentId)) return { kind: 'rejected', message: 'This cat is already an adoptive parent.' };
      nextTarget.adoptive_parents = appendUniqueId(nextTarget.adoptive_parents, parentId);
      return { kind: 'success', cats: nextCats, message: 'Added adoptive parent relationship.' };
    }
    if (!adoptiveParents.includes(parentId)) return { kind: 'rejected', message: 'This cat is not an adoptive parent.' };
    nextTarget.adoptive_parents = removeId(nextTarget.adoptive_parents, parentId);
    return { kind: 'success', cats: nextCats, message: 'Removed adoptive parent relationship.' };
  }

  const biologicalParentIds = [target.parent1, target.parent2]
    .filter((parentId) => parentId !== null && parentId !== undefined && parentId !== '')
    .map(String);
  if (command.operation === 'remove') {
    if (!biologicalParentIds.includes(parentId)) return { kind: 'rejected', message: 'This cat is not a biological parent.' };
    if (String(nextTarget.parent1 ?? '') === parentId) nextTarget.parent1 = null;
    if (String(nextTarget.parent2 ?? '') === parentId) nextTarget.parent2 = null;
    return { kind: 'success', cats: nextCats, message: 'Removed biological parent relationship.' };
  }

  if (biologicalParentIds.includes(parentId)) return { kind: 'rejected', message: 'This cat is already a biological parent.' };
  if (hasAncestor(catsById, parentId, childId)) return { kind: 'rejected', message: 'This relationship would create a biological family cycle.' };

  const parent1Empty = target.parent1 === null || target.parent1 === undefined || target.parent1 === '';
  const parent2Empty = target.parent2 === null || target.parent2 === undefined || target.parent2 === '';
  const slot = command.replaceParentSlot ?? (parent1Empty ? 'parent1' : parent2Empty ? 'parent2' : null);
  if (!slot) {
    return {
      kind: 'parent-slot-required',
      sourceId,
      targetId,
      parent1Id: String(target.parent1),
      parent2Id: String(target.parent2),
    };
  }
  nextTarget[slot] = parentId;
  return { kind: 'success', cats: nextCats, message: `Set ${slot === 'parent1' ? 'first' : 'second'} biological parent.` };
}