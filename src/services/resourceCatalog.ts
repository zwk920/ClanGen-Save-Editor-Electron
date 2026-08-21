import whitePatchesLittleData from '../components/catRenderer/assets/data/white_patches_little_sprite_data.json';
import whitePatchesMidData from '../components/catRenderer/assets/data/white_patches_mid_sprite_data.json';
import whitePatchesMostlyData from '../components/catRenderer/assets/data/white_patches_mostly_sprite_data.json';
import whitePatchesHighData from '../components/catRenderer/assets/data/white_patches_high_sprite_data.json';
import spriteIndex from '../components/catRenderer/assets/spritesIndex.json';
import bundledNames from '../components/catRenderer/assets/resources/names.json';
import poseSpriteData from '../components/catRenderer/assets/pose_sprite_data.json';
import bundledPelts from '../components/catRenderer/assets/resources/pelts.en.json';
import bundledEyes from '../components/catRenderer/assets/resources/eyes.en.json';
import bundledAccessories from '../components/catRenderer/assets/resources/accessories.en.json';
import peltInfo from '../components/catRenderer/assets/peltInfo.json';

export type ResourceOptions = Record<string, string[]>;
export type ResourceGroups = Record<string, Record<string, string[]>>;
export type TraitRanges = Record<string, Record<string, [number, number]>>;
export type ConditionDefinitions = Record<string, Record<string, Record<string, unknown>>>;

const TORTIE_COAT_SPRITES = ['single', 'tabby', 'marbled', 'rosette', 'smoke', 'ticked', 'speckled', 'bengal', 'mackerel', 'classic', 'sokoke', 'agouti', 'singlestripe', 'masked'];
const SPRITE_KEYS = Object.keys(spriteIndex);
const TORTIE_MARKINGS = SPRITE_KEYS.filter((key) => key.startsWith('patches_tortie')).map((key) => key.replace('patches_tortie', '')).sort();
const TORTIE_COLOURS = SPRITE_KEYS.filter((key) => key.startsWith('colours_single')).map((key) => key.replace('colours_single', '')).sort();
const SKIN_COLOURS = SPRITE_KEYS.filter((key) => key.startsWith('skin')).map((key) => key.replace('skin', '')).sort();

export interface ResourceCatalog {
  options: ResourceOptions;
  groups: ResourceGroups;
  traitRanges: TraitRanges;
  conditionDefinitions?: ConditionDefinitions;
  warnings: string[];
  loadedFiles: string[];
}

