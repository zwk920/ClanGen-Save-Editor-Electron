import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  AppBar,
  Box,
  Button,
  Checkbox,
  Drawer,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useEditorStore } from './store/editorStore';
import {
  BOOL_FIELDS,
  DICT_FIELDS,
  FIELD_GROUPS,
  FIELD_DESCRIPTIONS,
  FIELD_LABELS,
  INT_FIELDS,
  LIST_FIELDS,
  labelFor,
} from './model/schema';
import { optionsForField } from './services/resourceCatalog';
import { FACET_NAMES } from './model/catDocument';
import { CatPreview } from './components/CatPreview';

const tabLabels = ['Overview', 'Identity', 'Appearance', 'Relationships', 'Skills', 'Faith', 'JSON', 'Validation'];
const lifeStageSprites = [
  ['Newborn', 'sprite_newborn'],
  ['Kitten', 'sprite_kitten'],
  ['Adolescent', 'sprite_adolescent'],
  ['Adult', 'sprite_adult'],
  ['Senior', 'sprite_senior'],
  ['Paralyzed adult', 'sprite_para_adult'],
] as const;
const REQUIRED_APPEARANCE_SELECT_FIELDS = new Set([
  'pelt_name',
  'pelt_color',
  'eye_colour',
  'sprite_newborn',
  'sprite_kitten',
  'sprite_adolescent',
  'sprite_adult',
  'sprite_senior',
  'sprite_para_adult',
]);
const TORTIE_FIELDS = new Set(['tortie_marking', 'tortie_base', 'tortie_color', 'tortie_pattern']);
const TORTIE_SECTION_FIELDS = ['tortie_enabled', 'tortie_marking', 'tortie_base', 'tortie_color', 'tortie_pattern'];
const SPRITE_SECTION_FIELDS = ['sprite_newborn', 'sprite_kitten', 'sprite_adolescent', 'sprite_adult', 'sprite_senior', 'sprite_para_adult', 'reverse'];
const SKILL_NAMES = [
  'TEACHER', 'HUNTER', 'FIGHTER', 'RUNNER', 'CLIMBER', 'SWIMMER', 'SPEAKER', 'MEDIATOR', 'CLEVER', 'INSIGHTFUL', 'SENSE', 'KIT',
  'STORY', 'LORE', 'CAMP', 'HEALER', 'STAR', 'OMEN', 'DREAM', 'CLAIRVOYANT', 'PROPHET', 'GHOST', 'EXPLORER', 'TRACKER',
  'ARTISTAN', 'GUARDIAN', 'TUNNELER', 'NAVIGATOR', 'SONG', 'GRACE', 'CLEAN', 'INNOVATOR', 'COMFORTER', 'MATCHMAKER', 'THINKER',
  'COOPERATIVE', 'SCHOLAR', 'TIME', 'TREASURE', 'FISHER', 'LANGUAGE', 'SLEEPER',
];

const nameSectionDescriptions = {
  silly: 'Silly names include fandom references, scientific terms, memes, and fantasy/mythology names (ex: Hatsune Miku, Dipole, Meowyman, Charon).',
  human: 'Human names are names primarily given to humans or places (ex: Fred, Alice).',
  loner: 'Loner names include terms of endearment, common words, and human foods (ex: Baby, Abyss, Sushi).',
};

function FieldTooltip({ field, label, children, inline = false }: { field: string; label: string; children: ReactNode; inline?: boolean }) {
  const description = FIELD_DESCRIPTIONS[field] ?? `Edits the ${label.toLowerCase()} value for this cat.`;
  return (
    <Tooltip title={description} arrow enterDelay={300}>
      <span style={{ display: inline ? 'inline-flex' : 'block', width: inline ? undefined : '100%' }}>{children}</span>
    </Tooltip>
  );
}

interface NameCount {
  name: string;
  count: number;
}

