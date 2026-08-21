import { CatDocument, type Cat } from '../model/catDocument';
import bundledNames from '../components/catRenderer/assets/resources/names.json';
import poseSpriteData from '../components/catRenderer/assets/pose_sprite_data.json';

export interface WebFileReference {
  fileName: string;
  contents: string;
}

const randomChoice = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function createRandomWebCat(): Record<string, unknown> {
  const peltNames = ['SingleColour', 'TwoColour', 'Tabby', 'Marbled', 'Smoke', 'Ticked', 'Speckled'];
  const colours = ['BLACK', 'BLUE', 'BROWN', 'CREAM', 'GINGER', 'GREY', 'WHITE'];
  const lengths = ['short', 'medium', 'long'];
  const genders = ['female', 'male'];
  const traits = ['bold', 'careful', 'clever', 'insecure', 'loyal', 'patient', 'sociable'];
  const names = Array.isArray(bundledNames.normal_prefixes) && bundledNames.normal_prefixes.length > 0
    ? bundledNames.normal_prefixes
    : ['Ash', 'Briar', 'Cinder', 'Dawn', 'Fern', 'Moth', 'Raven', 'Thorn'];
  const suffixes = Array.isArray(bundledNames.normal_suffixes) && bundledNames.normal_suffixes.length > 0
    ? bundledNames.normal_suffixes
    : ['claw', 'heart', 'pelt', 'tail'];
  const poses = poseSpriteData.poses as string[];
  const poseFor = (prefix: string, fallback: string) => randomChoice(poses.filter((pose) => pose.startsWith(prefix))) ?? fallback;
  const peltName = randomChoice(peltNames);
  return {
    ID: '1',
    name_prefix: randomChoice(names),
    name_suffix: randomChoice(suffixes),
    gender: randomChoice(genders),
    gender_align: randomChoice(genders),
    moons: Math.floor(Math.random() * 100),
    trait: randomChoice(traits),
    facets: [0, 0, 0, 0].map(() => Math.floor(Math.random() * 17)).join(','),
    status: {},
    backstory: null,
    backstory_str: '',
    favourite: false,
    paralyzed: false,
    no_kits: false,
    no_mates: false,
    no_retire: false,
    experience: 0,
    pelt_name: peltName,
    pelt_color: randomChoice(colours),
    pelt_length: randomChoice(lengths),
    sprite_newborn: poseFor('newborn', 'newborn0'),
    sprite_kitten: poseFor('kitten', 'kitten0'),
    sprite_adolescent: poseFor('adolescent_', 'adolescent_short0'),
    sprite_adult: poseFor('adult_', 'adult_long0'),
    sprite_senior: poseFor('senior', 'senior0'),
    sprite_para_adult: poseFor('para_adult_', 'para_adult_short0'),
    reverse: Math.random() < 0.5,
    skin: 'BLACK',
    eye_colour: randomChoice(['YELLOW', 'GREEN', 'BLUE']),
    eye_colour2: null,
    tint: 'none',
    scars: [],
    accessory: [],
    tortie_marking: null,
    tortie_base: null,
    tortie_color: null,
    tortie_pattern: null,
    vitiligo: null,
    points: null,
    white_patches_tint: null,
    white_patches: null,
  };
}

const supportedCatFields = new Set([
  'name_prefix',
  'name_suffix',
  'tortie_enabled',
  'pelt_name',
  'pelt_color',
  'pelt_length',
  'sprite_newborn',
  'sprite_kitten',
  'sprite_adolescent',
  'sprite_adult',
  'sprite_senior',
  'sprite_para_adult',
  'reverse',
  'skin',
  'vitiligo',
  'points',
  'white_patches_tint',
  'tortie_marking',
  'tortie_base',
  'tortie_color',
  'tortie_pattern',
  'white_patches',
  'eye_colour',
  'eye_colour2',
  'tint',
  'scars',
  'accessory',
]);

const ignoredWebTransferFields = new Set([
  'ID',
  'gender',
  'gender_align',
  'moons',
  'trait',
  'facets',
  'status',
  'backstory',
  'backstory_str',
  'favourite',
  'paralyzed',
  'no_kits',
  'no_mates',
  'no_retire',
  'experience',
]);

export function parseWebCatDocument(contents: string, fileName = 'clan_cats.json'): WebFileReference {
  const data: unknown = JSON.parse(contents);
  CatDocument.load(data, fileName);
  return { fileName, contents };
}

export function serializeWebCatDocument(document: CatDocument): string {
  const cats = document.cats.map((cat) => Object.fromEntries(
    Object.entries(cat).filter(([field]) => supportedCatFields.has(field)),
  ));
  return JSON.stringify(cats, null, 2) + '\n';
}

export async function copyWebCatDocument(catDocument: CatDocument): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable. Use a secure browser context such as GitHub Pages or localhost.');
  }
  const exportedCats = catDocument.cats.map((cat) => Object.fromEntries(
    Object.entries(cat).filter(([field]) => field !== 'ID' && supportedCatFields.has(field)),
  ));
  await navigator.clipboard.writeText(JSON.stringify(exportedCats, null, 2) + '\n');
}

export function supportedCatFieldNames(): string[] {
  return [...supportedCatFields];
}

export function cloneSupportedCat(cat: Cat): Cat {
  return Object.fromEntries(
    Object.entries(cat).filter(([field]) => supportedCatFields.has(field)),
  );
}

export function mergeWebImportedCats(currentCats: Cat[], importedCats: Cat[]): Cat[] {
  return importedCats.map((cat, index) => {
    const current = currentCats[index];
    const preservedFields = current
      ? Object.fromEntries(Object.entries(current).filter(([field]) => ignoredWebTransferFields.has(field)))
      : {};
    const transferableFields = Object.fromEntries(
      Object.entries(cat).filter(([field]) => supportedCatFields.has(field) && !ignoredWebTransferFields.has(field)),
    );
    return { ...preservedFields, ...transferableFields };
  });
}