export function createWebResourceCatalog(): ResourceCatalog {
  const data = bundledNames as Record<string, any>;
  const normalPrefixes = uniqueStrings(data.normal_prefixes ?? []);
  const normalSuffixes = uniqueStrings(data.normal_suffixes ?? []);
  const poses = poseSpriteData.poses as string[];
  const posesFor = (prefix: string) => poses.filter((pose) => pose.startsWith(prefix));
  const peltEntries = (bundledPelts as Record<string, any>).en as Record<string, any>;
  const peltKeys = Object.keys(peltEntries);
  const peltNames = peltKeys
    .filter((key) => key !== 'vitiligo' && !key.endsWith('_long') && peltKeys.includes(`${key}_long`))
    .filter((name) => !['Tortie_tabby', 'Calico_tabby'].includes(name) && name.toLowerCase() !== 'mottled');
  const peltColors = peltKeys.filter((key) => {
    const value = peltEntries[key];
    return value && typeof value === 'object' && 'one' in value && 'many' in value && !peltKeys.includes(`${key}_long`);
  });
  const eyeColors = Object.keys((bundledEyes as Record<string, any>).en ?? {});
  const accessoryNames = Object.keys((bundledAccessories as Record<string, any>).en ?? {}).filter((key) => key !== 'INFO');
  const scars = uniqueStrings([
    ...peltInfo.scars1,
    ...peltInfo.scars2,
    ...peltInfo.scars3,
  ]);
  return {
    options: {
      gender: ['female', 'male'],
      gender_align: ['female', 'male', 'nonbinary', 'trans female', 'trans male'],
      name_prefix: normalPrefixes,
      name_suffix: normalSuffixes,
      sprite_newborn: posesFor('newborn'),
      sprite_kitten: posesFor('kitten'),
      sprite_adolescent: posesFor('adolescent_'),
      sprite_adult: posesFor('adult_'),
      sprite_senior: posesFor('senior'),
      sprite_para_adult: posesFor('para_adult_'),
      pelt_name: peltNames,
      pelt_color: peltColors,
      pelt_length: peltKeys.filter((key) => key.startsWith('fur_')).map((key) => key.replace('fur_', '')),
      eye_colour: eyeColors,
      eye_colour2: [...eyeColors],
      accessory: accessoryNames,
      scars,
      white_patches_tint: ['darkcream', 'cream', 'offwhite', 'gray', 'pink'],
      white_patches: uniqueStrings([
        ...whitePatchesLittleData.sprite_list.flat(),
        ...whitePatchesMidData.sprite_list.flat(),
        ...whitePatchesMostlyData.sprite_list.flat(),
        ...whitePatchesHighData.sprite_list.flat(),
      ]).sort(),
      points: ['COLOURPOINT', 'MINKPOINT', 'SEPIAPOINT'],
      vitiligo: ['MOON', 'PHANTOM', 'POWDER', 'BLEACHED', 'VITILIGO', 'VITILIGOTWO', 'KARPATI', 'SMOKEY'],
      tortie_marking: TORTIE_MARKINGS,
      tortie_base: TORTIE_COAT_SPRITES,
      tortie_color: uniqueStrings(TORTIE_COLOURS.map((colour) => colour.replace(/^stripe/, ''))),
      tortie_pattern: TORTIE_COAT_SPRITES,
      tint: ['none', 'pink', 'gray', 'red', 'black', 'orange', 'yellow', 'purple', 'blue', 'dilute', 'warmdilute', 'cooldilute'],
      skin: SKIN_COLOURS,
    },
    groups: {
      name_prefix: {
        Normal: normalPrefixes,
        ...Object.fromEntries(Object.entries(data.colour_prefixes ?? {}).map(([name, values]) => [`Color: ${name}`, uniqueStrings(values as any)])),
        ...Object.fromEntries(Object.entries(data.biome_prefixes ?? {}).map(([name, values]) => [`Biome: ${name}`, uniqueStrings(values as any)])),
      },
      name_suffix: {
        Normal: normalSuffixes,
        ...Object.fromEntries(Object.entries(data.pelt_suffixes ?? {}).map(([name, values]) => [`Pelt: ${name}`, uniqueStrings(values as any)])),
        ...Object.fromEntries(Object.entries(data.tortie_pelt_suffixes ?? {}).map(([name, values]) => [`Tortie pelt: ${name}`, uniqueStrings(values as any)])),
      },
    },
    traitRanges: {},
    warnings: [],
    loadedFiles: ['dicts/names/names.json'],
  };
}

const SPRITE_FIELDS = [
  'sprite_newborn',
  'sprite_kitten',
  'sprite_adolescent',
  'sprite_adult',
  'sprite_senior',
  'sprite_para_adult',
] as const;

