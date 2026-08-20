import { describe, expect, it } from 'vitest';
import { CatDocument, validateDocument } from './catDocument';

const cat = (ID: string, relationships: Record<string, unknown> = {}) => ({
  ID,
  name_prefix: `Cat ${ID}`,
  trait: '',
  facets: '0,0,0,0',
  experience: 0,
  parent1: null,
  parent2: null,
  mentor: null,
  df_mentor: null,
  adoptive_parents: [],
  former_mentor: [],
  mate: [],
  previous_mates: [],
  current_apprentice: [],
  former_apprentices: [],
  faded_offspring: [],
  df_apprentices: [],
  ...relationships,
});

describe('CatDocument references', () => {
  it('cleans LifeGen references when a cat is deleted', () => {
    const document = CatDocument.load([
      cat('1'),
      cat('2', { df_mentor: '1', df_apprentices: ['1'], faded_offspring: ['1'] }),
    ]);

    document.deleteCat('1');

    expect(document.getCat('2')).toMatchObject({
      df_mentor: null,
      df_apprentices: [],
      faded_offspring: [],
    });
  });

  it('reports dangling LifeGen references during validation', () => {
    const document = CatDocument.load([
      cat('1', { df_mentor: '99', df_apprentices: ['98'], faded_offspring: ['97'] }),
    ]);

    const issues = validateDocument(document);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'df_mentor', message: expect.stringContaining('missing cat 99') }),
      expect.objectContaining({ field: 'df_apprentices', message: expect.stringContaining('missing cat 98') }),
      expect.objectContaining({ field: 'faded_offspring', message: expect.stringContaining('missing cat 97') }),
    ]));
  });
});