import {
  BLOCK_ENERGY_REQUIRED,
  CENTER,
  getBlockCost,
  GRID_GAP,
  GRID_SIZE,
  GRID_SIZE_LARGE,
  SHIELD_RADIUS,
} from "./constants";
import type { BlockType, GridCell, ShieldRuntimeState, Vec2 } from "./types";

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
] as const;

export function getGridDimension(grid: GridCell[][]): number {
  return grid.length;
}

export function createInitialGrid(): GridCell[][] {
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array<GridCell>(GRID_SIZE).fill(null),
  );
  grid[CENTER][CENTER] = "core";
  return grid;
}

export function expandGrid(grid: GridCell[][]): GridCell[][] {
  const oldSize = grid.length;
  if (oldSize >= GRID_SIZE_LARGE) {
    return grid.map((row) => [...row]);
  }

  const newSize = GRID_SIZE_LARGE;
  const offset = Math.floor((newSize - oldSize) / 2);
  const next = Array.from({ length: newSize }, () =>
    Array<GridCell>(newSize).fill(null),
  );

  for (let y = 0; y < oldSize; y++) {
    for (let x = 0; x < oldSize; x++) {
      next[y + offset][x + offset] = grid[y][x];
    }
  }

  return next;
}

export function ensureGridSizeForCampaigns(
  grid: GridCell[][],
  campaignsWon: number,
): GridCell[][] {
  if (campaignsWon >= 2 && grid.length < GRID_SIZE_LARGE) {
    return expandGrid(grid);
  }
  return grid.map((row) => [...row]);
}

export function isInsideGrid(x: number, y: number, grid: GridCell[][]): boolean {
  const size = grid.length;
  return x >= 0 && x < size && y >= 0 && y < size;
}

export function hasAdjacentBlock(grid: GridCell[][], x: number, y: number): boolean {
  for (const { dx, dy } of DIRECTIONS) {
    const nx = x + dx;
    const ny = y + dy;
    if (isInsideGrid(nx, ny, grid) && grid[ny][nx] !== null) {
      return true;
    }
  }
  return false;
}

export function canPlaceBlock(
  grid: GridCell[][],
  x: number,
  y: number,
  money: number,
  blockType: BlockType,
): boolean {
  if (!isInsideGrid(x, y, grid) || grid[y][x] !== null) {
    return false;
  }
  if (money < getBlockCost(blockType)) {
    return false;
  }
  return hasAdjacentBlock(grid, x, y);
}

export function placeBlock(
  grid: GridCell[][],
  x: number,
  y: number,
  type: BlockType,
): GridCell[][] {
  const next = grid.map((row) => [...row]);
  next[y][x] = type;
  return next;
}

export function canSellBlock(grid: GridCell[][], x: number, y: number): boolean {
  if (!isInsideGrid(x, y, grid)) {
    return false;
  }
  const cell = grid[y][x];
  return cell !== null && cell !== "core";
}

export function removeBlock(grid: GridCell[][], x: number, y: number): GridCell[][] {
  const next = grid.map((row) => [...row]);
  next[y][x] = null;
  return pruneDisconnectedBlocks(next);
}

function findCorePosition(grid: GridCell[][]): { x: number; y: number } | null {
  const size = grid.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x] === "core") {
        return { x, y };
      }
    }
  }
  return null;
}

export function pruneDisconnectedBlocks(grid: GridCell[][]): GridCell[][] {
  const core = findCorePosition(grid);
  if (!core) {
    return grid.map((row) => [...row]);
  }

  const size = grid.length;
  const connected = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const queue: { x: number; y: number }[] = [core];
  connected[core.y][core.x] = true;

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (
        !isInsideGrid(nx, ny, grid) ||
        grid[ny][nx] === null ||
        connected[ny][nx]
      ) {
        continue;
      }
      connected[ny][nx] = true;
      queue.push({ x: nx, y: ny });
    }
  }

  const next = grid.map((row) => [...row]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (next[y][x] !== null && !connected[y][x]) {
        next[y][x] = null;
      }
    }
  }
  return next;
}