export async function loadResourceCatalog(resourceDirPath: string): Promise<ResourceCatalog> {
  const catalog: ResourceCatalog = {
    options: {
      gender: ['female', 'male'],
      gender_align: ['female', 'male', 'nonbinary', 'trans female', 'trans male'],
    },
    groups: {},
    traitRanges: {},
    conditionDefinitions: {},
    warnings: [],
    loadedFiles: [],
  };

  const namesFile = await getJsonFileFromDir(resourceDirPath, 'dicts/names/names.json');
  if (namesFile && typeof namesFile === 'object') {
    const data = namesFile as Record<string, any>;
    catalog.options.name_prefix = uniqueStrings(data.normal_prefixes ?? []);
    catalog.options.name_suffix = uniqueStrings(data.normal_suffixes ?? []);
    catalog.groups.name_prefix = {
      Normal: uniqueStrings(data.normal_prefixes ?? []),
      ...Object.fromEntries(Object.entries(data.colour_prefixes ?? {}).map(([name, values]) => [`Color: ${name}`, uniqueStrings(values as any)])),
      ...Object.fromEntries(Object.entries(data.biome_prefixes ?? {}).map(([name, values]) => [`Biome: ${name}`, uniqueStrings(values as any)])),
    };
    catalog.groups.name_suffix = {
      Normal: uniqueStrings(data.normal_suffixes ?? []),
      ...Object.fromEntries(Object.entries(data.pelt_suffixes ?? {}).map(([name, values]) => [`Pelt: ${name}`, uniqueStrings(values as any)])),
      ...Object.fromEntries(Object.entries(data.tortie_pelt_suffixes ?? {}).map(([name, values]) => [`Tortie pelt: ${name}`, uniqueStrings(values as any)])),
    };
  }

  const backstories = await getJsonFileFromDir(resourceDirPath, 'dicts/backstories.json');
  if (backstories && typeof backstories === 'object') {
    const categories = (backstories as Record<string, any>).backstory_categories;
    if (categories && typeof categories === 'object') {
      catalog.groups.backstory = Object.fromEntries(
        Object.entries(categories).filter(([, values]) => Array.isArray(values)).map(([name, values]) => [String(name), uniqueStrings(values as any)]),
      );
      catalog.options.backstory = uniqueStrings(Object.values(catalog.groups.backstory).flatMap((values) => values));
    }
  }

  const pronouns = await getJsonFileFromDir(resourceDirPath, 'dicts/pronouns.json');
  if (pronouns && typeof pronouns === 'object') {
    const defaults = (pronouns as Record<string, any>).default_pronouns;
    if (Array.isArray(defaults)) {
      const labels = defaults
        .filter((entry) => entry && typeof entry === 'object' && entry.subject && entry.object)
        .map((entry) => `${entry.subject}/${entry.object}`);
      catalog.options.pronouns = uniqueStrings(labels);
    }
  }

  const generalLanguage = await getJsonFileFromDir(resourceDirPath, 'lang/en/general.en.json');
  if (generalLanguage && typeof generalLanguage === 'object') {
    const entries = (generalLanguage as Record<string, any>).en;
    if (entries && typeof entries === 'object') {
      const genderAlignments = ['female', 'male', 'trans female', 'trans male', 'nonbinary']
        .filter((value) => typeof entries[value] === 'string');
      if (genderAlignments.length > 0) catalog.options.gender_align = genderAlignments;
    }
  }

  const pelts = await getJsonFileFromDir(resourceDirPath, 'lang/en/cat/pelts.en.json');
  if (pelts && typeof pelts === 'object') {
    const entries = (pelts as Record<string, any>).en;
    if (entries && typeof entries === 'object') {
      const keys = Object.keys(entries);
      const peltNames = keys.filter((key) => key !== 'vitiligo' && !key.endsWith('_long') && keys.includes(`${key}_long`));
      const peltColors = keys.filter((key) => {
        const value = entries[key];
        return value && typeof value === 'object' && 'one' in value && 'many' in value && !keys.includes(`${key}_long`);
      });
      catalog.options.pelt_name = uniqueStrings(peltNames).filter((name) => !['Tortie_tabby', 'Calico_tabby'].includes(name) && name.toLowerCase() !== 'mottled');
      catalog.options.pelt_color = uniqueStrings(peltColors);
      catalog.options.pelt_length = uniqueStrings(keys.filter((key) => key.startsWith('fur_')).map((key) => key.replace('fur_', '')));
    }
  }

  const eyes = await getJsonFileFromDir(resourceDirPath, 'lang/en/cat/eyes.en.json');
  if (eyes && typeof eyes === 'object') {
    const entries = (eyes as Record<string, any>).en;
    if (entries && typeof entries === 'object') {
      const eyeColors = uniqueStrings(Object.keys(entries));
      catalog.options.eye_colour = eyeColors;
      catalog.options.eye_colour2 = [...eyeColors];
    }
  }

  const accessories = await getJsonFileFromDir(resourceDirPath, 'lang/en/cat/accessories.en.json');
  if (accessories && typeof accessories === 'object') {
    const entries = (accessories as Record<string, any>).en;
    if (entries && typeof entries === 'object') catalog.options.accessory = uniqueStrings(Object.keys(entries).filter((key) => key !== 'INFO'));
  }

  const herbInfo = await getJsonFileFromDir(resourceDirPath, 'dicts/herb_info.json');
  if (herbInfo && typeof herbInfo === 'object') {
    catalog.options.inventory = uniqueStrings(Object.keys(herbInfo as Record<string, unknown>));
  }

  const illnesses = await getJsonFileFromDir(resourceDirPath, 'dicts/conditions/illnesses.json');
  catalog.options.condition_illness = objectKeys(illnesses);
  catalog.conditionDefinitions!.illness = objectDefinitions(illnesses);
  const injuries = await getJsonFileFromDir(resourceDirPath, 'dicts/conditions/injuries.json');
  catalog.options.condition_injury = objectKeys(injuries);
  catalog.conditionDefinitions!.injury = objectDefinitions(injuries);
  const permanentConditions = await getJsonFileFromDir(resourceDirPath, 'dicts/conditions/permanent_conditions.json');
  catalog.options.condition_permanent = objectKeys(permanentConditions);
  catalog.conditionDefinitions!.permanent = objectDefinitions(permanentConditions);

  catalog.options.scars = await collectResourceArrayValues(resourceDirPath, ['dicts/events', 'lang/en/events', 'lang/en/patrols'], 'scars');

  catalog.options.white_patches_tint = ['darkcream', 'cream', 'offwhite', 'gray', 'pink'];
  catalog.options.white_patches = uniqueStrings([
    ...whitePatchesLittleData.sprite_list.flat(),
    ...whitePatchesMidData.sprite_list.flat(),
    ...whitePatchesMostlyData.sprite_list.flat(),
    ...whitePatchesHighData.sprite_list.flat(),
  ]).sort();
  catalog.options.points = ['COLOURPOINT', 'MINKPOINT', 'SEPIAPOINT'];
  catalog.options.vitiligo = ['MOON', 'PHANTOM', 'POWDER', 'BLEACHED', 'VITILIGO', 'VITILIGOTWO', 'KARPATI', 'SMOKEY'];
  catalog.options.tortie_marking = TORTIE_MARKINGS;
  catalog.options.tortie_base = TORTIE_COAT_SPRITES;
  catalog.options.tortie_color = uniqueStrings(TORTIE_COLOURS.map((colour) => colour.replace(/^stripe/, '')));
  catalog.options.tortie_pattern = TORTIE_COAT_SPRITES;
  catalog.options.tint = ['none', 'pink', 'gray', 'red', 'black', 'orange', 'yellow', 'purple', 'blue', 'dilute', 'warmdilute', 'cooldilute'];
  catalog.options.skin = SKIN_COLOURS;
  catalog.options.sprite_newborn = await imageStemOptions(resourceDirPath, 'images', /^newborn\d+\.png$/i);
  catalog.options.sprite_kitten = await imageStemOptions(resourceDirPath, 'images', /^kitten\d+\.png$/i);
  catalog.options.sprite_adolescent = await imageStemOptions(resourceDirPath, 'images', /^adolescent_[^/]+\.png$/i);
  catalog.options.sprite_adult = await imageStemOptions(resourceDirPath, 'images', /^adult_[^/]+\.png$/i);
  catalog.options.sprite_senior = await imageStemOptions(resourceDirPath, 'images', /^senior\d+\.png$/i);
  catalog.options.sprite_para_adult = await imageStemOptions(resourceDirPath, 'images', /^para_adult_[^/]+\.png$/i);

  const traitRangeData = await getJsonFileFromDir(resourceDirPath, 'dicts/traits/trait_ranges.json');
  if (traitRangeData && typeof traitRangeData === 'object') {
    catalog.traitRanges = loadTraitRangesFromJson(traitRangeData);
    if (Object.keys(catalog.traitRanges).length > 0) {
      catalog.options.trait = Object.keys(catalog.traitRanges).sort();
    }
  }

  return catalog;
}

