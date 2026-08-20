import type { Cat } from './catDocument';
import { isDeadCat } from './afterlife';

export type RelationshipEntry = Record<string, unknown>;
export type RelationshipFiles = Record<string, RelationshipEntry[]>;

export function createDefaultRelationshipEntry(fromId: string, toId: string): RelationshipEntry {
  return {
    cat_from_id: fromId,
    cat_to_id: toId,
    mates: false,
    family: false,
    romance: 0,
    like: 0,
    respect: 0,
    comfort: 0,
    trust: 0,
    log: [],
    no_longer_neutral: [],
  };
}

/** Cats (excluding the given one) that should receive a relationship with it, mirroring the game's living-cats-only rule. */
export function livingCatIdsExcluding(cats: Cat[], excludeCatId: string): string[] {
  return cats
    .filter((cat) => String(cat?.ID ?? '') !== excludeCatId && !isDeadCat(cat))
    .map((cat) => String(cat.ID));
}

/** Builds the new cat's relations file and the reciprocal entries to append to every other living cat's file. */
export function createRelationshipsForNewCat(
  newCatId: string,
  cats: Cat[],
): { newCatEntries: RelationshipEntry[]; reciprocalEntriesByCatId: Record<string, RelationshipEntry> } {
  const otherCatIds = livingCatIdsExcluding(cats, newCatId);
  const newCatEntries = otherCatIds.map((otherId) => createDefaultRelationshipEntry(newCatId, otherId));
  const reciprocalEntriesByCatId: Record<string, RelationshipEntry> = {};
  for (const otherId of otherCatIds) {
    reciprocalEntriesByCatId[otherId] = createDefaultRelationshipEntry(otherId, newCatId);
  }
  return { newCatEntries, reciprocalEntriesByCatId };
}
