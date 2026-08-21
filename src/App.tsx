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
  Chip,
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
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import RedoIcon from '@mui/icons-material/Redo';
import UndoIcon from '@mui/icons-material/Undo';
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
import { FACET_NAMES, sanitizeImportedCat } from './model/catDocument';
import { copyTextToClipboard, readTextFromClipboard } from './services/fileSystemAccess';
import { CatPreview } from './components/CatPreview';
import { FamilyTree } from './components/FamilyTree';
import { afterlifeStateForCat, isDeadCat as isDeadCatByBackstory } from './model/afterlife';
import { createDefaultRelationshipEntry } from './model/relationships';
import type { FamilyRelationshipCommand, FamilyRelationshipMutationResult } from './model/familyRelationshipMutation';

const tabLabels = ['Overview', 'Identity', 'Appearance', 'Relationships', 'Skills', 'Faith', 'Conditions', 'JSON', 'Validation'];
const TAB_TOOLTIPS: Record<string, string> = {
  Overview: 'Quick summary of the selected cat, including core status details.',
  Identity: 'Name, age, gender, rank, and core identity fields.',
  Appearance: 'Pelt, colors, sprites, markings, scars, and accessories.',
  Relationships: 'Parents, mates, mentors, and one-directional relationship stats.',
  Skills: 'Skill paths, talents, and related progression fields.',
  Faith: 'Beliefs, former beliefs, and spiritual alignment values.',
  Conditions: 'Illnesses, injuries, permanent conditions, and related details.',
  JSON: 'Direct JSON editor for the selected cat record.',
  Validation: 'Schema and data checks for the selected cat.',
};
const RELATIONSHIP_FIELD_RANGES: Record<string, [number, number]> = {
  romance: [0, 100],
  like: [-100, 100],
  respect: [-100, 100],
  trust: [-100, 100],
  comfort: [-100, 100],
};
const RELATIONSHIP_FIELD_DESCRIPTIONS: Record<string, string> = {
  romance: 'Romantic interest this cat has in the target cat, from 0 (none) to 100 (full).',
  like: 'How much this cat likes the target cat, from -100 (dislike) to 100 (like).',
  respect: 'How much this cat respects the target cat, from -100 (disrespect) to 100 (respect).',
  trust: 'How much this cat trusts the target cat, from -100 (distrust) to 100 (trust).',
  comfort: 'How comfortable this cat is around the target cat, from -100 to 100.',
};
const CONDITION_SECTIONS = [
  { key: 'illnesses', label: 'Illnesses', addLabel: 'Add illness' },
  { key: 'injuries', label: 'Injuries', addLabel: 'Add injury' },
  { key: 'permanent conditions', label: 'Permanent conditions', addLabel: 'Add permanent condition' },
] as const;
type ConditionSection = (typeof CONDITION_SECTIONS)[number]['key'];
const CONDITION_OPTION_FIELDS: Record<ConditionSection, string> = {
  illnesses: 'condition_illness',
  injuries: 'condition_injury',
  'permanent conditions': 'condition_permanent',
};
const CONDITION_DEFINITION_TYPES: Record<ConditionSection, string> = {
  illnesses: 'illness',
  injuries: 'injury',
  'permanent conditions': 'permanent',
};
function conditionAgeForMoons(moonsValue: unknown): string {
  const moons = Number(moonsValue);
  if (!Number.isFinite(moons) || moons <= 0) return 'newborn';
  if (moons < 6) return 'kitten';
  if (moons < 12) return 'adolescent';
  if (moons < 48) return 'young adult';
  if (moons < 96) return 'adult';
  if (moons < 120) return 'senior adult';
  return 'senior';
}
const lifeStageSprites = [
  ['Newborn', 'sprite_newborn'],
  ['Kitten', 'sprite_kitten'],
  ['Adolescent', 'sprite_adolescent'],
  ['Adult', 'sprite_adult'],
  ['Senior', 'sprite_senior'],
  ['Paralyzed adult', 'sprite_para_adult'],
] as const;
const EVENT_INJURIES_DISTRIBUTION_FILE = 'dicts/conditions/event_injuries_distribution.json';

type EventInjuriesDistribution = Record<string, Record<string, number>>;