export function mergeSpriteOptionsFromCats(catalog: ResourceCatalog, cats: Array<Record<string, unknown>>): ResourceCatalog {
  const options = { ...catalog.options };
  for (const field of SPRITE_FIELDS) {
    const values = cats.map((cat) => cat[field]).filter((value): value is string => typeof value === 'string');
    options[field] = uniqueStrings([...(options[field] ?? []), ...values]).sort();
  }
  return { ...catalog, options };
}

async function imageStemOptions(resourceDirPath: string, relativePath: string, pattern: RegExp): Promise<string[]> {
  try {
    const files = await window.electronFileSystem.listResourceFiles(resourceDirPath, relativePath);
    return files.filter((file) => pattern.test(file)).map((file) => file.replace(/\.png$/i, '')).sort();
  } catch {
    return [];
  }
}

async function collectResourceArrayValues(
  resourceDirPath: string,
  roots: string[],
  property: string,
): Promise<string[]> {
  const values: string[] = [];
  for (const root of roots) {
    try {
      await collectFromDirectory(resourceDirPath, root, property, values);
    } catch {
      // Optional resource trees vary between game builds.
    }
  }
  return uniqueStrings(values).sort();
}

async function collectFromDirectory(resourceDirPath: string, relativePath: string, property: string, values: string[]): Promise<void> {
  const files = await window.electronFileSystem.listResourceFiles(resourceDirPath, relativePath);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const text = await window.electronFileSystem.readResourceFile(resourceDirPath, `${relativePath}/${file}`);
      if (!text) continue;
      const data = JSON.parse(text);
      collectPropertyValues(data, property, values);
    } catch {
      // Ignore unrelated or malformed optional resource files.
    }
  }
}

