import { describe, expect, it } from 'vitest';
import { applyFamilyRelationshipCommand, findRemovableFamilyRelationships } from './familyRelationshipMutation';

const cat = (ID: string, relationships: Record<string, unknown> = {}) => ({
  ID,
  name_prefix: `Cat ${ID}`,
  parent1: null,
  parent2: null,
  adoptive_parents: [],
  mate: [],
  ...relationships,
});

describe('applyFamilyRelationshipCommand', () => {
  it('fills the first open biological parent slot', () => {
    const result = applyFamilyRelationshipCommand([cat('1'), cat('2')], {
      operation: 'add', relationship: 'parent', sourceId: '1', targetId: '2',
    });

    expect(result).toMatchObject({ kind: 'success' });
    if (result.kind !== 'success') return;
    expect(result.cats.find((entry) => entry.ID === '2')).toMatchObject({ parent1: '1', parent2: null });
  });

  it('requires an explicit slot when both biological parent slots are occupied', () => {
    const result = applyFamilyRelationshipCommand([cat('1'), cat('2'), cat('3', { parent1: '1', parent2: '2' }), cat('4')], {
      operation: 'add', relationship: 'parent', sourceId: '4', targetId: '3',
    });

    expect(result).toEqual({ kind: 'parent-slot-required', sourceId: '4', targetId: '3', parent1Id: '1', parent2Id: '2' });
  });

  it('rejects biological links that create a cycle', () => {
    const result = applyFamilyRelationshipCommand([cat('1'), cat('2', { parent1: '1' })], {
      operation: 'add', relationship: 'parent', sourceId: '2', targetId: '1',
    });

    expect(result).toMatchObject({ kind: 'rejected', message: expect.stringContaining('cycle') });
  });

  it('adds and removes adoptive parents without duplicates', () => {
    const cats = [cat('1'), cat('2')];
    const added = applyFamilyRelationshipCommand(cats, {
      operation: 'add', relationship: 'adoptive', sourceId: '1', targetId: '2',
    });
    expect(added).toMatchObject({ kind: 'success' });
    if (added.kind !== 'success') return;
    expect(added.cats.find((entry) => entry.ID === '2')?.adoptive_parents).toEqual(['1']);

    const removed = applyFamilyRelationshipCommand(added.cats, {
      operation: 'remove', relationship: 'adoptive', sourceId: '1', targetId: '2',
    });
    expect(removed).toMatchObject({ kind: 'success' });
    if (removed.kind !== 'success') return;
    expect(removed.cats.find((entry) => entry.ID === '2')?.adoptive_parents).toEqual([]);
  });

  it('keeps current mate additions and removals reciprocal', () => {
    const added = applyFamilyRelationshipCommand([cat('1'), cat('2')], {
      operation: 'add', relationship: 'mate', sourceId: '1', targetId: '2',
    });
    expect(added).toMatchObject({ kind: 'success' });
    if (added.kind !== 'success') return;
    expect(added.cats.find((entry) => entry.ID === '1')?.mate).toEqual(['2']);
    expect(added.cats.find((entry) => entry.ID === '2')?.mate).toEqual(['1']);

    const removed = applyFamilyRelationshipCommand(added.cats, {
      operation: 'remove', relationship: 'mate', sourceId: '1', targetId: '2',
    });
    expect(removed).toMatchObject({ kind: 'success' });
    if (removed.kind !== 'success') return;
    expect(removed.cats.find((entry) => entry.ID === '1')?.mate).toEqual([]);
    expect(removed.cats.find((entry) => entry.ID === '2')?.mate).toEqual([]);
  });

  it('finds every removable link regardless of selection order', () => {
    const matches = findRemovableFamilyRelationships([
      cat('1'),
      cat('2', { parent1: '1', adoptive_parents: ['1'], mate: ['1'] }),
    ], '2', '1');

    expect(matches).toEqual([
      { relationship: 'parent', sourceId: '1', targetId: '2' },
      { relationship: 'adoptive', sourceId: '1', targetId: '2' },
      { relationship: 'mate', sourceId: '2', targetId: '1' },
    ]);
  });
});