import type { Cat } from './catDocument';

export type AfterlifeState = 'living' | 'starclan' | 'dark_forest' | 'unknown_residence';

const deadCatBackstories = new Set([
  'dead1', 'dead2', 'dead3', 'dead4', 'dead5', 'dead6', 'dead8', 'dead9', 'dead10', 'dead11', 'dead12',
  'clan_guide1', 'clan_guide2', 'clan_guide3', 'clan_guide4', 'clan_guide5', 'clan_guide6', 'clan_guide7',
]);

const starclanBackstories = new Set([
  'dead1', 'dead4', 'dead6', 'dead7', 'dead10', 'dead12', 'dead15',
  'clan_guide1', 'clan_guide2', 'clan_guide3', 'clan_guide4', 'clan_guide5', 'clan_guide6', 'clan_guide7',
]);

const darkForestBackstories = new Set([
  'dead2', 'dead5', 'dead9', 'dead11', 'dead12', 'dead13', 'dead14',
]);

const unknownResidenceBackstories = new Set(['dead3', 'dead8']);

export function afterlifeStateForCat(cat: Cat | null | undefined): AfterlifeState {
  const backstory = String(cat?.backstory ?? '').toLowerCase();
  if (unknownResidenceBackstories.has(backstory)) return 'unknown_residence';
  if (starclanBackstories.has(backstory)) return 'starclan';
  if (darkForestBackstories.has(backstory)) return 'dark_forest';
  return 'living';
}

export function isDeadCat(cat: Cat | null | undefined): boolean {
  const backstory = String(cat?.backstory ?? '').toLowerCase();
  return deadCatBackstories.has(backstory) || starclanBackstories.has(backstory) || darkForestBackstories.has(backstory);
}
