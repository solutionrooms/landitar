const STORAGE_KEY = 'landitar-highscores';
const MAX_ENTRIES = 10;

export interface HighScoreEntry {
  score: number;
  date: string;
}

export function getHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HighScoreEntry[];
  } catch {
    return [];
  }
}

/** Add a score. Returns the 1-based rank, or -1 if it didn't make the table. */
export function addHighScore(score: number): number {
  if (score <= 0) return -1;
  const table = getHighScores();
  const entry: HighScoreEntry = {
    score,
    date: new Date().toISOString().slice(0, 10),
  };
  table.push(entry);
  table.sort((a, b) => b.score - a.score);
  if (table.length > MAX_ENTRIES) table.length = MAX_ENTRIES;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
  } catch { /* storage full or unavailable */ }
  const rank = table.findIndex(e => e === entry);
  return rank >= 0 ? rank + 1 : -1;
}