export function computeEnergy(grid: GridCell[][]): number[][] {
  const size = grid.length;
  const energy = Array.from({ length: size }, () => Array<number>(size).fill(0));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x] !== "power") {
        continue;
      }
      for (const { dx, dy } of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        if (isInsideGrid(nx, ny, grid) && grid[ny][nx] !== null) {
          energy[ny][nx] += 1;
        }
      }
    }
  }

  return energy;
}

export function isBlockPowered(
  energy: number[][],
  x: number,
  y: number,
  blockType: BlockType,
): boolean {
  const required = BLOCK_ENERGY_REQUIRED[blockType];
  if (required <= 0) {
    return true;
  }
  return energy[y][x] >= required;
}

export function computeShieldCoverage(
  grid: GridCell[][],
  energy: number[][],
  shieldStates?: ShieldRuntimeState[],
): boolean[][] {
  const size = grid.length;
  const covered = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const shields = listBlocksOfType(grid, "shield");
  for (const { x, y } of shields) {
    if (!isBlockPowered(energy, x, y, "shield")) {
      continue;
    }

    const runtime = shieldStates?.find((s) => s.cellX === x && s.cellY === y);
    if (runtime && (runtime.hp <= 0 || runtime.rechargeLeft > 0)) {
      continue;
    }

    for (let dy = -SHIELD_RADIUS; dy <= SHIELD_RADIUS; dy++) {
      for (let dx = -SHIELD_RADIUS; dx <= SHIELD_RADIUS; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (isInsideGrid(nx, ny, grid)) {
          covered[ny][nx] = true;
        }
      }
    }
  }

  return covered;
}

export function findShieldProtectingCell(
  cellX: number,
  cellY: number,
  shieldStates: ShieldRuntimeState[],
): ShieldRuntimeState | null {
  for (const shield of shieldStates) {
    if (shield.hp <= 0 || shield.rechargeLeft > 0) {
      continue;
    }
    if (
      Math.abs(cellX - shield.cellX) <= SHIELD_RADIUS &&
      Math.abs(cellY - shield.cellY) <= SHIELD_RADIUS
    ) {
      return shield;
    }
  }
  return null;
}

export function listBlocksOfType(
  grid: GridCell[][],
  type: BlockType,
): { x: number; y: number }[] {
  const size = grid.length;
  const blocks: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x] === type) {
        blocks.push({ x, y });
      }
    }
  }
  return blocks;
}

export function gridPixelSize(
  cellSize: number,
  gridDimension: number,
): { width: number; height: number } {
  return {
    width: gridDimension * cellSize + (gridDimension - 1) * GRID_GAP,
    height: gridDimension * cellSize + (gridDimension - 1) * GRID_GAP,
  };
}

export function cellWorldPos(
  cellX: number,
  cellY: number,
  shipX: number,
  shipY: number,
  cellSize: number,
): Vec2 {
  return {
    x: shipX + cellX * (cellSize + GRID_GAP) + cellSize / 2,
    y: shipY + cellY * (cellSize + GRID_GAP) + cellSize / 2,
  };
}

export function worldToCell(
  wx: number,
  wy: number,
  shipX: number,
  shipY: number,
  cellSize: number,
): { x: number; y: number } {
  const localX = wx - shipX;
  const localY = wy - shipY;
  return {
    x: Math.floor(localX / (cellSize + GRID_GAP)),
    y: Math.floor(localY / (cellSize + GRID_GAP)),
  };
}

export function gridToWorld(x: number, y: number, cellSize: number): Vec2 {
  return {
    x: x * (cellSize + GRID_GAP) + cellSize / 2,
    y: y * (cellSize + GRID_GAP) + cellSize / 2,
  };
}
