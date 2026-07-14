import { SAVE_KEY, SAVE_VERSION, START_MONEY } from "./constants";
import { createInitialGrid, ensureGridSizeForCampaigns } from "./grid";
import type { GridCell, SaveData } from "./types";

export function createFreshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    money: START_MONEY,
    grid: createInitialGrid(),
    campaignsWon: 0,
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (!Array.isArray(data.grid)) {
      return null;
    }
    if (data.version !== SAVE_VERSION && data.version !== 1 && data.version !== 2 && data.version !== 3) {
      return null;
    }
    const campaignsWon = data.campaignsWon ?? 0;
    const grid = ensureGridSizeForCampaigns(data.grid as GridCell[][], campaignsWon);
    return {
      version: SAVE_VERSION,
      money: data.money ?? START_MONEY,
      grid,
      campaignsWon,
    };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function snapshotFromGame(
  money: number,
  grid: GridCell[][],
  campaignsWon: number,
): SaveData {
  return {
    version: SAVE_VERSION,
    money,
    grid: grid.map((row) => [...row]),
    campaignsWon,
  };
}
