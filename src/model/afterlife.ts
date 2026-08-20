import type { Cat } from './catDocument';

export type AfterlifeState = 'living' | 'starclan' | 'dark_forest' | 'unknown_residence';

const starclanBackstories = new Set([
  'dead1', 'dead3', 'dead4', 'dead6', 'dead8', 'dead10', 'dead12', 'dead15',
  'newscguide1', 'newscguide2', 'newscguide3', 'newscguide4',
  'oldstarclan1', 'oldstarclan2', 'oldstarclan3',
  'clan_guide1', 'clan_guide2', 'clan_guide3', 'clan_guide4', 'clan_guide5', 'clan_guide6', 'clan_guide7',
]);

const darkForestBackstories = new Set([
  'dead2', 'dead5', 'dead7', 'dead8', 'dead9', 'dead11', 'dead12', 'dead13', 'dead14',
  'newdfguide1', 'newdfguide2', 'newdfguide3', 'newdfguide4',
  'dfkit1', 'dfkit2',
]);

const allDeadBackstories = new Set([
  ...starclanBackstories,
  ...darkForestBackstories,
  'dead1', 'dead2', 'dead3', 'dead4', 'dead5', 'dead6', 'dead7', 'dead8', 'dead9', 'dead10', 'dead11', 'dead12', 'dead13', 'dead14', 'dead15',
]);

function fromStatusGroupHistory(cat: Cat | null | undefined): AfterlifeState | null {
  if (!cat || typeof cat !== 'object') return null;

  const status = cat.status;
  if (!status || typeof status !== 'object') return null;

  const groupHistory = Array.isArray(status.group_history) ? status.group_history : [];
  const seenGroups: Array<{ group: string; index: number }> = [];

  for (const [index, entry] of groupHistory.entries()) {
    const group = entry && typeof entry === 'object' ? String(entry.group ?? '') : '';
    if (group) seenGroups.push({ group, index });
  }

  if (seenGroups.length > 0) {
    const latest = seenGroups[seenGroups.length - 1];
    if (latest.group === '2') return 'starclan';
    if (latest.group === '3') return 'unknown_residence';
    if (latest.group === '4') return 'dark_forest';
  }

  const standingHistory = Array.isArray(status.standing_history) ? status.standing_history : [];
  for (const entry of standingHistory) {
    const group = entry && typeof entry === 'object' ? String(entry.group ?? '') : '';
    if (group === '2') return 'starclan';
    if (group === '3') return 'unknown_residence';
    if (group === '4') return 'dark_forest';
  }

  return null;
}

export function afterlifeStateForCat(cat: Cat | null | undefined): AfterlifeState {
  if (!cat) return 'living';

  const statusGroupState = fromStatusGroupHistory(cat);
  if (statusGroupState) return statusGroupState;

  const backstory = String(cat.backstory ?? '').toLowerCase();
  const isDead = Boolean(cat.dead) || Boolean(cat.dead_for) || Boolean(cat.faded);
  const inDarkForest = Boolean(cat.df);
  const inUnknownResidence = Boolean(cat.outside) && isDead;

  if (inUnknownResidence) return 'unknown_residence';
  if (inDarkForest) return 'dark_forest';

  if (starclanBackstories.has(backstory)) return 'starclan';
  if (darkForestBackstories.has(backstory)) return 'dark_forest';

  if (isDead && !cat.outside && !cat.df && backstory) {
    return 'starclan';
  }

  return 'living';
}

export function isDeadCat(cat: Cat | null | undefined): boolean {
  if (!cat) return false;

  const statusGroupState = fromStatusGroupHistory(cat);
  if (statusGroupState) return true;

  const backstory = String(cat.backstory ?? '').toLowerCase();
  const hasDeadFlags = Boolean(cat.dead) || Boolean(cat.dead_for) || Boolean(cat.faded);
  return hasDeadFlags || allDeadBackstories.has(backstory) || starclanBackstories.has(backstory) || darkForestBackstories.has(backstory);
}
