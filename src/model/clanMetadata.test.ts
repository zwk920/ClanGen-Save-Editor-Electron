import { describe, expect, it } from 'vitest';
import { reconcileClanMetadata } from './clanMetadata';

describe('reconcileClanMetadata', () => {
  it('removes deleted ClanGen role references while preserving unknown metadata', () => {
    const result = reconcileClanMetadata({
      leader: '1',
      deputy: '99',
      med_cat: '2',
      used_group_IDs: { 1: 'player_clan' },
      custom_field: 'untouched',
    }, ['1', '2']);

    expect(result.metadata).toMatchObject({
      leader: '1',
      deputy: null,
      med_cat: '2',
      used_group_IDs: { 1: 'player_clan' },
      custom_field: 'untouched',
    });
    expect(result.changedFields).toEqual(['deputy']);
  });

  it('cleans LifeGen cat-reference fields without touching unrelated groups', () => {
    const result = reconcileClanMetadata({
      instructor: '1',
      demon: '99',
      your_cat: '3',
      focus_cat: '98',
      mediated: ['1', '97'],
      just_died: ['3', '96'],
      dead_cats_to_grieve: ['95'],
      patrolled_cats: ['1', '94'],
      grief_to_assign: { 1: { grief: 1 }, 93: { grief: 2 } },
      used_group_IDs: { 5: 'rogue_group' },
    }, ['1', '3']);

    expect(result.metadata).toMatchObject({
      instructor: '1',
      demon: null,
      your_cat: '3',
      focus_cat: null,
      mediated: ['1'],
      just_died: ['3'],
      dead_cats_to_grieve: [],
      patrolled_cats: ['1'],
      grief_to_assign: { 1: { grief: 1 } },
      used_group_IDs: { 5: 'rogue_group' },
    });
  });
});