export const FACET_NAMES = ['lawfulness', 'sociability', 'aggression', 'stability'] as const;

export type FacetName = (typeof FACET_NAMES)[number];

export type Cat = Record<string, any>;

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  cat_id?: string | null;
  field?: string | null;
}

export type TraitRanges = Record<string, Record<FacetName, [number, number]>>;

export function loadTraitRanges(data: unknown): TraitRanges {
  if (!data || typeof data !== 'object') return {} as TraitRanges;

  const source = data as Record<string, any>;
  const ranges: TraitRanges = {} as TraitRanges;

  for (const group of Object.values(source)) {
    if (!group || typeof group !== 'object') continue;
    for (const [trait, values] of Object.entries(group as Record<string, any>)) {
      if (!values || typeof values !== 'object') continue;
      const parsed: Partial<Record<FacetName, [number, number]>> = {};

      for (const facetName of FACET_NAMES) {
        const bounds = values[facetName];
        if (Array.isArray(bounds) && bounds.length === 2 && bounds.every((value) => Number.isInteger(value))) {
          parsed[facetName] = [Number(bounds[0]), Number(bounds[1])];
        }
      }

      if (Object.keys(parsed).length === FACET_NAMES.length) {
        ranges[String(trait)] = parsed as Record<FacetName, [number, number]>;
      }
    }
  }

  return ranges;
}

export class CatDocument {
  public cats: Cat[] = [];
  public sourcePath: string | null = null;
  public dirty = false;

  static load(data: unknown, sourcePath: string | null = null): CatDocument {
    if (!Array.isArray(data) || !data.every((cat) => cat && typeof cat === 'object')) {
      throw new Error('clan_cats.json must contain a JSON array of cat objects');
    }

    const document = new CatDocument();
    document.cats = structuredClone(data);
    document.sourcePath = sourcePath;
    return document;
  }

  getCat(catId: string | number): Cat | undefined {
    return this.cats.find((cat) => String(cat?.ID ?? '') === String(catId));
  }

  cloneCat(catId: string | number): Cat {
    const original = this.getCat(catId);
    if (!original) throw new Error(`Missing cat ${catId}`);
    const duplicate = structuredClone(original);
    duplicate.ID = this.nextId();
    duplicate.name_prefix = `${duplicate.name_prefix ?? 'New'}`;
    this.cats.push(duplicate);
    this.dirty = true;
    return duplicate;
  }

  addCat(cat: Cat): Cat {
    const added = structuredClone(cat);
    added.ID = this.nextId();
    this.cats.push(added);
    this.dirty = true;
    return added;
  }

  nextId(): string {
    const numericIds = this.cats
      .map((cat) => String(cat?.ID ?? ''))
      .filter((value) => /^\d+$/.test(value))
      .map((value) => Number(value));
    return String(Math.max(...numericIds, 0) + 1);
  }

  deleteCat(catId: string | number): void {
    this.cats = this.cats.filter((cat) => String(cat?.ID ?? '') !== String(catId));

    for (const cat of this.cats) {
      for (const key of ['parent1', 'parent2', 'mentor']) {
        if (String(cat[key] ?? '') === String(catId)) {
          cat[key] = null;
        }
      }

      for (const key of ['adoptive_parents', 'former_mentor', 'mate', 'previous_mates', 'current_apprentice', 'former_apprentices']) {
        const value = cat[key];
        if (Array.isArray(value)) {
          cat[key] = value.filter((entry) => String(entry) !== String(catId));
        }
      }
    }

    this.dirty = true;
  }

  deleteCats(catIds: Array<string | number>): void {
    for (const catId of catIds) this.deleteCat(catId);
  }

  updateCat(catId: string | number, value: Cat): void {
    const index = this.cats.findIndex((cat) => String(cat?.ID ?? '') === String(catId));
    if (index < 0) throw new Error(`Missing cat ${catId}`);
    this.cats[index] = structuredClone(value);
    this.dirty = true;
  }

  updateTraits(catId: string | number, trait: string, facets: number[]): void {
    if (facets.length !== FACET_NAMES.length || facets.some((value) => !Number.isInteger(value))) {
      throw new Error('Traits require four integer facet values.');
    }

    const cat = this.getCat(catId);
    if (!cat) throw new Error(`Missing cat ${catId}`);
    cat.trait = trait;
    cat.facets = facets.join(',');
    this.dirty = true;
  }
}