function groupNameCounts(value: unknown): NameCount[] {
  if (!Array.isArray(value)) return [];
  const counts = new Map<string, number>();
  for (const entry of value) {
    if (typeof entry === 'string') counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

function expandNameCounts(entries: NameCount[]): string[] {
  return entries.flatMap(({ name, count }) => Array.from({ length: Math.max(0, count) }, () => name));
}

interface NormalNameListProps {
  title: string;
  entries: NameCount[];
  disabled: boolean;
  onChange: (entries: NameCount[]) => void;
}

function NormalNameList({ title, entries, disabled, onChange }: NormalNameListProps) {
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 48;
  const viewportHeight = 420;
  const filteredEntries = useMemo(
    () => entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())),
    [entries, query],
  );
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const endIndex = Math.min(filteredEntries.length, startIndex + Math.ceil(viewportHeight / rowHeight) + 6);
  const visibleEntries = filteredEntries.slice(startIndex, endIndex);

  return (
    <Accordion expanded disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>{title} ({entries.length} unique)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TextField
          fullWidth
          size="small"
          label={`Search ${title.toLowerCase()}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 2 }}
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Showing {visibleEntries.length} visible rows of {filteredEntries.length}. Search to find a specific name.
        </Typography>
        <Box onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} sx={{ height: viewportHeight, overflowY: 'auto', contain: 'strict' }}>
          <Box sx={{ height: filteredEntries.length * rowHeight, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: startIndex * rowHeight, left: 0, right: 0 }}>
              {visibleEntries.map((entry) => {
            const index = entries.indexOf(entry);
            return (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0} key={`${title}-${index}`} sx={{ height: rowHeight, py: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name"
                  value={entry.name}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = [...entries];
                    next[index] = { ...entry, name: event.target.value };
                    onChange(next);
                  }}
                />
                <TextField
                  size="small"
                  label="Prevalence"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={entry.count}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = [...entries];
                    next[index] = { ...entry, count: Math.max(0, Number.parseInt(event.target.value, 10) || 0) };
                    onChange(next);
                  }}
                  sx={{ width: { xs: '100%', sm: 150 } }}
                />
              </Stack>
            );
              })}
            </Box>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

interface NameCollectionEditorProps {
  title: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  entries: NameCount[];
  disabled: boolean;
  onSelect: (id: string) => void;
  onChange: (entries: NameCount[]) => void;
  onAdd: () => void;
}

function NameCollectionEditor({ title, options, selectedId, entries, disabled, onSelect, onChange, onAdd }: NameCollectionEditorProps) {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <FormControl size="small" fullWidth sx={{ mb: 1.5 }} disabled={disabled || options.length === 0}>
        <InputLabel>{title} section</InputLabel>
        <Select value={selectedId} label={`${title} section`} onChange={(event) => onSelect(String(event.target.value))}>
          {options.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
        </Select>
      </FormControl>
      {selectedId ? (
        <>
          <NormalNameList title={options.find((option) => option.id === selectedId)?.label ?? title} entries={entries} disabled={disabled} onChange={onChange} />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button size="small" onClick={onAdd} disabled={disabled}>Add name</Button>
          </Stack>
        </>
      ) : <Typography color="text.secondary">Load names.json to edit this section.</Typography>}
    </Box>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState('clan_cats');
  const [showRawNames, setShowRawNames] = useState(false);
  const [selectedPeltSuffixGroup, setSelectedPeltSuffixGroup] = useState('');
  const [selectedTortieSuffixGroup, setSelectedTortieSuffixGroup] = useState('');
  const [selectedNamesSection, setSelectedNamesSection] = useState('normal');
  const [selectedColorGroup, setSelectedColorGroup] = useState('');
  const [selectedBiomePrefixGroup, setSelectedBiomePrefixGroup] = useState('');
  const [selectedBiomeSuffixGroup, setSelectedBiomeSuffixGroup] = useState('');
  const [selectedEyeGroup, setSelectedEyeGroup] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [namesDraft, setNamesDraft] = useState<Record<string, any> | null>(null);
  const [namesDraftDirty, setNamesDraftDirty] = useState(false);
  const [clanCatsJsonDraft, setClanCatsJsonDraft] = useState('');
  const [clanCatsJsonError, setClanCatsJsonError] = useState<string | null>(null);
  const [previousPeltNames, setPreviousPeltNames] = useState<Record<string, string>>({});

  const document = useEditorStore((state) => state.document);
  const selectedCatId = useEditorStore((state) => state.selectedCatId);
  const selectedCat = useMemo(
    () => document?.getCat(selectedCatId ?? '') ?? document?.cats[0] ?? null,
    [document, selectedCatId],
  );
  const validationIssues = useEditorStore((state) => state.validationIssues);
  const status = useEditorStore((state) => state.status);
  const openingFile = useEditorStore((state) => state.openingFile);
  const resourceCatalog = useEditorStore((state) => state.resourceCatalog);
  const resourceDirPath = useEditorStore((state) => state.resourceDirPath);
  const namesJson = useEditorStore((state) => state.namesJson);
  const namesFileDirty = useEditorStore((state) => state.namesFileDirty);
  const clans = useEditorStore((state) => state.clans);
  const selectedClanPath = useEditorStore((state) => state.selectedClanPath);
  const discoverClans = useEditorStore((state) => state.discoverClans);
  const selectClan = useEditorStore((state) => state.selectClan);
  const openSaveFile = useEditorStore((state) => state.openSaveFile);
  const openResourceDir = useEditorStore((state) => state.openResourceDir);
  const saveDocument = useEditorStore((state) => state.saveDocument);
  const saveNamesFile = useEditorStore((state) => state.saveNamesFile);
  const setNamesJson = useEditorStore((state) => state.setNamesJson);
  const validate = useEditorStore((state) => state.validate);
  const addCat = useEditorStore((state) => state.addCat);
  const duplicateSelectedCat = useEditorStore((state) => state.duplicateSelectedCat);
  const deleteSelectedCat = useEditorStore((state) => state.deleteSelectedCat);
  const deleteCats = useEditorStore((state) => state.deleteCats);
  const setSelectedCatId = useEditorStore((state) => state.setSelectedCatId);
  const updateCat = useEditorStore((state) => state.updateCat);

  const catList = document?.cats ?? [];

  const parsedNamesFromStore = useMemo<Record<string, any> | null>(() => {
    if (!namesJson) return null;
    try {
      const parsed = JSON.parse(namesJson);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, [namesJson]);

  useEffect(() => {
    setNamesDraft(parsedNamesFromStore);
    setNamesDraftDirty(false);
  }, [parsedNamesFromStore]);

  useEffect(() => {
    if (tabIndex === 6) {
      setClanCatsJsonDraft(selectedCat ? JSON.stringify(selectedCat, null, 2) : '');
      setClanCatsJsonError(null);
    }
  }, [selectedCatId, tabIndex]);

  const parsedNames = namesDraft;
  const serializedNamesDraft = parsedNames ? JSON.stringify(parsedNames, null, 2) + '\n' : namesJson;
  const updateNamesDraft = (next: Record<string, any>) => {
    setNamesDraft(next);
    setNamesDraftDirty(true);
  };

  const specialSuffixes = parsedNames?.special_suffixes && typeof parsedNames.special_suffixes === 'object'
    ? parsedNames.special_suffixes as Record<string, string>
    : {};

  const updateSpecialSuffix = (role: string, value: string) => {
    const current = parsedNames ?? {};
    updateNamesDraft({
      ...current,
      special_suffixes: { ...specialSuffixes, [role]: value },
    });
  };

  const normalPrefixes = groupNameCounts(parsedNames?.normal_prefixes);
  const normalSuffixes = groupNameCounts(parsedNames?.normal_suffixes);
  const animalPrefixes = groupNameCounts(parsedNames?.animal_prefixes);
  const animalSuffixes = groupNameCounts(parsedNames?.animal_suffixes);
  const sillyNames = groupNameCounts(parsedNames?.silly_names);
  const humanNames = groupNameCounts(parsedNames?.human_names);
  const lonerNames = groupNameCounts(parsedNames?.loner_names);
  const clanPrefixes = groupNameCounts(parsedNames?.clan_prefixes);
  const peltSuffixGroups = parsedNames?.pelt_suffixes && typeof parsedNames.pelt_suffixes === 'object'
    ? parsedNames.pelt_suffixes as Record<string, unknown>
    : {};
  const peltSuffixGroupNames = Object.keys(peltSuffixGroups);
  const activePeltSuffixGroup = peltSuffixGroupNames.includes(selectedPeltSuffixGroup)
    ? selectedPeltSuffixGroup
    : peltSuffixGroupNames[0] ?? '';
  const activePeltSuffixes = groupNameCounts(peltSuffixGroups[activePeltSuffixGroup]);
  const tortieSuffixGroups = parsedNames?.tortie_pelt_suffixes && typeof parsedNames.tortie_pelt_suffixes === 'object'
    ? parsedNames.tortie_pelt_suffixes as Record<string, unknown>
    : {};
  const tortieSuffixGroupNames = Object.keys(tortieSuffixGroups);
  const activeTortieSuffixGroup = tortieSuffixGroupNames.includes(selectedTortieSuffixGroup)
    ? selectedTortieSuffixGroup
    : tortieSuffixGroupNames[0] ?? '';
  const activeTortieSuffixes = groupNameCounts(tortieSuffixGroups[activeTortieSuffixGroup]);
  const colorGroups = parsedNames?.colour_prefixes && typeof parsedNames.colour_prefixes === 'object'
    ? parsedNames.colour_prefixes as Record<string, unknown>
    : {};
  const colorGroupNames = Object.keys(colorGroups);
  const activeColorGroup = colorGroupNames.includes(selectedColorGroup) ? selectedColorGroup : colorGroupNames[0] ?? '';
  const activeColorNames = groupNameCounts(colorGroups[activeColorGroup]);
  const biomePrefixGroups = parsedNames?.biome_prefixes && typeof parsedNames.biome_prefixes === 'object'
    ? parsedNames.biome_prefixes as Record<string, unknown>
    : {};
  const biomeSuffixGroups = parsedNames?.biome_suffixes && typeof parsedNames.biome_suffixes === 'object'
    ? parsedNames.biome_suffixes as Record<string, unknown>
    : {};
  const biomePrefixGroupNames = Object.keys(biomePrefixGroups);
  const biomeSuffixGroupNames = Object.keys(biomeSuffixGroups);
  const activeBiomePrefixGroup = biomePrefixGroupNames.includes(selectedBiomePrefixGroup) ? selectedBiomePrefixGroup : biomePrefixGroupNames[0] ?? '';
  const activeBiomeSuffixGroup = biomeSuffixGroupNames.includes(selectedBiomeSuffixGroup) ? selectedBiomeSuffixGroup : biomeSuffixGroupNames[0] ?? '';
  const activeBiomePrefixes = groupNameCounts(biomePrefixGroups[activeBiomePrefixGroup]);
  const activeBiomeSuffixes = groupNameCounts(biomeSuffixGroups[activeBiomeSuffixGroup]);
  const eyeGroups = parsedNames?.eye_prefixes && typeof parsedNames.eye_prefixes === 'object'
    ? parsedNames.eye_prefixes as Record<string, unknown>
    : {};
  const eyeGroupNames = Object.keys(eyeGroups);
  const activeEyeGroup = eyeGroupNames.includes(selectedEyeGroup) ? selectedEyeGroup : eyeGroupNames[0] ?? '';
  const activeEyeNames = groupNameCounts(eyeGroups[activeEyeGroup]);

  const updateNormalNames = (field: 'normal_prefixes' | 'normal_suffixes', entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({ ...current, [field]: expandNameCounts(entries) });
  };

  const updateClanPrefixes = (entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({ ...current, clan_prefixes: expandNameCounts(entries) });
  };

  const updateAnimalNames = (field: 'animal_prefixes' | 'animal_suffixes', entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({ ...current, [field]: expandNameCounts(entries) });
  };

  const updateFlatNameSection = (field: 'silly_names' | 'human_names' | 'loner_names', entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({ ...current, [field]: expandNameCounts(entries) });
  };

  const updatePeltSuffixes = (entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({
      ...current,
      pelt_suffixes: {
        ...(current.pelt_suffixes ?? {}),
        [activePeltSuffixGroup]: expandNameCounts(entries),
      },
    });
  };

  const updateTortieSuffixes = (entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({
      ...current,
      tortie_pelt_suffixes: {
        ...(current.tortie_pelt_suffixes ?? {}),
        [activeTortieSuffixGroup]: expandNameCounts(entries),
      },
    });
  };

  const updateGroupedNames = (field: string, group: string, entries: NameCount[]) => {
    const current = parsedNames ?? {};
    updateNamesDraft({
      ...current,
      [field]: { ...(current[field] ?? {}), [group]: expandNameCounts(entries) },
    });
  };

  useEffect(() => {
    void discoverClans();
  }, [discoverClans]);

  const handleFieldChange = (field: string, value: any) => {
    if (!selectedCatId) return;
    if (value === '' && ['parent1', 'parent2', 'mentor', 'eye_colour2', 'white_patches', 'vitiligo', 'points', 'white_patches_tint', 'tortie_marking', 'tortie_base', 'tortie_color', 'tortie_pattern', 'df_mentor'].includes(field)) {
      value = null;
    }
    updateCat(selectedCatId, { [field]: value });
  };

  const handleTortieChange = (enabled: boolean) => {
    if (!selectedCatId) return;
    if (enabled) {
      const currentPeltName = String(selectedCat?.pelt_name ?? 'SingleColour');
      if (currentPeltName !== 'Tortie' && currentPeltName !== 'Calico') {
        setPreviousPeltNames((names) => ({ ...names, [selectedCatId]: currentPeltName }));
      }
      updateCat(selectedCatId, { pelt_name: 'Tortie' });
      return;
    }

    const fallbackPeltName = optionsForField(
      resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] },
      'pelt_name',
    ).find((name) => name !== 'Tortie' && name !== 'Calico') ?? 'SingleColour';
    const previousPeltName = previousPeltNames[selectedCatId];
    updateCat(selectedCatId, { pelt_name: previousPeltName && previousPeltName !== 'Tortie' && previousPeltName !== 'Calico' ? previousPeltName : fallbackPeltName });
  };

  const catIdOptionsForField = (field: string, current: unknown): string[] => {
    const candidateIds = (document?.cats ?? [])
      .map((cat) => String(cat?.ID ?? ''))
      .filter((id) => id && id !== String(selectedCatId ?? ''));
    const currentValues = Array.isArray(current) ? current.map(String) : current != null && current !== '' ? [String(current)] : [];
    const merged = [...currentValues, ...candidateIds.filter((id) => !currentValues.includes(id))];
    return merged.filter((id, index, values) => values.indexOf(id) === index);
  };

  const displayCatLabel = (catId: string): string => {
    const cat = document?.getCat(catId);
    const name = `${cat?.name_prefix ?? 'Unnamed'}${cat?.name_suffix ?? ''}`.trim() || 'Unnamed cat';
    return `${name} (${catId})`;
  };

  const selectedCatLabel = selectedCatId ? displayCatLabel(selectedCatId) : 'the selected cat';

  const handleTraitChange = (trait: string) => {
    if (!selectedCatId) return;
    const currentFacets = String(selectedCat?.facets ?? '')
      .split(',')
      .map((value) => Number(value.trim()));
    const ranges = resourceCatalog?.traitRanges?.[trait];
    const facets = FACET_NAMES.map((facetName, index) => {
      const currentValue = Number.isInteger(currentFacets[index]) ? currentFacets[index] : 0;
      const range = ranges?.[facetName];
      if (!range) return currentValue;
      return Math.min(range[1], Math.max(range[0], currentValue));
    });
    updateCat(selectedCatId, { trait, facets: facets.join(',') });
  };

  const randomChoice = <T,>(items: readonly T[]): T | undefined => {
    if (!items.length) return undefined;
    return items[Math.floor(Math.random() * items.length)];
  };

  const handleRandomizeAppearance = () => {
    if (!selectedCatId || !selectedCat) return;

    const emptyCatalog = { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] };
    const catalog = resourceCatalog ?? emptyCatalog;
    const pick = (field: string): string | undefined => {
      const choices = optionsForField(catalog, field, undefined).filter((value) => value && value !== '');
      return randomChoice(choices);
    };
    const pickNullable = (field: string): string | null => {
      const choices = optionsForField(catalog, field, undefined).filter((value) => value && value !== '');
      if (!choices.length || Math.random() < 0.35) return null;
      return randomChoice(choices) ?? null;
    };
    const pickList = (field: string): string[] => {
      const choices = optionsForField(catalog, field, undefined).filter((value) => value && value !== '');
      if (!choices.length) return [];
      const count = Math.min(choices.length, Math.floor(Math.random() * 3) + 1);
      const values = new Set<string>();
      while (values.size < count) {
        const value = randomChoice(choices);
        if (value) values.add(value);
      }
      return [...values];
    };

    const shouldUseTortie = Math.random() < 0.2;
    const nextPeltName = shouldUseTortie ? 'Tortie' : pick('pelt_name') ?? selectedCat.pelt_name ?? 'SingleColour';
    const isTortiePelt = nextPeltName === 'Tortie' || nextPeltName === 'Calico';
    const nextPatch: Record<string, any> = {
      pelt_name: nextPeltName,
      pelt_color: pick('pelt_color') ?? selectedCat.pelt_color ?? null,
      pelt_length: pick('pelt_length') ?? selectedCat.pelt_length ?? null,
      sprite_newborn: pick('sprite_newborn') ?? selectedCat.sprite_newborn ?? null,
      sprite_kitten: pick('sprite_kitten') ?? selectedCat.sprite_kitten ?? null,
      sprite_adolescent: pick('sprite_adolescent') ?? selectedCat.sprite_adolescent ?? null,
      sprite_adult: pick('sprite_adult') ?? selectedCat.sprite_adult ?? null,
      sprite_senior: pick('sprite_senior') ?? selectedCat.sprite_senior ?? null,
      sprite_para_adult: pick('sprite_para_adult') ?? selectedCat.sprite_para_adult ?? null,
      reverse: Math.random() < 0.5,
      skin: pick('skin') ?? selectedCat.skin ?? null,
      vitiligo: isTortiePelt ? null : pickNullable('vitiligo'),
      points: isTortiePelt ? null : pickNullable('points'),
      white_patches_tint: isTortiePelt ? null : pickNullable('white_patches_tint'),
      white_patches: isTortiePelt ? null : pickNullable('white_patches'),
      eye_colour: pick('eye_colour') ?? selectedCat.eye_colour ?? 'YELLOW',
      eye_colour2: Math.random() < 0.85 ? null : pick('eye_colour2') ?? null,
      tint: pick('tint') ?? selectedCat.tint ?? 'none',
      scars: pickList('scars'),
      accessory: pickList('accessory'),
    };

    if (isTortiePelt) {
      nextPatch.tortie_marking = pickNullable('tortie_marking');
      nextPatch.tortie_base = pickNullable('tortie_base');
      nextPatch.tortie_color = pickNullable('tortie_color');
      nextPatch.tortie_pattern = pickNullable('tortie_pattern');
    } else {
      nextPatch.tortie_marking = null;
      nextPatch.tortie_base = null;
      nextPatch.tortie_color = null;
      nextPatch.tortie_pattern = null;
    }

    updateCat(selectedCatId, { ...selectedCat, ...nextPatch });
  };

  const handleAddRandomCat = () => {
    if (!document) return;
    const template = selectedCat ?? document.cats[0] ?? {};
    const catalog = resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] };
    const pick = (field: string): string | undefined => randomChoice(optionsForField(catalog, field, undefined).filter(Boolean));
    const trait = pick('trait') ?? template.trait ?? 'balanced';
    const traitRange = catalog.traitRanges[trait];
    const facets = FACET_NAMES.map((facetName) => {
      const range = traitRange?.[facetName] ?? [0, 16];
      return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    });
    const shouldUseTortie = Math.random() < 0.2;
    const peltName = shouldUseTortie ? 'Tortie' : pick('pelt_name') ?? template.pelt_name ?? 'SingleColour';
    const isTortiePelt = peltName === 'Tortie' || peltName === 'Calico';
    const nextCat = {
      ...template,
      ID: undefined,
      name_prefix: pick('name_prefix') ?? 'New',
      name_suffix: pick('name_suffix') ?? '',
      gender: pick('gender') ?? 'female',
      gender_align: pick('gender_align') ?? 'female',
      moons: Math.floor(Math.random() * 100),
      trait,
      facets: facets.join(','),
      parent1: null,
      parent2: null,
      adoptive_parents: [],
      mate: [],
      previous_mates: [],
      faded_offspring: [],
      mentor: null,
      former_mentor: [],
      current_apprentice: [],
      former_apprentices: [],
      status: {},
      inventory: [],
      skill_dict: {},
      connected_dialogue: {},
      pelt_name: peltName,
      pelt_color: pick('pelt_color') ?? template.pelt_color ?? 'BLACK',
      pelt_length: pick('pelt_length') ?? template.pelt_length ?? 'short',
      sprite_newborn: pick('sprite_newborn') ?? template.sprite_newborn,
      sprite_kitten: pick('sprite_kitten') ?? template.sprite_kitten,
      sprite_adolescent: pick('sprite_adolescent') ?? template.sprite_adolescent,
      sprite_adult: pick('sprite_adult') ?? template.sprite_adult,
      sprite_senior: pick('sprite_senior') ?? template.sprite_senior,
      sprite_para_adult: pick('sprite_para_adult') ?? template.sprite_para_adult,
      reverse: Math.random() < 0.5,
      skin: pick('skin') ?? template.skin,
      eye_colour: pick('eye_colour') ?? template.eye_colour ?? 'YELLOW',
      eye_colour2: Math.random() < 0.15 ? pick('eye_colour2') ?? null : null,
      tint: pick('tint') ?? 'none',
      scars: [],
      accessory: [],
      tortie_marking: isTortiePelt ? pick('tortie_marking') ?? null : null,
      tortie_base: isTortiePelt ? pick('tortie_base') ?? null : null,
      tortie_color: isTortiePelt ? pick('tortie_color') ?? null : null,
      tortie_pattern: isTortiePelt ? pick('tortie_pattern') ?? null : null,
      vitiligo: isTortiePelt ? null : pick('vitiligo') ?? null,
      points: isTortiePelt ? null : pick('points') ?? null,
      white_patches_tint: isTortiePelt ? null : pick('white_patches_tint') ?? null,
      white_patches: isTortiePelt ? null : pick('white_patches') ?? null,
    };
    addCat(nextCat);
  };

  const renderFieldEditor = (field: string) => {
    const value = selectedCat?.[field];
    const label = FIELD_LABELS[field] ?? labelFor(field);
    const emptyCatalog = { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] };
    const options = optionsForField(resourceCatalog ?? emptyCatalog, field, typeof value === 'string' ? value : undefined);
    const hasTortiePelt = selectedCat?.pelt_name === 'Tortie' || selectedCat?.pelt_name === 'Calico';
    const disableField = TORTIE_FIELDS.has(field) && !hasTortiePelt;
    const withTooltip = (content: ReactNode, inline = false) => (
      <FieldTooltip field={field} label={label} inline={inline}>{content}</FieldTooltip>
    );

    if (field === 'tortie_enabled') {
      return withTooltip(
        <FormControlLabel
          key={field}
          control={<Checkbox checked={hasTortiePelt} onChange={(event) => handleTortieChange(event.target.checked)} />}
          label="Tortie/Calico"
        />, true,
      );
    }

    if (field === 'pelt_name' && hasTortiePelt) {
      return withTooltip(<TextField key={field} fullWidth label={label} value={selectedCat?.pelt_name ?? ''} disabled />);
    }

    if (field === 'skill_dict') {
      const skillDict = selectedCat?.skill_dict && typeof selectedCat.skill_dict === 'object' && !Array.isArray(selectedCat.skill_dict)
        ? selectedCat.skill_dict as Record<string, unknown>
        : {};
      const parseSkill = (raw: unknown) => {
        if (typeof raw !== 'string' || !raw) return { skill: '', tier: 0, interest: false };
        const [skill = '', tier = '0', interest = 'False'] = raw.split(',');
        return { skill, tier: Number(tier) || 0, interest: interest.toLowerCase() === 'true' };
      };
      const updateSkill = (slot: string, next: { skill: string; tier: number; interest: boolean }) => {
        const nextSkillDict = { ...skillDict };
        nextSkillDict[slot] = next.skill ? `${next.skill},${next.tier},${next.interest ? 'True' : 'False'}` : null;
        handleFieldChange('skill_dict', nextSkillDict);
      };
      return withTooltip(
        <Box key={field} sx={{ display: 'grid', gap: 1 }}>
          {(['primary', 'secondary', 'hidden'] as const).map((slot) => {
            const skill = parseSkill(skillDict[slot]);
            return (
              <Stack key={slot} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                <Typography sx={{ width: { md: 90 }, flexShrink: 0 }}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Skill</InputLabel>
                  <Select
                    value={skill.skill}
                    label="Skill"
                    onChange={(event) => updateSkill(slot, { ...skill, skill: event.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {SKILL_NAMES.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Tier"
                  value={skill.tier}
                  inputProps={{ min: 0, max: 9 }}
                  onChange={(event) => updateSkill(slot, { ...skill, tier: Math.min(9, Math.max(0, Number(event.target.value) || 0)) })}
                  sx={{ width: { md: 100 } }}
                />
                <FormControlLabel
                  control={<Checkbox checked={skill.interest} onChange={(event) => updateSkill(slot, { ...skill, interest: event.target.checked })} />}
                  label="Interest"
                />
              </Stack>
            );
          })}
        </Box>,
      );
    }

    if (['parent1', 'parent2', 'mentor', 'df_mentor'].includes(field)) {
      const selectedValue = typeof value === 'string' ? value : value == null ? '' : String(value);
      const availableIds = catIdOptionsForField(field, selectedValue);
      return withTooltip(
        <FormControl key={field} fullWidth>
          <InputLabel>{label}</InputLabel>
          <Select
            value={selectedValue}
            label={label}
            onChange={(event) => handleFieldChange(field, event.target.value || null)}
          >
            <MenuItem value="">None</MenuItem>
            {availableIds.map((id) => (
              <MenuItem key={id} value={id}>{displayCatLabel(id)}</MenuItem>
            ))}
          </Select>
        </FormControl>,
      );
    }

    if (['adoptive_parents', 'former_mentor', 'mate', 'previous_mates', 'current_apprentice', 'former_apprentices', 'faded_offspring', 'df_apprentices'].includes(field)) {
      const selectedValues = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
      const availableIds = catIdOptionsForField(field, selectedValues);
      return withTooltip(
        <FormControl key={field} fullWidth>
          <InputLabel>{label}</InputLabel>
          <Select
            multiple
            value={selectedValues}
            label={label}
            onChange={(event) => {
              const nextValue = event.target.value;
              handleFieldChange(field, typeof nextValue === 'string' ? nextValue.split(',') : nextValue);
            }}
            renderValue={(selected) => (selected as string[]).map((id) => displayCatLabel(id)).join(', ')}
          >
            {availableIds.map((id) => (
              <MenuItem key={id} value={id}>{displayCatLabel(id)}</MenuItem>
            ))}
          </Select>
        </FormControl>,
      );
    }

    if (BOOL_FIELDS.has(field)) {
      return withTooltip(
        <FormControlLabel
          key={field}
          control={
            <Checkbox
              checked={Boolean(value)}
              onChange={(event) => handleFieldChange(field, event.target.checked)}
            />
          }
          label={label}
        />, true,
      );
    }

    if (['accessory', 'inventory', 'scars'].includes(field) && options.length > 0) {
      const selectedValues = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
      return withTooltip(
        <FormControl key={field} fullWidth>
          <InputLabel>{label}</InputLabel>
          <Select
            multiple
            value={selectedValues}
            label={label}
            onChange={(event) => {
              const nextValue = event.target.value;
              handleFieldChange(field, typeof nextValue === 'string' ? nextValue.split(',') : nextValue);
            }}
            renderValue={(selected) => (selected as string[]).join(', ')}
          >
            {(field === 'pelt_name' ? options.filter((option) => option !== 'Tortie') : options).map((option) => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        </FormControl>,
      );
    }

    if (options.length > 0 && !LIST_FIELDS.has(field) && !DICT_FIELDS.has(field) && !field.includes('skill') && !field.includes('status')) {
      return withTooltip(
        <FormControl key={field} fullWidth disabled={disableField}>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value ?? ''}
            label={label}
            onChange={(event) => handleFieldChange(field, event.target.value || null)}
          >
            {!REQUIRED_APPEARANCE_SELECT_FIELDS.has(field) && <MenuItem value="">None</MenuItem>}
            {options.map((option) => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        </FormControl>,
      );
    }

    if (INT_FIELDS.has(field)) {
      return withTooltip(
        <TextField
          key={field}
          fullWidth
          type="number"
          label={label}
          value={value ?? 0}
          onChange={(event) => handleFieldChange(field, Number(event.target.value))}
        />, 
      );
    }

    if (LIST_FIELDS.has(field)) {
      const listValue = Array.isArray(value) ? value.join(', ') : value ?? '';
      return withTooltip(
        <TextField
          key={field}
          fullWidth
          label={label}
          value={listValue}
          onChange={(event) => {
            const next = event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            handleFieldChange(field, next);
          }}
        />, 
      );
    }

    if (DICT_FIELDS.has(field) || (typeof value === 'object' && value !== null && !Array.isArray(value))) {
      return withTooltip(
        <TextField
          key={field}
          fullWidth
          multiline
          minRows={3}
          label={label}
          value={value ? JSON.stringify(value, null, 2) : ''}
          onChange={(event) => {
            try {
              handleFieldChange(field, JSON.parse(event.target.value));
            } catch {
              handleFieldChange(field, {});
            }
          }}
        />, 
      );
    }

    return withTooltip(
      <TextField
        key={field}
        fullWidth
        label={label}
        value={value ?? ''}
        onChange={(event) => handleFieldChange(field, event.target.value)}
      />, 
    );
  };

  const renderFieldGroup = (groupName: string) => {
    const fields = FIELD_GROUPS[groupName] ?? [];
    if (!fields.length) return null;
    const tortieFields = fields.filter((field) => TORTIE_SECTION_FIELDS.includes(field));
    const spriteFields = fields.filter((field) => SPRITE_SECTION_FIELDS.includes(field));
    const darkForestSectionFields = groupName === 'Faith'
      ? ['joined_df', 'graduated_df', 'dark_forest_affinity', 'df_patrols', 'df_join_moon', 'df_mentor', 'df_apprentices']
      : [];
    const faithHeaderFields = groupName === 'Faith' ? ['prevent_fading', 'no_faith'] : [];
    const mainFields = fields.filter((field) => field !== 'accessory' && !TORTIE_SECTION_FIELDS.includes(field) && !SPRITE_SECTION_FIELDS.includes(field) && !darkForestSectionFields.includes(field) && !faithHeaderFields.includes(field));
    const accessoryField = fields.includes('accessory') ? 'accessory' : null;
    const compactStatFields = new Set(['courage', 'compassion', 'intelligence', 'empathy']);

    return (
      <Box key={groupName} sx={{ display: 'grid', gap: 2, minWidth: 0, width: '100%' }}>
        {spriteFields.length > 0 && (
          <Paper sx={{ p: groupName === 'Appearance' ? 0 : 2, minWidth: 0, width: '100%', overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Sprites</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {spriteFields.includes('reverse') && renderFieldEditor('reverse')}
                <Button variant="outlined" size="small" disabled={!selectedCatId} onClick={handleRandomizeAppearance}>
                  Randomize
                </Button>
              </Stack>
            </Stack>
            <Grid container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
              {spriteFields.filter((field) => field !== 'reverse').map((field) => (
                <Grid key={field} item xs={12} md={4}>
                  {renderFieldEditor(field)}
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}
        <Paper sx={{ p: groupName === 'Appearance' ? 0 : 2, pt: groupName === 'Appearance' || groupName === 'Faith' ? 0 : 2, minWidth: 0, width: '100%', overflow: 'hidden' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">{groupName}</Typography>
            {faithHeaderFields.length > 0 && (
              <Stack direction="row" spacing={2} alignItems="center">
                {faithHeaderFields.map((field) => renderFieldEditor(field))}
              </Stack>
            )}
          </Stack>
          <Grid container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
            {mainFields.map((field) => (
              <Grid
                key={field}
                item
                xs={12}
                md={groupName === 'Appearance' ? 3 : groupName === 'Relationships' && ['parent1', 'parent2', 'adoptive_parents', 'mentor', 'former_mentor', 'patrol_with_mentor', 'mate', 'previous_mates', 'faded_offspring'].includes(field) ? 4 : groupName === 'Faith' && ['faith', 'lock_faith', 'revives'].includes(field) ? 4 : groupName === 'Skills & Progress' && ['w_done', 'talked_to', 'flirted', 'insulted', 'did_activity'].includes(field) ? 2.4 : field === 'status' || field === 'pronouns' || field === 'skill_dict' || field === 'connected_dialogue' || field === 'backstory_str' ? 12 : compactStatFields.has(field) ? 3 : 6}
              >
                {renderFieldEditor(field)}
              </Grid>
            ))}
          </Grid>
        </Paper>
        {darkForestSectionFields.length > 0 && (
          <Paper sx={{ p: 2, pt: 0, minWidth: 0, width: '100%', overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Dark Forest</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                {['joined_df', 'graduated_df'].map((field) => renderFieldEditor(field))}
              </Stack>
            </Stack>
            <Grid container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
              {darkForestSectionFields.filter((field) => !['joined_df', 'graduated_df'].includes(field)).map((field) => (
                <Grid key={field} item xs={12} md={['dark_forest_affinity', 'df_patrols', 'df_join_moon'].includes(field) ? 4 : 6}>
                  {renderFieldEditor(field)}
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}
        {tortieFields.length > 0 && (
          <Paper sx={{ p: groupName === 'Appearance' ? 0 : 2, minWidth: 0, width: '100%', overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Tortie</Typography>
              {tortieFields.includes('tortie_enabled') && renderFieldEditor('tortie_enabled')}
            </Stack>
            <Grid container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
              {tortieFields.filter((field) => field !== 'tortie_enabled').map((field) => (
                <Grid key={field} item xs={12} md={3}>
                  {renderFieldEditor(field)}
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}
        {accessoryField && (
          <Paper sx={{ p: groupName === 'Appearance' ? 0 : 2, minWidth: 0, width: '100%', overflow: 'hidden' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Accessory</Typography>
            <Box sx={{ minWidth: 0, maxWidth: '100%' }}>{renderFieldEditor(accessoryField)}</Box>
          </Paper>
        )}
      </Box>
    );
  };

  const renderOverview = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5">{selectedCat ? `${selectedCat.name_prefix ?? 'Unnamed'}${selectedCat.name_suffix ?? ''}` : 'Unnamed cat'}</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>ID: {selectedCat?.ID ?? '—'} • Trait: {selectedCat?.trait ?? '—'} • Moons: {selectedCat?.moons ?? 0}</Typography>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">Summary</Typography>
        <Typography color="text.secondary">
          Gender: {selectedCat?.gender ?? '—'} • Gender align: {selectedCat?.gender_align ?? '—'} • Experience: {selectedCat?.experience ?? 0}
        </Typography>
      </Paper>
    </Box>
  );

  const renderIdentity = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Autocomplete
          freeSolo
          options={optionsForField(
            resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] },
            'name_prefix',
            typeof selectedCat?.name_prefix === 'string' ? selectedCat.name_prefix : undefined,
          )}
          value={selectedCat?.name_prefix ?? ''}
          onInputChange={(_, value) => handleFieldChange('name_prefix', value)}
          renderInput={(params) => (
            <FieldTooltip field="name_prefix" label="Name prefix">
              <TextField {...params} fullWidth label="Name prefix" />
            </FieldTooltip>
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Autocomplete
          freeSolo
          options={optionsForField(
            resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] },
            'name_suffix',
            typeof selectedCat?.name_suffix === 'string' ? selectedCat.name_suffix : undefined,
          )}
          value={selectedCat?.name_suffix ?? ''}
          onInputChange={(_, value) => handleFieldChange('name_suffix', value)}
          renderInput={(params) => (
            <FieldTooltip field="name_suffix" label="Name suffix">
              <TextField {...params} fullWidth label="Name suffix" />
            </FieldTooltip>
          )}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <FieldTooltip field="ID" label="ID">
          <TextField
            fullWidth
            type="number"
            label="ID"
            value={selectedCat?.ID ?? ''}
            disabled
          />
        </FieldTooltip>
      </Grid>
      <Grid item xs={12} md={3}>
        <FieldTooltip field="gender" label="Gender">
          <FormControl fullWidth>
            <InputLabel>Gender</InputLabel>
            <Select
              value={selectedCat?.gender ?? 'female'}
              label="Gender"
              onChange={(event) => handleFieldChange('gender', event.target.value)}
            >
              {(resourceCatalog?.options.gender ?? ['female', 'male']).map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </FieldTooltip>
      </Grid>
      <Grid item xs={12} md={3}>
        <FieldTooltip field="gender_align" label="Gender alignment">
          <FormControl fullWidth>
            <InputLabel>Gender alignment</InputLabel>
            <Select
              value={selectedCat?.gender_align ?? ''}
              label="Gender alignment"
              onChange={(event) => handleFieldChange('gender_align', event.target.value)}
            >
              {optionsForField(
                resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] },
                'gender_align',
                typeof selectedCat?.gender_align === 'string' ? selectedCat.gender_align : undefined,
              ).map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </FieldTooltip>
      </Grid>
      <Grid item xs={12} md={3}>
        <FieldTooltip field="moons" label="Moons">
          <TextField
            fullWidth
            label="Moons"
            type="number"
            value={selectedCat?.moons ?? 0}
            onChange={(event) => handleFieldChange('moons', Number(event.target.value))}
          />
        </FieldTooltip>
      </Grid>
      <Grid item xs={12}>
        <FieldTooltip field="backstory" label="Backstory">
          <FormControl fullWidth>
            <InputLabel>Backstory</InputLabel>
            <Select
              value={selectedCat?.backstory ?? ''}
              label="Backstory"
              onChange={(event) => handleFieldChange('backstory', event.target.value || null)}
            >
              <MenuItem value="">None</MenuItem>
              {optionsForField(
                resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] },
                'backstory',
                typeof selectedCat?.backstory === 'string' ? selectedCat.backstory : undefined,
              ).map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </FieldTooltip>
      </Grid>
      <Grid item xs={12}>
        <FieldTooltip field="backstory_str" label="Backstory string">
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Backstory string"
            value={selectedCat?.backstory_str ?? ''}
            onChange={(event) => handleFieldChange('backstory_str', event.target.value)}
          />
        </FieldTooltip>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="subtitle1">Trait and facets</Typography>
      </Grid>
      <Grid item xs={12}>
        <FieldTooltip field="trait" label="Trait">
          <FormControl fullWidth>
            <InputLabel>Trait</InputLabel>
            <Select
              value={selectedCat?.trait ?? ''}
              label="Trait"
              onChange={(event) => handleTraitChange(event.target.value)}
            >
              {(resourceCatalog?.options.trait ?? []).map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </FieldTooltip>
      </Grid>
      {FACET_NAMES.map((facetName, index) => {
        const facets = String(selectedCat?.facets ?? '').split(',');
        const range = resourceCatalog?.traitRanges?.[String(selectedCat?.trait ?? '')]?.[facetName];
        return (
          <Grid item xs={12} sm={6} md={3} key={facetName}>
            <FieldTooltip field="facets" label={facetName}>
              <TextField
                fullWidth
                type="number"
                label={facetName.charAt(0).toUpperCase() + facetName.slice(1)}
                value={facets[index] ?? 0}
                inputProps={range ? { min: range[0], max: range[1] } : { min: 0, max: 16 }}
                onChange={(event) => {
                  const nextFacets = [...facets];
                  nextFacets[index] = event.target.value;
                  handleFieldChange('facets', nextFacets.join(','));
                }}
              />
            </FieldTooltip>
          </Grid>
        );
      })}
      <Grid item xs={12}>
        {[
          ['favourite', 'Favourite'],
          ['paralyzed', 'Paralyzed'],
          ['no_kits', 'Cannot have kits'],
          ['no_mates', 'Cannot have mates'],
          ['no_retire', 'Cannot retire'],
        ].map(([field, label]) => (
          <FieldTooltip key={field} field={field} label={label} inline>
            <FormControlLabel
              control={<Checkbox checked={Boolean(selectedCat?.[field])} onChange={(event) => handleFieldChange(field, event.target.checked)} />}
              label={label}
            />
          </FieldTooltip>
        ))}
      </Grid>
    </Grid>
  );

  const renderLifeStages = () => (
    <Paper sx={{ px: 2, py: 0, minHeight: 152, display: 'grid', alignItems: 'center', flexShrink: 0 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' }, gap: 0, justifyItems: 'center', alignItems: 'center' }}>
        {lifeStageSprites.map(([label, field]) => (
          <CatPreview key={field} cat={selectedCat} poseName={typeof selectedCat?.[field] === 'string' ? selectedCat[field] : undefined} label={label} />
        ))}
      </Box>
    </Paper>
  );

  const renderAppearance = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {Object.keys(FIELD_GROUPS).filter((group) => group === 'Appearance').map(renderFieldGroup)}
    </Box>
  );

  const renderRelationships = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {Object.keys(FIELD_GROUPS).filter((group) => group === 'Relationships').map(renderFieldGroup)}
    </Box>
  );

  const renderSkills = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {Object.keys(FIELD_GROUPS).filter((group) => group === 'Skills & Progress').map(renderFieldGroup)}
    </Box>
  );

  const renderFaith = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {Object.keys(FIELD_GROUPS).filter((group) => group === 'Faith').map(renderFieldGroup)}
    </Box>
  );

  const renderValidation = () => (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {validationIssues.length === 0 ? (
        <Alert severity="success">No validation issues found.</Alert>
      ) : (
        validationIssues.map((issue, index) => (
          <Alert key={`${issue.cat_id ?? 'cat'}-${issue.field ?? 'field'}-${index}`} severity={issue.severity === 'error' ? 'error' : 'warning'}>
            {issue.message}
          </Alert>
        ))
      )}
    </Box>
  );

  const renderJson = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Typography sx={{ flexGrow: 1 }} color="text.secondary">Selected cat JSON</Typography>
        <Button
          variant="contained"
          disabled={!selectedCatId}
          onClick={() => {
            try {
              if (!selectedCatId) return;
              const parsed = JSON.parse(clanCatsJsonDraft);
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('The selected cat JSON must be an object.');
              }
              updateCat(selectedCatId, parsed);
              setClanCatsJsonError(null);
            } catch (error) {
              setClanCatsJsonError(error instanceof Error ? error.message : 'The selected cat JSON could not be applied.');
            }
          }}
        >
          Apply JSON
        </Button>
      </Stack>
      {clanCatsJsonError && <Alert severity="error">{clanCatsJsonError}</Alert>}
      <TextField
        fullWidth
        multiline
        minRows={24}
        disabled={!selectedCat}
        placeholder="Select a cat to edit its JSON."
        value={clanCatsJsonDraft}
        onChange={(event) => {
          setClanCatsJsonDraft(event.target.value);
          setClanCatsJsonError(null);
        }}
        sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
      />
    </Box>
  );

  const renderSelectedTab = () => {
    switch (tabIndex) {
      case 1:
        return renderIdentity();
      case 2:
        return renderAppearance();
      case 3:
        return renderRelationships();
      case 4:
        return renderSkills();
      case 5:
        return renderFaith();
      case 6:
        return renderJson();
      case 7:
        return renderValidation();
      default:
        return renderOverview();
    }
  };

  const renderFilePage = () => {
    if (selectedFile === 'about') {
      return (
        <Box sx={{ display: 'grid', placeItems: 'start', alignContent: 'start', minHeight: 0 }}>
          <Paper sx={{ p: 3, width: 'min(100%, 560px)' }}>
            <Typography variant="h4" gutterBottom>ClanGen Save Editor</Typography>
            <Typography color="text.secondary">Version 0.1.0</Typography>
            <Typography sx={{ mt: 2 }}>A local desktop editor for ClanGen and LifeGen clan save files.</Typography>
            <Typography sx={{ mt: 2 }}>
              Sprite Preview Generator built from cgen-tools Pixel Cat Maker:{' '}
              <Box component="a" href="https://cgen-tools.github.io/pixel-cat-maker/" target="_blank" rel="noreferrer" sx={{ color: 'primary.main' }}>
                https://cgen-tools.github.io/pixel-cat-maker/
              </Box>
            </Typography>
          </Paper>
        </Box>
      );
    }

    if (selectedFile === 'names') {
      return (
        <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 2, alignContent: 'start', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5">Names</Typography>
              <Typography variant="body2" color="text.secondary">dicts/names/names.json</Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => {
                void saveNamesFile(serializedNamesDraft);
                setNamesDraftDirty(false);
              }}
              disabled={!resourceDirPath || !serializedNamesDraft || (!namesFileDirty && !namesDraftDirty)}
            >
              Save names.json
            </Button>
            <Button variant="outlined" onClick={() => setShowRawNames((value) => !value)}>
              {showRawNames ? 'Structured view' : 'Show raw JSON'}
            </Button>
          </Stack>
          {showRawNames ? (
            <Box sx={{ minHeight: 0, overflow: 'auto' }}>
              <TextField
                fullWidth
                multiline
                minRows={24}
                value={serializedNamesDraft}
                disabled={!resourceDirPath}
                placeholder="Select a ClanGen data folder to load names.json."
                onChange={(event) => setNamesJson(event.target.value)}
                sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
              />
            </Box>
          ) : (
            <Box sx={{ minHeight: 0, overflow: 'auto', display: 'grid', gap: 2, alignContent: 'start' }}>
              <>
              <Paper sx={{ p: 1 }}>
                <Tabs value={selectedNamesSection} onChange={(_, next) => setSelectedNamesSection(next)} variant="scrollable" scrollButtons="auto">
                  <Tab value="special" label="Special" />
                  <Tab value="normal" label="Normal" />
                  <Tab value="color" label="Pelt Color" />
                  <Tab value="pelt" label="Pelt Pattern" />
                  <Tab value="eye" label="Eye Color" />
                  <Tab value="tortie" label="Tortie Pattern" />
                  <Tab value="animal" label="Animal" />
                  <Tab value="biome" label="Biome" />
                  <Tab value="clan" label="Clan" />
                  <Tab value="human" label="Human" />
                  <Tab value="loner" label="Loner" />
                  <Tab value="silly" label="Silly" />
                </Tabs>
              </Paper>
              {selectedNamesSection === 'special' && <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Special</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Edit the suffix assigned to each special life stage independently.
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(specialSuffixes).map(([role, suffix]) => (
                    <Grid item xs={12} sm={6} md={4} key={role}>
                      <TextField
                        fullWidth
                        label={role}
                        value={suffix}
                        onChange={(event) => updateSpecialSuffix(role, event.target.value)}
                      />
                    </Grid>
                  ))}
                </Grid>
                {Object.keys(specialSuffixes).length === 0 && (
                  <Typography color="text.secondary">Load names.json to edit Special.</Typography>
                )}
              </Paper>}
              {selectedNamesSection !== 'special' && <Paper sx={{ p: 2 }}>
                {selectedNamesSection === 'silly' && <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {nameSectionDescriptions.silly}
                  </Typography>
                  <NameCollectionEditor
                    title="Silly"
                    options={[{ id: 'silly_names', label: 'Silly names' }]}
                    selectedId="silly_names"
                    entries={sillyNames}
                    disabled={!resourceDirPath}
                    onSelect={() => undefined}
                    onChange={(entries) => updateFlatNameSection('silly_names', entries)}
                    onAdd={() => updateFlatNameSection('silly_names', [...sillyNames, { name: '', count: 1 }])}
                  />
                </>}
                {selectedNamesSection === 'human' && <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {nameSectionDescriptions.human}
                  </Typography>
                  <NameCollectionEditor
                    title="Human"
                    options={[{ id: 'human_names', label: 'Human names' }]}
                    selectedId="human_names"
                    entries={humanNames}
                    disabled={!resourceDirPath}
                    onSelect={() => undefined}
                    onChange={(entries) => updateFlatNameSection('human_names', entries)}
                    onAdd={() => updateFlatNameSection('human_names', [...humanNames, { name: '', count: 1 }])}
                  />
                </>}
                {selectedNamesSection === 'loner' && <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {nameSectionDescriptions.loner}
                  </Typography>
                  <NameCollectionEditor
                    title="Loner"
                    options={[{ id: 'loner_names', label: 'Loner names' }]}
                    selectedId="loner_names"
                    entries={lonerNames}
                    disabled={!resourceDirPath}
                    onSelect={() => undefined}
                    onChange={(entries) => updateFlatNameSection('loner_names', entries)}
                    onAdd={() => updateFlatNameSection('loner_names', [...lonerNames, { name: '', count: 1 }])}
                  />
                </>}
                {selectedNamesSection === 'eye' && <NameCollectionEditor
                  title="Eye Color"
                  options={eyeGroupNames.map((group) => ({ id: group, label: group }))}
                  selectedId={activeEyeGroup}
                  entries={activeEyeNames}
                  disabled={!resourceDirPath}
                  onSelect={setSelectedEyeGroup}
                  onChange={(entries) => updateGroupedNames('eye_prefixes', activeEyeGroup, entries)}
                  onAdd={() => updateGroupedNames('eye_prefixes', activeEyeGroup, [...activeEyeNames, { name: '', count: 1 }])}
                />}
                {selectedNamesSection === 'color' && <NameCollectionEditor
                  title="Pelt Color"
                  options={colorGroupNames.map((group) => ({ id: group, label: group }))}
                  selectedId={activeColorGroup}
                  entries={activeColorNames}
                  disabled={!resourceDirPath}
                  onSelect={setSelectedColorGroup}
                  onChange={(entries) => updateGroupedNames('colour_prefixes', activeColorGroup, entries)}
                  onAdd={() => updateGroupedNames('colour_prefixes', activeColorGroup, [...activeColorNames, { name: '', count: 1 }])}
                />}
                {selectedNamesSection === 'biome' && <>
                  <Typography variant="h6" gutterBottom>Biome</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Edit biome prefixes and suffixes and how often each appears in the name pool.
                  </Typography>
                  <Grid container spacing={2} alignItems="flex-start">
                    <Grid item xs={12} md={6}>
                      <NameCollectionEditor
                        title="Biome prefixes"
                        options={biomePrefixGroupNames.map((group) => ({ id: group, label: group }))}
                        selectedId={activeBiomePrefixGroup}
                        entries={activeBiomePrefixes}
                        disabled={!resourceDirPath}
                        onSelect={setSelectedBiomePrefixGroup}
                        onChange={(entries) => updateGroupedNames('biome_prefixes', activeBiomePrefixGroup, entries)}
                        onAdd={() => updateGroupedNames('biome_prefixes', activeBiomePrefixGroup, [...activeBiomePrefixes, { name: '', count: 1 }])}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <NameCollectionEditor
                        title="Biome suffixes"
                        options={biomeSuffixGroupNames.map((group) => ({ id: group, label: group }))}
                        selectedId={activeBiomeSuffixGroup}
                        entries={activeBiomeSuffixes}
                        disabled={!resourceDirPath}
                        onSelect={setSelectedBiomeSuffixGroup}
                        onChange={(entries) => updateGroupedNames('biome_suffixes', activeBiomeSuffixGroup, entries)}
                        onAdd={() => updateGroupedNames('biome_suffixes', activeBiomeSuffixGroup, [...activeBiomeSuffixes, { name: '', count: 1 }])}
                      />
                    </Grid>
                  </Grid>
                </>}
                {selectedNamesSection === 'animal' && <>
                  <Typography variant="h6" gutterBottom>Animal</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Edit animal prefixes and suffixes and how often each appears in the name pool.
                  </Typography>
                  <Grid container spacing={2} alignItems="flex-start">
                    <Grid item xs={12} md={6}>
                      <NormalNameList
                        title="Animal prefixes"
                        entries={animalPrefixes}
                        disabled={!resourceDirPath}
                        onChange={(entries) => updateAnimalNames('animal_prefixes', entries)}
                      />
                      <Stack direction="row" justifyContent="flex-end" sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 1, py: 1, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                        <Button
                          size="small"
                          onClick={() => updateAnimalNames('animal_prefixes', [...animalPrefixes, { name: '', count: 1 }])}
                          disabled={!resourceDirPath}
                        >
                          Add prefix
                        </Button>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <NormalNameList
                        title="Animal suffixes"
                        entries={animalSuffixes}
                        disabled={!resourceDirPath}
                        onChange={(entries) => updateAnimalNames('animal_suffixes', entries)}
                      />
                      <Stack direction="row" justifyContent="flex-end" sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 1, py: 1, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                        <Button
                          size="small"
                          onClick={() => updateAnimalNames('animal_suffixes', [...animalSuffixes, { name: '', count: 1 }])}
                          disabled={!resourceDirPath}
                        >
                          Add suffix
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </>}
                {selectedNamesSection === 'normal' && <>
                <Typography variant="h6" gutterBottom>Normal</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Edit each normal prefix or suffix and how often it appears in the name pool.
                </Typography>
                <Grid container spacing={2} alignItems="flex-start">
                  <Grid item xs={12} md={6}>
                    <NormalNameList
                      title="Normal prefixes"
                      entries={normalPrefixes}
                      disabled={!resourceDirPath}
                      onChange={(entries) => updateNormalNames('normal_prefixes', entries)}
                    />
                    <Stack direction="row" justifyContent="flex-end" sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 1, py: 1, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                      <Button
                        size="small"
                        onClick={() => updateNormalNames('normal_prefixes', [...normalPrefixes, { name: '', count: 1 }])}
                        disabled={!resourceDirPath}
                      >
                        Add prefix
                      </Button>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <NormalNameList
                      title="Normal suffixes"
                      entries={normalSuffixes}
                      disabled={!resourceDirPath}
                      onChange={(entries) => updateNormalNames('normal_suffixes', entries)}
                    />
                    <Stack direction="row" justifyContent="flex-end" sx={{ position: 'sticky', bottom: 0, zIndex: 1, mt: 1, py: 1, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                      <Button
                        size="small"
                        onClick={() => updateNormalNames('normal_suffixes', [...normalSuffixes, { name: '', count: 1 }])}
                        disabled={!resourceDirPath}
                      >
                        Add suffix
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
                </>}
                {selectedNamesSection === 'clan' && <NameCollectionEditor
                  title="Clan"
                  options={[{ id: 'clan_prefixes', label: 'Clan' }]}
                  selectedId="clan_prefixes"
                  entries={clanPrefixes}
                  disabled={!resourceDirPath}
                  onSelect={() => undefined}
                  onChange={updateClanPrefixes}
                  onAdd={() => updateClanPrefixes([...clanPrefixes, { name: '', count: 1 }])}
                />}
                {selectedNamesSection === 'tortie' && <Box sx={{ mt: 1 }}>
                  <Typography variant="h6" gutterBottom>Tortie Pattern</Typography>
                  <FormControl size="small" fullWidth sx={{ mb: 1.5 }} disabled={!resourceDirPath || tortieSuffixGroupNames.length === 0}>
                    <InputLabel id="tortie-suffix-group-label">Tortie group</InputLabel>
                    <Select
                      labelId="tortie-suffix-group-label"
                      value={activeTortieSuffixGroup}
                      label="Tortie group"
                      onChange={(event) => setSelectedTortieSuffixGroup(String(event.target.value))}
                    >
                      {tortieSuffixGroupNames.map((group) => (
                        <MenuItem key={group} value={group}>{group}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {activeTortieSuffixGroup ? (
                    <>
                      <NormalNameList
                        title={`${activeTortieSuffixGroup} suffixes`}
                        entries={activeTortieSuffixes}
                        disabled={!resourceDirPath}
                        onChange={updateTortieSuffixes}
                      />
                      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          onClick={() => updateTortieSuffixes([...activeTortieSuffixes, { name: '', count: 1 }])}
                          disabled={!resourceDirPath}
                        >
                          Add tortie suffix
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <Typography color="text.secondary">Load names.json to edit Tortie Pattern.</Typography>
                  )}
                </Box>}
                {selectedNamesSection === 'pelt' && <>
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>Pelt Pattern</Typography>
                  <FormControl size="small" fullWidth sx={{ mb: 1.5 }} disabled={!resourceDirPath || peltSuffixGroupNames.length === 0}>
                    <InputLabel id="pelt-suffix-group-label">Pelt group</InputLabel>
                    <Select
                      labelId="pelt-suffix-group-label"
                      value={activePeltSuffixGroup}
                      label="Pelt group"
                      onChange={(event) => setSelectedPeltSuffixGroup(String(event.target.value))}
                    >
                      {peltSuffixGroupNames.map((group) => (
                        <MenuItem key={group} value={group}>{group}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {activePeltSuffixGroup ? (
                    <>
                      <NormalNameList
                        title={`${activePeltSuffixGroup} suffixes`}
                        entries={activePeltSuffixes}
                        disabled={!resourceDirPath}
                        onChange={updatePeltSuffixes}
                      />
                      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          onClick={() => updatePeltSuffixes([...activePeltSuffixes, { name: '', count: 1 }])}
                          disabled={!resourceDirPath}
                        >
                          Add pelt suffix
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <Typography color="text.secondary">Load names.json to edit Pelt Pattern.</Typography>
                  )}
                </Box>
                </>}
              </Paper>}
              </>
            </Box>
          )}
        </Box>
      );
    }
    if (selectedFile !== 'clan_cats') return <Typography>That file editor is not available yet.</Typography>;

    return (
      <Box sx={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: 2, minHeight: 0, alignContent: 'start' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ flexShrink: 0 }}>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>Clan cats</Typography>
          <Tooltip title="Add a new cat with randomly generated details and appearance." arrow enterDelay={300}>
            <span><Button variant="outlined" onClick={handleAddRandomCat} disabled={!document}>Add</Button></span>
          </Tooltip>
          <Tooltip title="Create a copy of the selected cat." arrow enterDelay={300}>
            <span><Button variant="outlined" onClick={() => duplicateSelectedCat()} disabled={!selectedCatId}>Duplicate</Button></span>
          </Tooltip>
          <Tooltip title="Delete the selected cat." arrow enterDelay={300}>
            <span><Button variant="outlined" color="error" onClick={() => setDeleteDialogOpen(true)} disabled={!selectedCatId}>Delete</Button></span>
          </Tooltip>
          <Tooltip title="Select and delete multiple cats at once." arrow enterDelay={300}>
            <span><Button variant="outlined" color="error" onClick={() => { setBulkDeleteIds([]); setBulkDeleteDialogOpen(true); }} disabled={!document || catList.length === 0}>Bulk delete</Button></span>
          </Tooltip>
          <Tooltip title="Select which cat to edit." arrow enterDelay={300}>
            <span style={{ display: 'block' }}>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="cat-selector-label">Cat</InputLabel>
                <Select
                  labelId="cat-selector-label"
                  value={selectedCatId ?? ''}
                  label="Cat"
                  onChange={(event) => setSelectedCatId(String(event.target.value))}
                >
                  {catList.length === 0 ? (
                    <MenuItem value="" disabled>No cats loaded</MenuItem>
                  ) : catList.map((cat) => (
                    <MenuItem key={String(cat.ID)} value={String(cat.ID)}>
                      {displayCatLabel(String(cat.ID))}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </span>
          </Tooltip>
        </Stack>
        <Paper sx={{ p: 1, flexShrink: 0 }}>
          <Tabs value={tabIndex} onChange={(_, next) => setTabIndex(next)} variant="scrollable" scrollButtons="auto">
            {tabLabels.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Paper>
        {tabIndex === 2 ? (
          <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 1, minHeight: 0 }}>
            {renderLifeStages()}
            <Paper sx={{ p: 2, minHeight: 0, overflow: 'auto' }}>
              {selectedCat ? renderAppearance() : <Typography>No cat selected.</Typography>}
            </Paper>
          </Box>
        ) : (
          <Paper sx={{ p: 2, minHeight: 0, overflow: 'auto', alignSelf: 'stretch' }}>
            {selectedCat ? renderSelectedTab() : <Typography>No cat selected.</Typography>}
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden', bgcolor: 'background.default', color: 'text.primary' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Tooltip title="Open the file editor menu." arrow enterDelay={300}>
            <IconButton size="large" edge="start" color="inherit" aria-label="menu" onClick={() => setOpen(true)}>
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ClanGen Save Editor
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Choose the clan save to edit." arrow enterDelay={300}>
              <span style={{ display: 'block' }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="clan-selector-label">Clan save</InputLabel>
                  <Select
                    labelId="clan-selector-label"
                    value={selectedClanPath ?? ''}
                    label="Clan save"
                    disabled={openingFile}
                    onChange={(event) => {
                      if (event.target.value) void selectClan(String(event.target.value));
                    }}
                  >
                    <MenuItem value="" disabled>Select a clan</MenuItem>
                    {clans.map((clan) => (
                      <MenuItem key={clan.path} value={clan.path}>{clan.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </span>
            </Tooltip>
            <Tooltip title="Choose the ClanGen saves folder and load its first clan." arrow enterDelay={300}>
              <span><Button variant="contained" color="primary" disabled={openingFile} onClick={() => openSaveFile()}>
                {openingFile ? 'Opening...' : 'Open'}
              </Button></span>
            </Tooltip>
            <Tooltip title="Save the current edits to the selected file." arrow enterDelay={300}>
              <span><Button
                variant="contained"
                color="secondary"
                onClick={() => selectedFile === 'names' ? void saveNamesFile(serializedNamesDraft) : void saveDocument()}
                disabled={selectedFile === 'about'}
              >
                Save
              </Button></span>
            </Tooltip>
            <Tooltip title="Validate the current save data." arrow enterDelay={300}>
              <span><Button variant="outlined" onClick={() => validate()} disabled={selectedFile === 'about'}>Validate</Button></span>
            </Tooltip>
            <Tooltip title="Open the ClanGen data folder." arrow enterDelay={300}>
              <span><Button variant="outlined" onClick={() => openResourceDir()}>ClanGen Data</Button></span>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete cat?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete {selectedCatLabel}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              deleteSelectedCat();
              setDeleteDialogOpen(false);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete multiple cats?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Select the cats to permanently delete.
          </DialogContentText>
          <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {catList.map((cat) => {
              const catId = String(cat.ID);
              return (
                <FormControlLabel
                  key={catId}
                  control={
                    <Checkbox
                      checked={bulkDeleteIds.includes(catId)}
                      onChange={(event) => setBulkDeleteIds((currentIds) => event.target.checked
                        ? [...currentIds, catId]
                        : currentIds.filter((currentId) => currentId !== catId))}
                    />
                  }
                  label={displayCatLabel(catId)}
                  sx={{ display: 'flex', width: '100%', m: 0 }}
                />
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={bulkDeleteIds.length === 0}
            onClick={() => {
              deleteCats(bulkDeleteIds);
              setBulkDeleteIds([]);
              setBulkDeleteDialogOpen(false);
            }}
          >
            Delete {bulkDeleteIds.length > 0 ? `${bulkDeleteIds.length} cats` : 'cats'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', minHeight: 0 }}>
        <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
          <Box sx={{ width: 280 }}>
            <Typography variant="h6" sx={{ p: 2 }}>Files</Typography>
            <List>
              <ListItem disablePadding>
                <ListItemButton
                  selected={selectedFile === 'about'}
                  onClick={() => {
                    setSelectedFile('about');
                    setOpen(false);
                  }}
                >
                  <ListItemText primary="About" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  selected={selectedFile === 'clan_cats'}
                  onClick={() => {
                    setSelectedFile('clan_cats');
                    setOpen(false);
                  }}
                >
                  <ListItemText primary="Clan cats" secondary="clan_cats.json" />
                </ListItemButton>
                </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  selected={selectedFile === 'names'}
                  onClick={() => {
                    setSelectedFile('names');
                    setOpen(false);
                  }}
                >
                  <ListItemText primary="Names" secondary="dicts/names/names.json" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton disabled>
                  <ListItemText primary="Other files" secondary="Coming soon" />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>

        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, p: 2, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 2, alignContent: 'start', overflow: 'hidden' }}>
          <Alert
            severity="info"
            sx={{
              alignSelf: 'start',
              py: 0.75,
              minHeight: 0,
              '& .MuiAlert-message': {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          >
            {status}
          </Alert>

          {renderFilePage()}
        </Box>
      </Box>
    </Box>
  );
}
