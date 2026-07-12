import { BLOCK_COST, BLOCK_ENERGY_REQUIRED, CENTER, GRID_GAP, GRID_SIZE, SHIELD_RADIUS } from "./constants";
import type { BlockType, GridCell, ShieldRuntimeState, Vec2 } from "./types";

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
] as const;

export function createInitialGrid(): GridCell[][] {
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array<GridCell>(GRID_SIZE).fill(null),
  );
  grid[CENTER][CENTER] = "core";
  return grid;
}

export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

export function hasAdjacentBlock(grid: GridCell[][], x: number, y: number): boolean {
  for (const { dx, dy } of DIRECTIONS) {
    const nx = x + dx;
    const ny = y + dy;
    if (isInsideGrid(nx, ny) && grid[ny][nx] !== null) {
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
): boolean {
  if (!isInsideGrid(x, y) || grid[y][x] !== null) {
    return false;
  }
  if (money < BLOCK_COST) {
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
  if (!isInsideGrid(x, y)) {
    return false;
  }
  const cell = grid[y][x];
  return cell !== null && cell !== "core";
}

export function removeBlock(grid: GridCell[][], x: number, y: number): GridCell[][] {
  const next = grid.map((row) => [...row]);
  next[y][x] = null;
  return next;
}

export function computeEnergy(grid: GridCell[][]): number[][] {
  const energy = Array.from({ length: GRID_SIZE }, () =>
    Array<number>(GRID_SIZE).fill(0),
  );

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] !== "power") {
        continue;
      }
      for (const { dx, dy } of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        if (isInsideGrid(nx, ny) && grid[ny][nx] !== null) {
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
  const covered = Array.from({ length: GRID_SIZE }, () =>
    Array<boolean>(GRID_SIZE).fill(false),
  );

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
        if (isInsideGrid(nx, ny)) {
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
  const blocks: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] === type) {
        blocks.push({ x, y });
      }
    }
  }
  return blocks;
}

export function gridPixelSize(cellSize: number): { width: number; height: number } {
  return {
    width: GRID_SIZE * cellSize + (GRID_SIZE - 1) * GRID_GAP,
    height: GRID_SIZE * cellSize + (GRID_SIZE - 1) * GRID_GAP,
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