function parseEventInjuriesDistribution(contents: string): EventInjuriesDistribution | null {
  try {
    const parsed: unknown = JSON.parse(contents);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const distribution: EventInjuriesDistribution = {};
    for (const [rank, severities] of Object.entries(parsed)) {
      if (!severities || typeof severities !== 'object' || Array.isArray(severities)) return null;
      const parsedSeverities: Record<string, number> = {};
      for (const [severity, value] of Object.entries(severities)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        parsedSeverities[severity] = value;
      }
      distribution[rank] = parsedSeverities;
    }
    return distribution;
  } catch {
    return null;
  }
}
function lifeStageForMoons(moonsValue: unknown): [string, string] {
  const moons = Number(moonsValue);
  if (!Number.isFinite(moons) || moons <= 0) return lifeStageSprites[0] as [string, string];
  if (moons < 6) return lifeStageSprites[1] as [string, string];
  if (moons < 12) return lifeStageSprites[2] as [string, string];
  if (moons < 120) return lifeStageSprites[3] as [string, string];
  return lifeStageSprites[4] as [string, string];
}
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
  const [selectedRelationshipTargetId, setSelectedRelationshipTargetId] = useState<string | null>(null);
  const [namesDraft, setNamesDraft] = useState<Record<string, any> | null>(null);
  const [namesDraftDirty, setNamesDraftDirty] = useState(false);
  const [clanCatsJsonDraft, setClanCatsJsonDraft] = useState('');
  const [clanCatsJsonError, setClanCatsJsonError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDraftText, setImportDraftText] = useState('');
  const [importMode, setImportMode] = useState<'new' | 'overwrite'>('new');
  const [importError, setImportError] = useState<string | null>(null);
  const [previousPeltNames, setPreviousPeltNames] = useState<Record<string, string>>({});
  const [familyTreeFocusCatId, setFamilyTreeFocusCatId] = useState<string | null>(null);

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
  const clanMetadataReference = useEditorStore((state) => state.clanMetadataReference);
  const namesJson = useEditorStore((state) => state.namesJson);
  const namesFileDirty = useEditorStore((state) => state.namesFileDirty);
  const conditionResourceFiles = useEditorStore((state) => state.conditionResourceFiles);
  const selectedConditionResourceFile = useEditorStore((state) => state.selectedConditionResourceFile);
  const conditionResourceDrafts = useEditorStore((state) => state.conditionResourceDrafts);
  const conditionResourceDirtyFiles = useEditorStore((state) => state.conditionResourceDirtyFiles);
  const conditionFiles = useEditorStore((state) => state.conditionFiles);
  const relationshipFiles = useEditorStore((state) => state.relationshipFiles);
  const updateRelationshipFile = useEditorStore((state) => state.updateRelationshipFile);
  const clans = useEditorStore((state) => state.clans);
  const selectedClanPath = useEditorStore((state) => state.selectedClanPath);
  const discoverClans = useEditorStore((state) => state.discoverClans);
  const selectClan = useEditorStore((state) => state.selectClan);
  const openSaveFile = useEditorStore((state) => state.openSaveFile);
  const openResourceDir = useEditorStore((state) => state.openResourceDir);
  const saveDocument = useEditorStore((state) => state.saveDocument);
  const updateConditionFile = useEditorStore((state) => state.updateConditionFile);
  const updateClanMetadata = useEditorStore((state) => state.updateClanMetadata);
  const saveNamesFile = useEditorStore((state) => state.saveNamesFile);
  const setNamesJson = useEditorStore((state) => state.setNamesJson);
  const loadConditionResourceFiles = useEditorStore((state) => state.loadConditionResourceFiles);
  const selectConditionResourceFile = useEditorStore((state) => state.selectConditionResourceFile);
  const setConditionResourceDraft = useEditorStore((state) => state.setConditionResourceDraft);
  const saveConditionResourceFile = useEditorStore((state) => state.saveConditionResourceFile);
  const validate = useEditorStore((state) => state.validate);
  const addCat = useEditorStore((state) => state.addCat);
  const duplicateSelectedCat = useEditorStore((state) => state.duplicateSelectedCat);
  const deleteSelectedCat = useEditorStore((state) => state.deleteSelectedCat);
  const deleteCats = useEditorStore((state) => state.deleteCats);
  const setSelectedCatId = useEditorStore((state) => state.setSelectedCatId);
  const updateCat = useEditorStore((state) => state.updateCat);
  const applyFamilyRelationshipCommand = useEditorStore((state) => state.applyFamilyRelationshipCommand);
  const setMateStatus = useEditorStore((state) => state.setMateStatus);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.undoHistory.length > 0);
  const canRedo = useEditorStore((state) => state.redoHistory.length > 0);
  const replaceCat = useEditorStore((state) => state.replaceCat);

  const selectedConditions = useMemo<Record<string, unknown>>(
    () => selectedCatId ? conditionFiles[selectedCatId] ?? {} : {},
    [conditionFiles, selectedCatId],
  );

  const selectedRelationships = useMemo<Record<string, unknown>[]>(
    () => selectedCatId ? relationshipFiles[selectedCatId] ?? [] : [],
    [relationshipFiles, selectedCatId],
  );

  const catList = document?.cats ?? [];

  const clanMetadata = useMemo<Record<string, any> | null>(() => {
    if (!clanMetadataReference?.contents) return null;
    try {
      const parsed = JSON.parse(clanMetadataReference.contents);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, [clanMetadataReference]);

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
    setSelectedRelationshipTargetId(null);
  }, [selectedCatId]);

  useEffect(() => {
    if (tabIndex === 6) {
      setClanCatsJsonDraft(selectedCat ? JSON.stringify(selectedCat, null, 2) : '');
      setClanCatsJsonError(null);
    }
  }, [selectedCatId, tabIndex]);

  const parsedNames = namesDraft;
  const displaySpecialSuffixes = useMemo<Record<string, string>>(() => {
    const defaults: Record<string, string> = {
      newborn: 'kit',
      kitten: 'kit',
      apprentice: 'paw',
      'medicine cat apprentice': 'paw',
      'mediator apprentice': 'paw',
      "queen's apprentice": 'paw',
      leader: 'star',
    };
    const source = parsedNamesFromStore?.special_suffixes;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return defaults;
    return {
      ...defaults,
      ...Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    };
  }, [parsedNamesFromStore]);
  const specialSuffixes = parsedNames?.special_suffixes && typeof parsedNames.special_suffixes === 'object'
    ? parsedNames.special_suffixes as Record<string, string>
    : {};
  const serializedNamesDraft = parsedNames ? JSON.stringify(parsedNames, null, 2) + '\n' : namesJson;
  const selectedConditionResourceDraft = selectedConditionResourceFile
    ? conditionResourceDrafts[selectedConditionResourceFile] ?? ''
    : '';
  const conditionResourceJsonError = useMemo(() => {
    if (!selectedConditionResourceDraft) return null;
    try {
      JSON.parse(selectedConditionResourceDraft);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid JSON.';
    }
  }, [selectedConditionResourceDraft]);
  const selectedConditionResourceDirty = selectedConditionResourceFile
    ? conditionResourceDirtyFiles.includes(selectedConditionResourceFile)
    : false;
  const updateNamesDraft = (next: Record<string, any>) => {
    setNamesDraft(next);
    setNamesDraftDirty(true);
  };

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

  const handleFamilyRelationshipCommand = (command: FamilyRelationshipCommand): FamilyRelationshipMutationResult => (
    command.relationship === 'mate'
      ? setMateStatus(command.sourceId, command.targetId, command.operation === 'add')
      : applyFamilyRelationshipCommand(command)
  );

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
    return displayCatName(cat);
  };

  const specialConditionForCat = (cat: Record<string, any> | null): string | null => {
    if (!cat) return null;
    const catId = String(cat.ID ?? '');
    if (String(clanMetadata?.leader ?? '') === catId) return 'Leader';
    if (String(clanMetadata?.deputy ?? '') === catId) return 'Deputy';
    if (String(clanMetadata?.med_cat ?? '') === catId) return 'Medicine cat';
    const groupHistory = cat.status?.group_history;
    const currentHistory = Array.isArray(groupHistory) ? groupHistory[groupHistory.length - 1] : null;
    const rank = String(currentHistory?.rank ?? '').toLowerCase();
    const rankLabels: Record<string, string> = {
      apprentice: 'Apprentice',
      'medicine cat apprentice': 'Medicine cat apprentice',
      'mediator apprentice': 'Mediator apprentice',
      "queen's apprentice": "Queen's apprentice",
      queen: 'Queen',
      'medicine cat': 'Medicine cat',
      mediator: 'Mediator',
    };
    if (rankLabels[rank]) return rankLabels[rank];
    const moons = Number(cat.moons);
    if (!Number.isFinite(moons) || moons <= 0) return 'Newborn';
    if (moons < 6) return 'Kitten';
    if (moons < 12) return 'Adolescent';
    return null;
  };

  const isDeadCat = (cat: Record<string, any> | null): boolean => (
    isDeadCatByBackstory(cat)
  );

  const deadCatStateOrder = ['starclan', 'unknown_residence', 'dark_forest'];
  const mediatorIds = new Set(Array.isArray(clanMetadata?.mediated) ? clanMetadata.mediated.map(String) : []);
  const selectorPriorityFor = (cat: Record<string, any>): number => {
    const catId = String(cat.ID ?? '');
    if (String(clanMetadata?.your_cat ?? '') === catId) return 0;
    if (String(clanMetadata?.leader ?? '') === catId) return 1;
    if (String(clanMetadata?.deputy ?? '') === catId) return 2;
    if (String(clanMetadata?.med_cat ?? '') === catId) return 3;
    if (mediatorIds.has(catId)) return 4;
    return 5;
  };
  const orderedCatList = [...catList].sort((a, b) => {
    const priorityOrder = selectorPriorityFor(a) - selectorPriorityFor(b);
    if (priorityOrder !== 0) return priorityOrder;
    const deadOrder = Number(isDeadCat(a)) - Number(isDeadCat(b));
    if (deadOrder !== 0) return deadOrder;
    if (!isDeadCat(a)) return 0;
    return deadCatStateOrder.indexOf(afterlifeStateForCat(a)) - deadCatStateOrder.indexOf(afterlifeStateForCat(b));
  });

  const displayCatName = (cat: Record<string, any> | undefined): string => {
    if (!cat) return 'Unnamed cat';
    if (cat.specsuffix_hidden) return `${cat.name_prefix ?? 'Unnamed'}${cat.name_suffix ?? ''}`.trim() || 'Unnamed cat';
    const catId = String(cat.ID ?? '');
    const currentGroupId = String(clanMetadata?.used_group_IDs?.[catId] ?? '1');
    const isLeader = String(clanMetadata?.leader ?? '') === catId;
    const groupHistory = cat.status?.group_history;
    const currentHistory = Array.isArray(groupHistory)
      ? [...groupHistory].reverse().find((entry) => String(entry?.group ?? '') === currentGroupId) ?? groupHistory[groupHistory.length - 1]
      : null;
    const baseRank = String(currentHistory?.rank ?? '').toLowerCase();
    const effectiveRank = isLeader ? 'leader' : baseRank === 'leader' && String(clanMetadata?.leader ?? '') !== catId ? 'member' : baseRank;
    const roleKey = isLeader ? 'leader' : effectiveRank;
    const specialSuffix = displaySpecialSuffixes[roleKey];
    const moons = Number(cat.moons);
    const ageKey = !Number.isFinite(moons) || moons <= 0
      ? 'newborn'
      : moons < 6
        ? 'kitten'
        : moons < 12 && displaySpecialSuffixes[roleKey]
          ? roleKey
          : null;
    const suffix = specialSuffix ?? (ageKey ? displaySpecialSuffixes[ageKey] : undefined) ?? cat.name_suffix ?? '';
    return `${cat.name_prefix ?? 'Unnamed'}${suffix}`.trim() || 'Unnamed cat';
  };

  const syncCatRoleRank = (catId: string, rank: 'leader' | 'deputy' | 'medicine cat' | 'member') => {
    const cat = document?.getCat(catId);
    if (!cat) return;

    const status = cat.status && typeof cat.status === 'object' ? { ...cat.status } : {};
    const history = Array.isArray(status.group_history)
      ? status.group_history.map((entry: Record<string, unknown>) => ({ ...entry }))
      : [{ group: '1', moons_as: 0 }];

    const lastEntry = history.length > 0 ? history.length - 1 : 0;
    if (history.length === 0) history.push({ group: '1', moons_as: 0 });
    history[lastEntry] = { ...history[lastEntry], rank };

    updateCat(catId, { ...cat, status: { ...status, group_history: history } });
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
              const nextIds = typeof nextValue === 'string' ? nextValue.split(',') : nextValue;
              if (field === 'mate' && selectedCatId) {
                for (const id of nextIds.filter((catId) => !selectedValues.includes(catId))) setMateStatus(selectedCatId, id, true);
                for (const id of selectedValues.filter((catId) => !nextIds.includes(catId))) setMateStatus(selectedCatId, id, false);
                return;
              }
              handleFieldChange(field, nextIds);
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

  const renderOverview = () => {
    const [lifeStageLabel, lifeStageField] = lifeStageForMoons(selectedCat?.moons);
    const specialCondition = specialConditionForCat(selectedCat);
    const dead = isDeadCat(selectedCat);
    const afterlifeState = afterlifeStateForCat(selectedCat);
    const afterlifeLabel = afterlifeState === 'starclan'
      ? 'StarClan'
      : afterlifeState === 'dark_forest'
        ? 'Dark Forest'
        : afterlifeState === 'unknown_residence'
          ? 'Unknown Residence'
          : null;
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <CatPreview
            cat={selectedCat}
            poseName={typeof selectedCat?.[lifeStageField] === 'string' ? selectedCat[lifeStageField] : undefined}
            label={lifeStageLabel}
            size={144}
          />
          <Box>
            <Typography variant="h5">{selectedCat ? `${selectedCat.name_prefix ?? 'Unnamed'}${selectedCat.name_suffix ?? ''}` : 'Unnamed cat'}</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>ID: {selectedCat?.ID ?? '—'} • Trait: {selectedCat?.trait ?? '—'} • Moons: {selectedCat?.moons ?? 0}</Typography>
            {specialCondition && <Typography variant="body2" color="primary.main">Special condition: {specialCondition}</Typography>}
            {dead && <Typography variant="body2" color="error.main">Status: Dead</Typography>}
            {afterlifeLabel && <Typography variant="body2" color="text.secondary">Afterlife: {afterlifeLabel}</Typography>}
          </Box>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1">Summary</Typography>
          <Typography color="text.secondary">
            Gender: {selectedCat?.gender ?? '—'} • Gender align: {selectedCat?.gender_align ?? '—'} • Experience: {selectedCat?.experience ?? 0}
          </Typography>
        </Paper>
      </Box>
    );
  };

  const renderFamilyTree = () => {
    if (!document || document.cats.length === 0) {
      return <Alert severity="info">Load a clan save to view the family tree.</Alert>;
    }
    return (
      <FamilyTree
        cats={document.cats}
        selectedCatId={selectedCatId}
        focusCatId={familyTreeFocusCatId}
        onDoubleClickCat={(catId) => {
          setSelectedCatId(catId);
          setTabIndex(0);
          setSelectedFile('clan_cats');
        }}
        onSelectCat={setSelectedCatId}
        onRelationshipCommand={handleFamilyRelationshipCommand}
        displayCatLabel={displayCatLabel}
        roleForCat={(catId) => String(clanMetadata?.leader ?? '') === catId
          ? 'Leader'
          : String(clanMetadata?.deputy ?? '') === catId
            ? 'Deputy'
            : String(clanMetadata?.med_cat ?? '') === catId
              ? 'Medicine cat'
              : null}
        specialConditionForCat={specialConditionForCat}
        isDeadCat={(cat) => isDeadCat(cat)}
        poseForCat={(cat) => {
          const [, poseField] = lifeStageForMoons(cat.moons);
          return typeof cat[poseField] === 'string' ? cat[poseField] : undefined;
        }}
      />
    );
  };

  const renderClanAttributes = () => {
    if (!clanMetadata) {
      return <Alert severity="info">This save does not have a companion clan JSON file.</Alert>;
    }

    const catOptions = catList.map((cat) => String(cat.ID)).filter(Boolean);
    const mediatorIds = Array.isArray(clanMetadata.mediated) ? clanMetadata.mediated.map(String) : [];
    const queenIds = catList
      .filter((cat) => {
        const history = cat.status?.group_history;
        const current = Array.isArray(history) ? history[history.length - 1] : null;
        return String(current?.rank ?? '').toLowerCase() === 'queen';
      })
      .map((cat) => String(cat.ID));

    const catLabel = (catId: string) => displayCatLabel(catId);
    const updateRank = (cat: Record<string, any>, rank: string) => {
      const status = cat.status && typeof cat.status === 'object' ? { ...cat.status } : {};
      const history = Array.isArray(status.group_history)
        ? status.group_history.map((entry: Record<string, unknown>) => ({ ...entry }))
        : [{ group: '1', moons_as: 0 }];
      const lastEntry = history.length - 1;
      history[lastEntry] = { ...history[lastEntry], rank };
      updateCat(String(cat.ID), { status: { ...status, group_history: history } });
    };

    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Alert severity="info">These assignments are saved to the companion clan JSON. Queen assignments update the selected cats' current status rank.</Alert>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Clan roles</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Leader</InputLabel>
                <Select
                  value={String(clanMetadata.leader ?? '')}
                  label="Leader"
                  onChange={(event) => {
                    const nextLeaderId = String(event.target.value);
                    const previousLeaderId = String(clanMetadata.leader ?? '');
                    if (previousLeaderId && previousLeaderId !== nextLeaderId) {
                      syncCatRoleRank(previousLeaderId, 'member');
                    }
                    if (nextLeaderId) {
                      syncCatRoleRank(nextLeaderId, 'leader');
                    }
                    updateClanMetadata({ leader: nextLeaderId });
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {catOptions.map((catId) => <MenuItem key={catId} value={catId}>{catLabel(catId)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Deputy</InputLabel>
                <Select
                  value={String(clanMetadata.deputy ?? '')}
                  label="Deputy"
                  onChange={(event) => {
                    const nextDeputyId = String(event.target.value);
                    const previousDeputyId = String(clanMetadata.deputy ?? '');
                    if (previousDeputyId && previousDeputyId !== nextDeputyId) {
                      syncCatRoleRank(previousDeputyId, 'member');
                    }
                    if (nextDeputyId) {
                      syncCatRoleRank(nextDeputyId, 'deputy');
                    }
                    updateClanMetadata({ deputy: nextDeputyId });
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {catOptions.map((catId) => <MenuItem key={catId} value={catId}>{catLabel(catId)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Medicine cat</InputLabel>
                <Select
                  value={String(clanMetadata.med_cat ?? '')}
                  label="Medicine cat"
                  onChange={(event) => {
                    const nextMedCatId = String(event.target.value);
                    const previousMedCatId = String(clanMetadata.med_cat ?? '');
                    if (previousMedCatId && previousMedCatId !== nextMedCatId) {
                      syncCatRoleRank(previousMedCatId, 'member');
                    }
                    if (nextMedCatId) {
                      syncCatRoleRank(nextMedCatId, 'medicine cat');
                    }
                    updateClanMetadata({ med_cat: nextMedCatId });
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {catOptions.map((catId) => <MenuItem key={catId} value={catId}>{catLabel(catId)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Mediators</InputLabel>
                <Select
                  multiple
                  value={mediatorIds}
                  label="Mediators"
                  renderValue={(selected) => (selected as string[]).map(catLabel).join(', ')}
                  onChange={(event) => updateClanMetadata({ mediated: event.target.value as string[] })}
                >
                  {catOptions.map((catId) => <MenuItem key={catId} value={catId}>{catLabel(catId)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Queens</InputLabel>
                <Select
                  multiple
                  value={queenIds}
                  label="Queens"
                  renderValue={(selected) => (selected as string[]).map(catLabel).join(', ')}
                  onChange={(event) => {
                    const selectedIds = new Set(event.target.value as string[]);
                    for (const cat of catList) {
                      const catId = String(cat.ID);
                      const wasQueen = queenIds.includes(catId);
                      const isQueen = selectedIds.has(catId);
                      if (wasQueen !== isQueen) updateRank(cat, isQueen ? 'queen' : 'member');
                    }
                  }}
                >
                  {catOptions.map((catId) => <MenuItem key={catId} value={catId}>{catLabel(catId)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    );
  };

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

  const renderRelationships = () => {
    const relatedCatIds = new Set(selectedRelationships.map((entry) => String(entry.cat_to_id)));
    const addableCats = catList.filter((cat) => String(cat.ID) !== selectedCatId && !isDeadCat(cat) && !relatedCatIds.has(String(cat.ID)));

    const updateEntry = (targetCatId: string, patch: Record<string, unknown>) => {
      saveRelationshipEntries(selectedRelationships.map((entry) => (
        String(entry.cat_to_id) === targetCatId ? { ...entry, ...patch } : entry
      )));
    };

    const removeEntry = (targetCatId: string) => {
      saveRelationshipEntries(selectedRelationships.filter((entry) => String(entry.cat_to_id) !== targetCatId));
    };

    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        {Object.keys(FIELD_GROUPS).filter((group) => group === 'Relationships').map(renderFieldGroup)}
        {document && document.cats.length > 0 && (
          <FamilyTree
            cats={document.cats}
            selectedCatId={selectedCatId}
            focusSelectedCat
            autoScrollToFocus={false}
            allowShowAll={false}
            onSelectCat={setSelectedCatId}
            onRelationshipCommand={handleFamilyRelationshipCommand}
            displayCatLabel={displayCatLabel}
            roleForCat={(catId) => String(clanMetadata?.leader ?? '') === catId
              ? 'Leader'
              : String(clanMetadata?.deputy ?? '') === catId
                ? 'Deputy'
                : String(clanMetadata?.med_cat ?? '') === catId
                  ? 'Medicine cat'
                  : null}
            specialConditionForCat={specialConditionForCat}
            isDeadCat={(cat) => isDeadCat(cat)}
            poseForCat={(cat) => {
              const [, poseField] = lifeStageForMoons(cat.moons);
              return typeof cat[poseField] === 'string' ? cat[poseField] : undefined;
            }}
          />
        )}
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Relationship stats</Typography>
            <Tooltip title="Choose an existing or new cat to view and edit this cat's one-directional relationship with them." arrow enterDelay={300}>
              <span>
                <Autocomplete
                  sx={{ width: 260 }}
                  options={[...selectedRelationships.map((entry) => String(entry.cat_to_id)), ...addableCats.map((cat) => String(cat.ID))]}
                  getOptionLabel={(catId) => displayCatLabel(catId)}
                  value={selectedRelationshipTargetId}
                  onChange={(_, targetCatId) => {
                    if (!targetCatId || !selectedCatId) {
                      setSelectedRelationshipTargetId(null);
                      return;
                    }
                    if (!relatedCatIds.has(targetCatId)) {
                      saveRelationshipEntries([...selectedRelationships, createDefaultRelationshipEntry(selectedCatId, targetCatId)]);
                    }
                    setSelectedRelationshipTargetId(targetCatId);
                  }}
                  renderInput={(params) => <TextField {...params} size="small" label="Select relationship" />}
                  disabled={!selectedCatId || (selectedRelationships.length === 0 && addableCats.length === 0)}
                />
              </span>
            </Tooltip>
          </Stack>
          {(() => {
            const entry = selectedRelationships.find((candidate) => String(candidate.cat_to_id) === selectedRelationshipTargetId);
            if (!entry) return <Typography color="text.secondary">Select a cat above to view or edit their relationship stats.</Typography>;
            const targetCatId = String(entry.cat_to_id);
            return (
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ flexGrow: 1 }} fontWeight="bold">{displayCatLabel(targetCatId)}</Typography>
                  <Tooltip title="Whether these two cats are currently mates. Updates both cats' mate lists and relationship files together." arrow enterDelay={300}>
                    <FormControlLabel
                      control={<Checkbox checked={Boolean(entry.mates)} onChange={(event) => selectedCatId && setMateStatus(selectedCatId, targetCatId, event.target.checked)} />}
                      label="Mates"
                    />
                  </Tooltip>
                  <Tooltip title="Whether the selected cat considers the target cat family." arrow enterDelay={300}>
                    <FormControlLabel
                      control={<Checkbox checked={Boolean(entry.family)} onChange={(event) => updateEntry(targetCatId, { family: event.target.checked })} />}
                      label="Family"
                    />
                  </Tooltip>
                  <Tooltip title="Delete this cat's relationship entry with the target cat. Does not affect the target cat's own relationship file." arrow enterDelay={300}>
                    <span><Button color="error" onClick={() => { removeEntry(targetCatId); setSelectedRelationshipTargetId(null); }}>Remove</Button></span>
                  </Tooltip>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1 }}>
                  {(['romance', 'like', 'respect', 'trust', 'comfort'] as const).map((statField) => {
                    const [min, max] = RELATIONSHIP_FIELD_RANGES[statField];
                    return (
                      <Tooltip key={statField} title={RELATIONSHIP_FIELD_DESCRIPTIONS[statField]} arrow enterDelay={300}>
                        <TextField
                          size="small"
                          type="number"
                          label={labelFor(statField)}
                          value={Number(entry[statField]) || 0}
                          onChange={(event) => {
                            const nextValue = Math.min(max, Math.max(min, Number(event.target.value) || 0));
                            updateEntry(targetCatId, { [statField]: nextValue });
                          }}
                          inputProps={{ min, max }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
                <Tooltip title="Read-only interaction history and which stats have left the neutral tier." arrow enterDelay={300}>
                  <TextField
                    fullWidth
                    disabled
                    multiline
                    minRows={2}
                    label="Log / no longer neutral"
                    value={JSON.stringify({ log: entry.log ?? [], no_longer_neutral: entry.no_longer_neutral ?? [] }, null, 2)}
                    sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                  />
                </Tooltip>
              </Box>
            );
          })()}
        </Box>
      </Box>
    );
  };

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

  const conditionEntriesFor = (section: ConditionSection): Record<string, unknown> => {
    const value = selectedConditions[section];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  };

  const saveConditionSection = (section: ConditionSection, entries: Record<string, unknown>) => {
    if (!selectedCatId) return;
    const nextConditions = { ...selectedConditions, [section]: entries };
    const hasConditions = CONDITION_SECTIONS.some(({ key }) => Object.keys(
      nextConditions[key] && typeof nextConditions[key] === 'object' && !Array.isArray(nextConditions[key])
        ? nextConditions[key] as Record<string, unknown>
        : {},
    ).length > 0);
    updateConditionFile(selectedCatId, hasConditions ? nextConditions : null);
  };

  const saveRelationshipEntries = (entries: Record<string, unknown>[]) => {
    if (!selectedCatId) return;
    updateRelationshipFile(selectedCatId, entries.length > 0 ? entries : null);
  };

  const conditionDetailsFromResource = (section: ConditionSection, name: string): Record<string, unknown> => {
    const definition = resourceCatalog?.conditionDefinitions?.[CONDITION_DEFINITION_TYPES[section]]?.[name];
    const source = definition ?? {};
    const mortalityByAge = source.mortality;
    const mortality = mortalityByAge && typeof mortalityByAge === 'object' && !Array.isArray(mortalityByAge)
      ? Number((mortalityByAge as Record<string, unknown>)[conditionAgeForMoons(selectedCat?.moons)]) || 0
      : 0;
    const severity = typeof source.severity === 'string' ? source.severity : 'minor';
    const risks = Array.isArray(source.risks) ? structuredClone(source.risks) : [];
    const illnessInfectiousness = Array.isArray(source.illness_infectiousness) ? structuredClone(source.illness_infectiousness) : [];

    if (section === 'illnesses') {
      return {
        severity,
        mortality,
        infectiousness: Number(source.infectiousness) || 0,
        duration: Number(source.duration) || 1,
        moon_start: 0,
        risks,
        event_triggered: false,
      };
    }
    if (section === 'injuries') {
      return {
        severity,
        mortality,
        duration: Number(source.duration) || 1,
        moon_start: 0,
        illness_infectiousness: illnessInfectiousness,
        risks,
        complication: null,
        cause_permanent: Array.isArray(source.cause_permanent) ? structuredClone(source.cause_permanent) : [],
        event_triggered: false,
      };
    }
    const bornWith = source.congenital === 'always';
    return {
      severity,
      born_with: bornWith,
      moons_until: bornWith ? Number(source.moons_until) || 0 : 0,
      moon_start: 0,
      mortality,
      illness_infectiousness: illnessInfectiousness,
      risks,
      complication: null,
      event_triggered: false,
    };
  };

  const addCondition = (section: ConditionSection) => {
    const entries = conditionEntriesFor(section);
    const placeholderName = section === 'illnesses' ? 'new illness' : section === 'injuries' ? 'new injury' : 'new permanent condition';
    const baseName = resourceCatalog?.options[CONDITION_OPTION_FIELDS[section]]?.find((option) => !(option in entries)) ?? placeholderName;
    let name = baseName;
    let number = 2;
    while (name in entries) name = `${baseName} ${number++}`;
    const details = conditionDetailsFromResource(section, name);
    saveConditionSection(section, { ...entries, [name]: details });
  };

  const renderConditions = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {CONDITION_SECTIONS.map(({ key, label, addLabel }) => {
        const entries = conditionEntriesFor(key);
        return (
          <Box key={key} sx={{ display: 'grid', gap: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>{label}</Typography>
              <Tooltip title={`Add a new ${label.toLowerCase()} entry to the selected cat.`} arrow enterDelay={300}>
                <span><Button variant="outlined" size="small" onClick={() => addCondition(key)} disabled={!selectedCatId || !resourceDirPath}>{addLabel}</Button></span>
              </Tooltip>
            </Stack>
            {Object.entries(entries).length === 0 ? (
              <Typography color="text.secondary">None</Typography>
            ) : Object.entries(entries).map(([name, details]) => {
              return (
                <Box key={name} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.35fr) minmax(0, 1fr) auto' }, gap: 1, alignItems: 'start', borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                  <Tooltip title={`Choose which ${label.toLowerCase().replace(/s$/, '')} this entry represents.`} arrow enterDelay={300}>
                    <Autocomplete
                      options={optionsForField(
                        resourceCatalog ?? { options: {}, groups: {}, traitRanges: {}, warnings: [], loadedFiles: [] },
                        CONDITION_OPTION_FIELDS[key],
                        name,
                      )}
                      value={name}
                      onChange={(_, value) => {
                        if (!value || value === name) return;
                        const nextEntries = { ...entries, [value]: conditionDetailsFromResource(key, value) };
                        delete nextEntries[name];
                        saveConditionSection(key, nextEntries);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          label="Condition"
                        />
                      )}
                    />
                  </Tooltip>
                  <Tooltip title="Read-only condition details (severity, mortality, duration, risks, herbs) loaded from game resources." arrow enterDelay={300}>
                    <TextField
                      fullWidth
                      disabled
                      multiline
                      minRows={5}
                      label="Condition data"
                      value={JSON.stringify(details, null, 2)}
                      sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                    />
                  </Tooltip>
                  <Tooltip title={`Remove this ${label.toLowerCase().replace(/s$/, '')} from the selected cat.`} arrow enterDelay={300}>
                    <span>
                      <Button color="error" onClick={() => {
                        const nextEntries = { ...entries };
                        delete nextEntries[name];
                        saveConditionSection(key, nextEntries);
                      }}>Remove</Button>
                    </span>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        );
      })}
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
        <Tooltip title="Copy the selected cat's JSON to your clipboard." arrow enterDelay={300}>
          <span><Button
            variant="outlined"
            disabled={!selectedCat}
            onClick={() => {
              void copyTextToClipboard(JSON.stringify(selectedCat, null, 2)).then(() => {
                setClanCatsJsonError(null);
              });
            }}
          >
            Copy Cat JSON
          </Button></span>
        </Tooltip>
        <Tooltip title="Open a dialog to paste JSON and add a new cat or overwrite the selected cat." arrow enterDelay={300}>
          <span><Button
            variant="outlined"
            onClick={() => {
              setImportDraftText('');
              setImportError(null);
              setImportMode('new');
              setImportDialogOpen(true);
            }}
          >
            Import Cat from JSON
          </Button></span>
        </Tooltip>
        <Tooltip title="Validate this editor content as JSON and apply it to the selected cat." arrow enterDelay={300}>
          <span><Button
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
          </Button></span>
        </Tooltip>
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

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import cat from JSON</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          <DialogContentText>
            Paste a cat's JSON below to add it as a new cat or overwrite the currently selected cat. Relationship
            fields (parents, mates, mentors, apprentices) are cleared on import since they refer to IDs from the
            original clan.
          </DialogContentText>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" onClick={() => { void readTextFromClipboard().then(setImportDraftText); }}>
              Paste from Clipboard
            </Button>
            <RadioGroup
              row
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as 'new' | 'overwrite')}
            >
              <FormControlLabel value="new" control={<Radio />} label="Add as new cat" />
              <FormControlLabel
                value="overwrite"
                control={<Radio />}
                label="Overwrite selected cat"
                disabled={!selectedCatId}
              />
            </RadioGroup>
          </Stack>
          {importError && <Alert severity="error">{importError}</Alert>}
          <TextField
            fullWidth
            multiline
            minRows={16}
            placeholder="Paste cat JSON here."
            value={importDraftText}
            onChange={(event) => {
              setImportDraftText(event.target.value);
              setImportError(null);
            }}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              try {
                const parsed = JSON.parse(importDraftText);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                  throw new Error('The pasted cat JSON must be an object.');
                }
                const sanitized = sanitizeImportedCat(parsed);
                if (importMode === 'overwrite') {
                  if (!selectedCatId) throw new Error('Select a cat to overwrite first.');
                  replaceCat(selectedCatId, sanitized);
                } else {
                  addCat(sanitized);
                }
                setImportDialogOpen(false);
                setImportDraftText('');
                setImportError(null);
              } catch (error) {
                setImportError(error instanceof Error ? error.message : 'The pasted cat JSON could not be imported.');
              }
            }}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
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
        return renderConditions();
      case 7:
        return renderJson();
      case 8:
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
            <Typography color="text.secondary">Version 1.1.1</Typography>
            <Typography sx={{ mt: 2 }}>A local desktop editor for ClanGen and LifeGen clan save files.</Typography>
            <Typography sx={{ mt: 2 }}>
              This editor was programmed with AI assistance, but no AI-generated art or story writing is present. The editor itself is made with AI; the game content and creative assets are not.
            </Typography>
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

    if (selectedFile === 'family_tree') {
      return renderFamilyTree();
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
    if (selectedFile === 'conditions') {
      const isEventInjuriesDistribution = selectedConditionResourceFile === EVENT_INJURIES_DISTRIBUTION_FILE;
      const eventInjuriesDistribution = isEventInjuriesDistribution
        ? parseEventInjuriesDistribution(selectedConditionResourceDraft)
        : null;
      const updateEventInjuriesDistribution = (rank: string, severity: string, value: string) => {
        if (!eventInjuriesDistribution || !selectedConditionResourceFile) return;
        const nextDistribution = Object.fromEntries(
          Object.entries(eventInjuriesDistribution).map(([currentRank, severities]) => [
            currentRank,
            { ...severities },
          ]),
        ) as EventInjuriesDistribution;
        nextDistribution[rank][severity] = value === '' ? 0 : Number(value);
        setConditionResourceDraft(selectedConditionResourceFile, JSON.stringify(nextDistribution, null, 2) + '\n');
      };
      const distributionSeverities = eventInjuriesDistribution
        ? Array.from(new Set(Object.values(eventInjuriesDistribution).flatMap((severities) => Object.keys(severities))))
        : [];
      return (
        <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 2, alignContent: 'start', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5">Conditions</Typography>
              <Typography variant="body2" color="text.secondary">dicts/conditions/**/*.json</Typography>
            </Box>
            <Button variant="outlined" onClick={() => { void loadConditionResourceFiles(); }} disabled={!resourceDirPath}>
              Refresh files
            </Button>
            <Button
              variant="contained"
              onClick={() => { void saveConditionResourceFile(); }}
              disabled={!resourceDirPath || !selectedConditionResourceFile || !selectedConditionResourceDirty || Boolean(conditionResourceJsonError)}
            >
              Save resource
            </Button>
          </Stack>
          {!resourceDirPath ? (
            <Alert severity="info">Select a ClanGen or LifeGen data folder to edit condition resources.</Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 2, minHeight: 0 }}>
              {conditionResourceFiles.length === 0 ? (
                <Alert severity="info">No condition JSON files found.</Alert>
              ) : (
                <Tabs
                  value={selectedConditionResourceFile || false}
                  onChange={(_event, value: string) => { void selectConditionResourceFile(value); }}
                  variant="scrollable"
                  scrollButtons="auto"
                  aria-label="Condition resources"
                >
                  {conditionResourceFiles.map((file) => (
                    <Tab
                      key={file}
                      value={file}
                      label={file.replace('dicts/conditions/', '').replace('.json', '')}
                      id={`condition-resource-tab-${file}`}
                      aria-controls="condition-resource-editor"
                    />
                  ))}
                </Tabs>
              )}
              <Box id="condition-resource-editor" role="tabpanel" sx={{ minHeight: 0, overflow: 'auto', display: 'grid', gap: 1, alignContent: 'start' }}>
                {conditionResourceJsonError && <Alert severity="error">{conditionResourceJsonError}</Alert>}
                {isEventInjuriesDistribution && eventInjuriesDistribution ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          {distributionSeverities.map((severity) => <TableCell key={severity} align="right">{severity}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(eventInjuriesDistribution).map(([rank, severities]) => (
                          <TableRow key={rank}>
                            <TableCell component="th" scope="row">{rank}</TableCell>
                            {distributionSeverities.map((severity) => (
                              <TableCell key={severity} align="right">
                                <TextField
                                  size="small"
                                  type="number"
                                  value={severities[severity] ?? 0}
                                  inputProps={{ min: 0, step: 1, 'aria-label': `${rank} ${severity} injury count` }}
                                  onChange={(event) => updateEventInjuriesDistribution(rank, severity, event.target.value)}
                                  sx={{ width: 100 }}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <TextField
                    fullWidth
                    multiline
                    minRows={24}
                    disabled={!selectedConditionResourceFile}
                    placeholder="Choose a condition resource file."
                    value={selectedConditionResourceDraft}
                    onChange={(event) => setConditionResourceDraft(selectedConditionResourceFile, event.target.value)}
                    sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>
      );
    }
    if (selectedFile === 'clan_attributes') return renderClanAttributes();
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
                  ) : orderedCatList.map((cat) => (
                    <MenuItem key={String(cat.ID)} value={String(cat.ID)}>
                      {afterlifeStateForCat(cat) === 'starclan'
                        ? <span style={{ color: '#fff', fontFamily: 'Segoe UI Symbol, sans-serif', marginRight: '0.25em' }}>{'\u2728\uFE0E'}</span>
                        : afterlifeStateForCat(cat) === 'unknown_residence'
                          ? <span style={{ color: '#fff', fontFamily: 'Segoe UI Symbol, sans-serif', marginRight: '0.25em' }}>{'🌫︎'}</span>
                          : afterlifeStateForCat(cat) === 'dark_forest'
                            ? <span style={{ color: '#fff', fontFamily: 'Segoe UI Symbol, sans-serif', marginRight: '0.25em' }}>{'💀︎'}</span>
                            : ''}
                      {String(clanMetadata?.leader ?? '') === String(cat.ID) ? '★ ' : ''}
                      {String(clanMetadata?.deputy ?? '') === String(cat.ID)
                        ? <span style={{ color: '#fff', fontFamily: 'Segoe UI Symbol, sans-serif', marginRight: '0.25em' }}>{'\u272A\uFE0E'}</span>
                        : ''}
                      {String(clanMetadata?.med_cat ?? '') === String(cat.ID)
                        ? <span style={{ color: '#fff', fontFamily: 'Segoe UI Symbol, sans-serif', marginRight: '0.25em' }}>{'\u2695\uFE0E'}</span>
                        : ''}
                      {Array.isArray(clanMetadata?.mediated) && clanMetadata.mediated.map(String).includes(String(cat.ID))
                        ? <span style={{ color: '#fff', fontFamily: 'Segoe UI Symbol, sans-serif', marginRight: '0.25em' }}>{'\u2696\uFE0E'}</span>
                        : ''}
                      {displayCatLabel(String(cat.ID))}
                      {String(clanMetadata?.your_cat ?? '') === String(cat.ID)
                        ? <span style={{ marginLeft: '0.25em' }}>(You)</span>
                        : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </span>
          </Tooltip>
        </Stack>
        <Paper sx={{ p: 1, flexShrink: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tabs sx={{ flexGrow: 1, minWidth: 0 }} value={tabIndex} onChange={(_, next) => setTabIndex(next)} variant="scrollable" scrollButtons="auto">
              {tabLabels.map((label) => (
                <Tab
                  key={label}
                  label={(
                    <Tooltip title={TAB_TOOLTIPS[label] ?? label} arrow enterDelay={300}>
                      <span>{label}</span>
                    </Tooltip>
                  )}
                />
              ))}
            </Tabs>
            <Tooltip title="Open the Family tree view focused on the currently selected cat." arrow enterDelay={300}>
              <span><Button
                variant="outlined"
                onClick={() => {
                  setFamilyTreeFocusCatId(selectedCatId);
                  setSelectedFile('family_tree');
                }}
                disabled={!selectedCatId}
                sx={{ flexShrink: 0 }}
              >
                Show in Family Tree
              </Button></span>
            </Tooltip>
          </Stack>
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
                      <MenuItem key={clan.path} value={clan.path}>{clan.name} ({clan.gameVersion})</MenuItem>
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
                onClick={() => {
                  if (selectedFile === 'names') void saveNamesFile(serializedNamesDraft);
                  else if (selectedFile === 'conditions') void saveConditionResourceFile();
                  else void saveDocument();
                }}
                disabled={selectedFile === 'about' || (selectedFile === 'conditions' && (!selectedConditionResourceDirty || Boolean(conditionResourceJsonError)))}
              >
                Save
              </Button></span>
            </Tooltip>
            <Tooltip title="Undo the last cat or clan attribute edit." arrow enterDelay={300}>
              <span><IconButton aria-label="Undo" onClick={undo} disabled={!canUndo}><UndoIcon /></IconButton></span>
            </Tooltip>
            <Tooltip title="Redo the last undone cat or clan attribute edit." arrow enterDelay={300}>
              <span><IconButton aria-label="Redo" onClick={redo} disabled={!canRedo}><RedoIcon /></IconButton></span>
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
                  selected={selectedFile === 'family_tree'}
                  onClick={() => {
                    setSelectedFile('family_tree');
                    setOpen(false);
                  }}
                >
                  <ListItemText primary="Family tree" secondary="Parent and lineage view" />
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
                <ListItemButton
                  selected={selectedFile === 'conditions'}
                  onClick={() => {
                    setSelectedFile('conditions');
                    setOpen(false);
                  }}
                >
                  <ListItemText primary="Conditions" secondary="dicts/conditions/*.json" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  selected={selectedFile === 'clan_attributes'}
                  onClick={() => {
                    setSelectedFile('clan_attributes');
                    setOpen(false);
                  }}
                >
                  <ListItemText primary="Clan attributes" secondary="clan.json" />
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
