import { describe, expect, it } from 'vitest';
import { CatDocument } from '../model/catDocument';
import { createRandomWebCat, mergeWebImportedCats, parseWebCatDocument, serializeWebCatDocument } from './webFileAccess';
import { createWebResourceCatalog } from './resourceCatalog';

describe('web Clan Cats file access', () => {
  it('parses a clan cats array and preserves its source name', () => {
    expect(parseWebCatDocument('[{"ID":"1"}]', 'input.json')).toEqual({
      fileName: 'input.json',
      contents: '[{"ID":"1"}]',
    });
  });

  it('exports only fields supported by the web editor', () => {
    const document = CatDocument.load([{
      ID: '1',
      name_prefix: 'Fire',
      pelt_name: 'SingleColour',
      eye_colour: 'YELLOW',
      gender: 'female',
      moons: 18,
      trait: 'patient',
      parent1: '2',
      relationships: { mate: ['2'] },
      skill_dict: { scout: 10 },
    }]);

    expect(JSON.parse(serializeWebCatDocument(document))).toEqual([{
      name_prefix: 'Fire',
      pelt_name: 'SingleColour',
      eye_colour: 'YELLOW',
    }]);
  });

  it('preserves ignored fields from the current document during import', () => {
    const imported = mergeWebImportedCats(
      [{ ID: '1', gender: 'male', moons: 18, trait: 'patient', facets: '1,2,3,4', status: { rank: 'leader' } }],
      [{ name_prefix: 'New', gender: 'female', moons: 2, trait: 'bold', facets: '0,0,0,0', status: {} }],
    );

    expect(imported[0]).toMatchObject({
      ID: '1',
      name_prefix: 'New',
      gender: 'male',
      moons: 18,
      trait: 'patient',
      facets: '1,2,3,4',
      status: { rank: 'leader' },
    });
  });

  it('round-trips the Copy JSON format through web import', () => {
    const source = CatDocument.load([{
      ID: '7',
      name_prefix: 'Bright',
      name_suffix: 'heart',
      pelt_name: 'Tabby',
      pelt_color: 'GINGER',
      gender: 'female',
      moons: 18,
      unsupported_extra: true,
    }]);
    const copiedCats = JSON.parse(serializeWebCatDocument(source)) as Record<string, unknown>[];
    const importedCats = mergeWebImportedCats(
      [{ ID: '42', gender: 'male', moons: 30 }],
      copiedCats,
    );

    expect(importedCats).toEqual([{
      ID: '42',
      gender: 'male',
      moons: 30,
      name_prefix: 'Bright',
      name_suffix: 'heart',
      pelt_name: 'Tabby',
      pelt_color: 'GINGER',
    }]);
  });

  it('rejects data that is not a cat array', () => {
    expect(() => parseWebCatDocument('{"ID":"1"}')).toThrow('clan_cats.json must contain a JSON array');
  });

  it('loads bundled ClanGen names into the web resource catalog', () => {
    const catalog = createWebResourceCatalog();

    expect(catalog.loadedFiles).toContain('dicts/names/names.json');
    expect(catalog.options.name_prefix.length).toBeGreaterThan(0);
    expect(catalog.groups.name_suffix.Normal.length).toBeGreaterThan(0);
    expect(catalog.options.sprite_newborn.length).toBeGreaterThan(0);
    expect(catalog.options.sprite_kitten.length).toBeGreaterThan(0);
    expect(catalog.options.sprite_adolescent.length).toBeGreaterThan(0);
    expect(catalog.options.sprite_adult.length).toBeGreaterThan(0);
    expect(catalog.options.sprite_senior.length).toBeGreaterThan(0);
    expect(catalog.options.sprite_para_adult.length).toBeGreaterThan(0);
    expect(catalog.options.pelt_name.length).toBeGreaterThan(0);
    expect(catalog.options.pelt_color.length).toBeGreaterThan(0);
    expect(catalog.options.pelt_length.length).toBeGreaterThan(0);
    expect(catalog.options.eye_colour.length).toBeGreaterThan(0);
    expect(catalog.options.accessory.length).toBeGreaterThan(0);
    expect(catalog.options.scars.length).toBeGreaterThan(0);
    expect(catalog.options.white_patches.length).toBeGreaterThan(0);
    expect(catalog.options.tint.length).toBeGreaterThan(0);
  });

  it('generates a valid pose for every web life stage', () => {
    const cat = createRandomWebCat();

    expect(cat.name_suffix).toEqual(expect.any(String));
    expect(String(cat.name_suffix).length).toBeGreaterThan(0);
    expect(cat.sprite_newborn).toMatch(/^newborn[0-2]$/);
    expect(cat.sprite_kitten).toMatch(/^kitten[0-2]$/);
    expect(cat.sprite_adolescent).toMatch(/^adolescent_(short|long)[0-2]$/);
    expect(cat.sprite_adult).toMatch(/^adult_(short|long)[0-2]$/);
    expect(cat.sprite_senior).toMatch(/^senior[0-2]$/);
    expect(cat.sprite_para_adult).toMatch(/^para_adult_(short|long)0$/);
  });
});