export function validateDocument(
  document: CatDocument,
  traitRanges: TraitRanges | null = null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ranges = traitRanges ?? {};
  const ids = new Set<string>();
  const knownIds = new Set(document.cats.map((cat) => String(cat?.ID ?? '')));
  const relationshipKeys = ['parent1', 'parent2', 'mentor'];
  const listRelationshipKeys = [
    'adoptive_parents',
    'former_mentor',
    'mate',
    'previous_mates',
    'current_apprentice',
    'former_apprentices',
  ];

  for (const cat of document.cats) {
    const catId = String(cat?.ID ?? '');

    if (!catId) {
      issues.push({ severity: 'error', message: 'Every cat needs an ID.', cat_id: catId, field: 'ID' });
    } else if (!/^\d+$/.test(catId)) {
      issues.push({ severity: 'error', message: 'ID must contain only digits.', cat_id: catId, field: 'ID' });
    } else if (ids.has(catId)) {
      issues.push({ severity: 'error', message: 'Cat IDs must be unique.', cat_id: catId, field: 'ID' });
    }
    ids.add(catId);

    if (!String(cat?.name_prefix ?? '').trim()) {
      issues.push({ severity: 'error', message: 'Name prefix cannot be empty.', cat_id: catId, field: 'name_prefix' });
    }

    const facetsValue = String(cat?.facets ?? '');
    const parts = facetsValue.split(',');
    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part.trim()) || !(Number(part) >= 0 && Number(part) <= 16))) {
      issues.push({ severity: 'error', message: 'Facets must be four comma-separated numbers from 0 to 16.', cat_id: catId, field: 'facets' });
    } else if (cat?.trait && cat.trait in ranges) {
      const traitRange = ranges[String(cat.trait)];
      for (const [facetIndex, facetName] of FACET_NAMES.entries()) {
        const value = Number(parts[facetIndex]);
        const [minimum, maximum] = traitRange[facetName];
        if (maximum === 15 && value === 16) continue;
        if (minimum > value || value > maximum) {
          issues.push({ severity: 'warning', message: `${toTitleCase(facetName)} is ${value}, outside the current ${cat.trait} range of ${minimum}-${maximum}. This may be a value from an earlier resource version.`, cat_id: catId, field: 'facets' });
        }
      }
    } else if (cat?.trait) {
      issues.push({ severity: 'warning', message: `Trait ${cat.trait} is not present in the installed trait definitions.`, cat_id: catId, field: 'trait' });
    }

    const experience = cat?.experience;
    if (!Number.isInteger(experience) || experience < 0 || experience > 321) {
      issues.push({ severity: 'error', message: 'Experience must be an integer from 0 to 321.', cat_id: catId, field: 'experience' });
    }

    for (const key of relationshipKeys) {
      const value = cat?.[key];
      if (value !== null && value !== undefined && value !== '') {
        const id = String(value);
        if (!knownIds.has(id)) {
          issues.push({ severity: 'warning', message: `${key} references missing cat ${value}.`, cat_id: catId, field: key });
        }
        if (id === catId) {
          issues.push({ severity: 'error', message: `${key} cannot reference the same cat.`, cat_id: catId, field: key });
        }
      }
    }

    for (const key of listRelationshipKeys) {
      const value = cat?.[key];
      if (value !== null && value !== undefined && !Array.isArray(value)) {
        issues.push({ severity: 'error', message: `${key} must be a list or null.`, cat_id: catId, field: key });
        continue;
      }

      for (const reference of value ?? []) {
        if (!knownIds.has(String(reference))) {
          issues.push({ severity: 'warning', message: `${key} references missing cat ${reference}.`, cat_id: catId, field: key });
        }
      }
    }
  }

  for (const cat of document.cats) {
    const catId = String(cat?.ID ?? '');
    const mentor = cat?.mentor;
    if (mentor) {
      const mentorCat = document.getCat(String(mentor));
      const apprentices = mentorCat?.current_apprentice ?? [];
      const apprenticeIds = (Array.isArray(apprentices) ? apprentices : []).map((value) => String(value));
      if (!apprenticeIds.includes(catId)) {
        issues.push({ severity: 'warning', message: 'Mentor link is not reciprocal.', cat_id: catId, field: 'mentor' });
      }
    }

    const mates = Array.isArray(cat?.mate) ? cat.mate : [];
    for (const mateId of mates) {
      const mateCat = document.getCat(String(mateId));
      const mateList = Array.isArray(mateCat?.mate) ? mateCat.mate : [];
      if (mateCat && !mateList.map((value) => String(value)).includes(catId)) {
        issues.push({ severity: 'warning', message: 'Mate link is not reciprocal.', cat_id: catId, field: 'mate' });
      }
    }
  }

  return issues;
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