function collectPropertyValues(value: unknown, property: string, values: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyValues(item, property, values);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === property && Array.isArray(child)) {
      for (const item of child) if (typeof item === 'string') values.push(item);
    }
    collectPropertyValues(child, property, values);
  }
}

async function getJsonFileFromDir(resourceDirPath: string, relativePath: string): Promise<unknown> {
  try {
    const text = await window.electronFileSystem.readResourceFile(resourceDirPath, relativePath);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values) {
    if (typeof value === 'string' && !result.includes(value)) result.push(value);
  }
  return result;
}

function objectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).filter((key) => !key.startsWith('_') && key !== 'comment').sort();
}

function objectDefinitions(value: unknown): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, definition]) => !key.startsWith('_') && key !== 'comment' && definition && typeof definition === 'object' && !Array.isArray(definition))
    .map(([key, definition]) => [key, structuredClone(definition) as Record<string, unknown>]));
}

function loadTraitRangesFromJson(data: unknown): TraitRanges {
  if (!data || typeof data !== 'object') return {};
  const result: TraitRanges = {};
  const source = data as Record<string, any>;

  for (const group of Object.values(source)) {
    if (!group || typeof group !== 'object') continue;
    for (const [trait, values] of Object.entries(group as Record<string, any>)) {
      if (!values || typeof values !== 'object') continue;
      const parsed: Record<string, [number, number]> = {};
      for (const facetName of ['lawfulness', 'sociability', 'aggression', 'stability']) {
        const bounds = values[facetName];
        if (Array.isArray(bounds) && bounds.length === 2 && bounds.every((entry) => Number.isInteger(entry))) {
          parsed[facetName] = [Number(bounds[0]), Number(bounds[1])];
        }
      }
      if (Object.keys(parsed).length === 4) {
        result[String(trait)] = parsed;
      }
    }
  }

  return result;
}

export function optionsForField(catalog: ResourceCatalog, field: string, current?: string): string[] {
  const values = [...(catalog.options[field] ?? [])]
    .map((value) => field === 'tortie_color' ? value.replace(/^stripe/, '') : value)
    .filter((value) => field !== 'pelt_name' || (!['Tortie_tabby', 'Calico_tabby'].includes(value) && value.toLowerCase() !== 'mottled'));
  const normalizedCurrent = field === 'tortie_color' ? current?.replace(/^stripe/, '') : current;
  if (normalizedCurrent && typeof normalizedCurrent === 'string' && normalizedCurrent.length > 0 && !values.includes(normalizedCurrent) && !(field === 'pelt_name' && (['Tortie_tabby', 'Calico_tabby'].includes(normalizedCurrent) || normalizedCurrent.toLowerCase() === 'mottled'))) values.unshift(normalizedCurrent);
  return values;
}

export function resourceCatalogSummary(catalog: ResourceCatalog): string {
  return `${catalog.loadedFiles.length} resource files loaded, ${Object.values(catalog.options).reduce((sum, values) => sum + values.length, 0)} options`;
}
