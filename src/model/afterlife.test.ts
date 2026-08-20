import { describe, expect, it } from 'vitest';
import { afterlifeStateForCat, isDeadCat } from './afterlife';

describe('afterlife classification', () => {
  it('classifies StarClan backstories using LifeGen categories', () => {
    expect(afterlifeStateForCat({ backstory: 'dead1', dead: true })).toBe('starclan');
    expect(afterlifeStateForCat({ backstory: 'newscguide2', dead: true })).toBe('starclan');
    expect(afterlifeStateForCat({ backstory: 'oldstarclan2', dead: true })).toBe('starclan');
  });

  it('classifies Dark Forest backstories using LifeGen categories', () => {
    expect(afterlifeStateForCat({ backstory: 'dead2', dead: true })).toBe('dark_forest');
    expect(afterlifeStateForCat({ backstory: 'newdfguide2', dead: true })).toBe('dark_forest');
    expect(afterlifeStateForCat({ backstory: 'dfkit1', dead: true })).toBe('dark_forest');
  });

  it('prefers save group history for legacy StarClan cats like Twigheart and Heatherpaw', () => {
    expect(afterlifeStateForCat({
      backstory: 'clan_guide3',
      status: { group_history: [{ group: '2', rank: 'elder', moons_as: 102 }] },
    })).toBe('starclan');

    expect(afterlifeStateForCat({
      backstory: 'dead7',
      status: { group_history: [{ group: '2', rank: 'apprentice', moons_as: 116 }] },
    })).toBe('starclan');
  });

  it('prefers the latest group history entry when a cat moved to the Dark Forest', () => {
    expect(afterlifeStateForCat({
      backstory: 'dead5',
      status: {
        group_history: [
          { group: '1', rank: 'warrior', moons_as: 24 },
          { group: '2', rank: 'warrior', moons_as: 40 },
          { group: '4', rank: 'warrior', moons_as: 0 },
        ],
      },
    })).toBe('dark_forest');
  });

  it('prefers save flags for unknown residence and dark forest placement', () => {
    expect(afterlifeStateForCat({ backstory: 'dead1', dead: true, outside: true })).toBe('unknown_residence');
    expect(afterlifeStateForCat({ backstory: 'dead1', dead: true, df: true })).toBe('dark_forest');
  });

  it('detects dead cats regardless of the backstory list', () => {
    expect(isDeadCat({ dead: true, backstory: 'newdfguide4' })).toBe(true);
    expect(isDeadCat({ dead: false, backstory: 'dead1' })).toBe(true);
    expect(isDeadCat({ dead: false, backstory: 'unknown' })).toBe(false);
  });
});
