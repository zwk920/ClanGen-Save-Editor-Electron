export interface ClanMetadataReconciliationResult {
  metadata: Record<string, unknown>;
  changedFields: string[];
}

const SCALAR_CAT_ID_FIELDS = ['leader', 'deputy', 'med_cat', 'instructor', 'demon', 'your_cat', 'focus_cat'] as const;
const LIST_CAT_ID_FIELDS = ['mediated', 'just_died', 'dead_cats_to_grieve', 'patrolled_cats'] as const;

const hasId = (validIds: Set<string>, value: unknown): boolean => (
  typeof value === 'string' && validIds.has(value)
);

export function reconcileClanMetadata(metadata: Record<string, unknown>, catIds: Iterable<string | number>): ClanMetadataReconciliationResult {
  const validIds = new Set([...catIds].map(String));
  const nextMetadata = structuredClone(metadata);
  const changedFields: string[] = [];

  for (const field of SCALAR_CAT_ID_FIELDS) {
    const value = nextMetadata[field];
    if (value !== null && value !== undefined && value !== '' && !hasId(validIds, value)) {
      nextMetadata[field] = null;
      changedFields.push(field);
    }
  }

  for (const field of LIST_CAT_ID_FIELDS) {
    const value = nextMetadata[field];
    if (!Array.isArray(value)) continue;
    const filtered = value.filter((entry) => hasId(validIds, entry));
    if (filtered.length !== value.length) {
      nextMetadata[field] = filtered;
      changedFields.push(field);
    }
  }

  const griefAssignments = nextMetadata.grief_to_assign;
  if (griefAssignments && typeof griefAssignments === 'object' && !Array.isArray(griefAssignments)) {
    const filteredEntries = Object.entries(griefAssignments as Record<string, unknown>)
      .filter(([catId]) => validIds.has(catId));
    if (filteredEntries.length !== Object.keys(griefAssignments).length) {
      nextMetadata.grief_to_assign = Object.fromEntries(filteredEntries);
      changedFields.push('grief_to_assign');
    }
  }

  return { metadata: nextMetadata, changedFields };
}