import {
  BIG_METEORITE_HITS_TO_DESTROY,
  BIG_METEORITE_SPAWN_CHANCE,
  BULLET_SPEED,
  CANNON_FIRE_INTERVAL_SEC,
  COMBAT_WAVES,
  DIFFICULTY_METEORITE_COUNTS,
  DIFFICULTY_METEORITE_COUNTS_HARD,
  DIFFICULTY_METEORITE_COUNTS_TIER3,
  DIFFICULTY_METEORITE_COUNTS_TIER4,
  HEALER_HEAL_AMOUNT,
  HEALER_HEAL_INTERVAL_SEC,
  HEALER_HEAL_RADIUS,
  HEALER_METEORITE_HP,
  HEALER_METEORITE_SPAWN_CHANCE,
  MACHINEGUN_FIRE_INTERVAL_SEC,
  METEORITE_HIT_RADIUS,
  METEORITE_HITS_TO_DESTROY,
  METEORITE_SPAWN_INTERVAL_MAX,
  METEORITE_SPAWN_INTERVAL_MIN,
  METEORITE_SPEED,
  PROCESSOR_REWARD,
  PROCESSOR_TIME_SEC,
  PROJECTILE_HIT_RADIUS,
  SHIELDER_AURA_RADIUS,
  SHIELDER_DAMAGE_REDUCTION,
  SHIELDER_METEORITE_HP,
  SHIELDER_METEORITE_SPAWN_CHANCE,
  SHIELD_MAX_HP,
  SHIELD_RECHARGE_TIME_SEC,
  SHIP_MOVE_SPEED,
  COMBAT_CELL_SIZE,
  COMBAT_CELL_SIZE_LARGE,
} from "./constants";
import {
  cellWorldPos,
  computeEnergy,
  computeShieldCoverage,
  findShieldProtectingCell,
  gridPixelSize,
  isBlockPowered,
  isInsideGrid,
  listBlocksOfType,
  removeBlock,
  worldToCell,
} from "./grid";
import type { Input } from "./Input";
import type {
  Difficulty,
  GridCell,
  Meteorite,
  MeteoriteKind,
  PendingMeteorite,
  ProcessorJob,
  Projectile,
  ShieldRuntimeState,
} from "./types";

export { COMBAT_CELL_SIZE, COMBAT_CELL_SIZE_LARGE } from "./constants";

export function combatCellSize(gridDimension: number): number {
  return gridDimension >= 7 ? COMBAT_CELL_SIZE_LARGE : COMBAT_CELL_SIZE;
}

export interface CombatState {
  difficulty: Difficulty;
  waveIndex: number;
  attackTier: number;
  gridDimension: number;
  shipX: number;
  shipY: number;
  meteorites: Meteorite[];
  projectiles: Projectile[];
  processorJobs: ProcessorJob[];
  pendingMeteorites: PendingMeteorite[];
  spawnRemaining: number;
  spawnTimer: number;
  cannonCooldowns: Map<string, number>;
  combatMoney: number;
  nextProjectileId: number;
  defeated: boolean;
  victory: boolean;
  message: string | null;
  shieldStates: ShieldRuntimeState[];
}

export function initShieldStates(grid: GridCell[][], energy: number[][]): ShieldRuntimeState[] {
  const states: ShieldRuntimeState[] = [];
  for (const { x, y } of listBlocksOfType(grid, "shield")) {
    if (!isBlockPowered(energy, x, y, "shield")) {
      continue;
    }
    states.push({
      cellX: x,
      cellY: y,
      hp: SHIELD_MAX_HP,
      maxHp: SHIELD_MAX_HP,
      rechargeLeft: 0,
    });
  }
  return states;
}

function syncShieldStates(
  state: CombatState,
  grid: GridCell[][],
  energy: number[][],
): void {
  const next: ShieldRuntimeState[] = [];

  for (const { x, y } of listBlocksOfType(grid, "shield")) {
    if (!isBlockPowered(energy, x, y, "shield")) {
      continue;
    }

    const existing = state.shieldStates.find((s) => s.cellX === x && s.cellY === y);
    if (existing) {
      next.push(existing);
    } else {
      next.push({
        cellX: x,
        cellY: y,
        hp: SHIELD_MAX_HP,
        maxHp: SHIELD_MAX_HP,
        rechargeLeft: 0,
      });
    }
  }

  state.shieldStates = next;
}

function updateShieldRecharge(state: CombatState, dt: number): void {
  for (const shield of state.shieldStates) {
    if (shield.rechargeLeft <= 0) {
      continue;
    }
    shield.rechargeLeft -= dt;
    if (shield.rechargeLeft <= 0) {
      shield.rechargeLeft = 0;
      shield.hp = shield.maxHp;
    }
  }
}

export function createCombatState(
  difficulty: Difficulty,
  arenaWidth: number,
  arenaHeight: number,
  attackTier: number,
  gridDimension: number,
): CombatState {
  const gridSize = gridPixelSize(combatCellSize(gridDimension), gridDimension);

  return {
    difficulty,
    waveIndex: 0,
    attackTier,
    gridDimension,
    shipX: Math.max(24, arenaWidth * 0.08),
    shipY: (arenaHeight - gridSize.height) / 2,
    meteorites: [],
    projectiles: [],
    processorJobs: [],
    pendingMeteorites: [],
    spawnRemaining: getWaveCount(attackTier, difficulty),
    spawnTimer: 0.4,
    cannonCooldowns: new Map(),
    combatMoney: 0,
    nextProjectileId: 1,
    defeated: false,
    victory: false,
    message: null,
    shieldStates: [],
  };
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function getWaveCount(attackTier: number, difficulty: Difficulty): number {
  if (attackTier >= 4) {
    return DIFFICULTY_METEORITE_COUNTS_TIER4[difficulty];
  }
  if (attackTier >= 3) {
    return DIFFICULTY_METEORITE_COUNTS_TIER3[difficulty];
  }
  const table = attackTier >= 2 ? DIFFICULTY_METEORITE_COUNTS_HARD : DIFFICULTY_METEORITE_COUNTS;
  return table[difficulty];
}

function healersEnabled(attackTier: number, waveIndex: number): boolean {
  return attackTier >= 3 || (attackTier >= 2 && waveIndex >= 2);
}

function shieldersEnabled(attackTier: number): boolean {
  return attackTier >= 4;
}

function pickMeteoriteKind(attackTier: number, waveIndex: number): {
  kind: MeteoriteKind;
  hp: number;
  critImmune: boolean;
} {
  const roll = Math.random();
  let threshold = 0;

  if (shieldersEnabled(attackTier)) {
    threshold += SHIELDER_METEORITE_SPAWN_CHANCE;
    if (roll < threshold) {
      return { kind: "shielder", hp: SHIELDER_METEORITE_HP, critImmune: false };
    }
  }

  if (healersEnabled(attackTier, waveIndex)) {
    threshold += HEALER_METEORITE_SPAWN_CHANCE;
    if (roll < threshold) {
      return { kind: "healer", hp: HEALER_METEORITE_HP, critImmune: false };
    }
  }

  if (attackTier >= 2) {
    threshold += BIG_METEORITE_SPAWN_CHANCE;
    if (roll < threshold) {
      return {
        kind: "big",
        hp: BIG_METEORITE_HITS_TO_DESTROY,
        critImmune: true,
      };
    }
  }

  return { kind: "normal", hp: METEORITE_HITS_TO_DESTROY, critImmune: false };
}

function spawnMeteorite(
  id: number,
  arenaWidth: number,
  arenaHeight: number,
  shipX: number,
  shipY: number,
  attackTier: number,
  gridDimension: number,
  waveIndex: number,
): Meteorite {
  const cellSize = combatCellSize(gridDimension);
  const x = arenaWidth + 30 + Math.random() * 120;
  const y = 60 + Math.random() * Math.max(120, arenaHeight - 120);
  const gridSize = gridPixelSize(cellSize, gridDimension);
  const targetX = shipX + gridSize.width / 2;
  const targetY = shipY + gridSize.height / 2;
  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.hypot(dx, dy) || 1;
  const { kind, hp, critImmune } = pickMeteoriteKind(attackTier, waveIndex);

  return {
    id,
    x,
    y,
    vx: (dx / dist) * METEORITE_SPEED,
    vy: (dy / dist) * METEORITE_SPEED,
    hp,
    maxHp: hp,
    kind,
    critImmune,
    healTimer: kind === "healer" ? HEALER_HEAL_INTERVAL_SEC : 0,
  };
}

export function updateShipMovement(
  state: CombatState,
  input: Input,
  dt: number,
  arenaWidth: number,
  arenaHeight: number,
  gridDimension: number,
): void {
  const gridSize = gridPixelSize(combatCellSize(gridDimension), gridDimension);
  const minX = 16;
  const maxX = arenaWidth * 0.55 - gridSize.width;
  const minY = 72;
  const maxY = Math.max(minY, arenaHeight - gridSize.height - 110);

  if (input.isDown("KeyA") || input.isDown("ArrowLeft")) {
    state.shipX -= SHIP_MOVE_SPEED * dt;
  }
  if (input.isDown("KeyD") || input.isDown("ArrowRight")) {
    state.shipX += SHIP_MOVE_SPEED * dt;
  }
  if (input.isDown("KeyW") || input.isDown("ArrowUp")) {
    state.shipY -= SHIP_MOVE_SPEED * dt;
  }
  if (input.isDown("KeyS") || input.isDown("ArrowDown")) {
    state.shipY += SHIP_MOVE_SPEED * dt;
  }

  state.shipX = Math.max(minX, Math.min(maxX, state.shipX));
  state.shipY = Math.max(minY, Math.min(maxY, state.shipY));
}

function findFreeProcessor(
  grid: GridCell[][],
  energy: number[][],
  jobs: ProcessorJob[],
  pending: PendingMeteorite[],
): { x: number; y: number } | null {
  const busy = new Set([
    ...jobs.map((j) => cellKey(j.cellX, j.cellY)),
    ...pending.map((p) => cellKey(p.processorX, p.processorY)),
  ]);

  for (const { x, y } of listBlocksOfType(grid, "processor")) {
    if (!isBlockPowered(energy, x, y, "processor")) {
      continue;
    }
    const key = cellKey(x, y);
    if (!busy.has(key)) {
      return { x, y };
    }
  }
  return null;
}

function assignDestroyedMeteorite(
  state: CombatState,
  grid: GridCell[][],
  energy: number[][],
): void {
  const processor = findFreeProcessor(
    grid,
    energy,
    state.processorJobs,
    state.pendingMeteorites,
  );
  if (processor) {
    state.pendingMeteorites.push({
      processorX: processor.x,
      processorY: processor.y,
    });
  }
}

function startPendingJobs(state: CombatState, grid: GridCell[][], energy: number[][]): void {
  const stillPending: PendingMeteorite[] = [];

  for (const item of state.pendingMeteorites) {
    const busy = state.processorJobs.some(
      (j) => j.cellX === item.processorX && j.cellY === item.processorY,
    );
    if (busy) {
      stillPending.push(item);
      continue;
    }
    if (
      grid[item.processorY][item.processorX] === "processor" &&
      isBlockPowered(energy, item.processorX, item.processorY, "processor")
    ) {
      state.processorJobs.push({
        cellX: item.processorX,
        cellY: item.processorY,
        timeLeft: PROCESSOR_TIME_SEC,
      });
    }
  }

  state.pendingMeteorites = stillPending;
}

function findNearestMeteorite(
  x: number,
  y: number,
  meteorites: Meteorite[],
): Meteorite | null {
  let nearest: Meteorite | null = null;
  let nearestDist = Infinity;

  for (const meteorite of meteorites) {
    const dx = meteorite.x - x;
    const dy = meteorite.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = meteorite;
    }
  }

  return nearest;
}

function aimProjectileAt(
  projectile: Projectile,
  targetX: number,
  targetY: number,
): void {
  const dx = targetX - projectile.x;
  const dy = targetY - projectile.y;
  const dist = Math.hypot(dx, dy) || 1;
  projectile.vx = (dx / dist) * BULLET_SPEED;
  projectile.vy = (dy / dist) * BULLET_SPEED;
}

function isInShielderAura(target: Meteorite, meteorites: Meteorite[]): boolean {
  for (const source of meteorites) {
    if (source.kind !== "shielder" || source.id === target.id) {
      continue;
    }
    const dist = Math.hypot(target.x - source.x, target.y - source.y);
    if (dist <= SHIELDER_AURA_RADIUS) {
      return true;
    }
  }
  return false;
}

function applyProjectileDamage(
  target: Meteorite,
  meteorites: Meteorite[],
  damage: number,
): void {
  let actualDamage = damage;
  if (isInShielderAura(target, meteorites)) {
    actualDamage *= 1 - SHIELDER_DAMAGE_REDUCTION;
  }
  target.hp -= actualDamage;
}

function updateCannons(
  state: CombatState,
  grid: GridCell[][],
  energy: number[][],
  dt: number,
): void {
  const cellSize = combatCellSize(grid.length);

  fireWeaponBlocks(state, grid, energy, dt, "cannon", CANNON_FIRE_INTERVAL_SEC, cellSize);
  fireWeaponBlocks(state, grid, energy, dt, "mgun", MACHINEGUN_FIRE_INTERVAL_SEC, cellSize);
}

function fireWeaponBlocks(
  state: CombatState,
  grid: GridCell[][],
  energy: number[][],
  dt: number,
  blockType: "cannon" | "mgun",
  fireInterval: number,
  cellSize: number,
): void {
  const weapons = listBlocksOfType(grid, blockType);

  for (const { x, y } of weapons) {
    if (!isBlockPowered(energy, x, y, blockType)) {
      continue;
    }

    const key = cellKey(x, y);
    const cooldown = state.cannonCooldowns.get(key) ?? 0;
    const nextCooldown = Math.max(0, cooldown - dt);
    state.cannonCooldowns.set(key, nextCooldown);

    if (nextCooldown > 0 || state.meteorites.length === 0) {
      continue;
    }

    const origin = cellWorldPos(x, y, state.shipX, state.shipY, cellSize);
    const nearest = findNearestMeteorite(origin.x, origin.y, state.meteorites);

    if (!nearest) {
      continue;
    }

    state.projectiles.push({
      id: state.nextProjectileId++,
      x: origin.x,
      y: origin.y,
      vx: 0,
      vy: 0,
    });
    const projectile = state.projectiles[state.projectiles.length - 1];
    aimProjectileAt(projectile, nearest.x, nearest.y);
    state.cannonCooldowns.set(key, fireInterval);
  }
}

function updateProjectiles(state: CombatState, grid: GridCell[][], energy: number[][], dt: number): void {
  const remaining: Projectile[] = [];

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    let hit: Meteorite | null = null;
    for (const meteorite of state.meteorites) {
      const hitRadius =
        meteorite.kind === "big" ? 22 : PROJECTILE_HIT_RADIUS;
      const dist = Math.hypot(meteorite.x - projectile.x, meteorite.y - projectile.y);
      if (dist <= hitRadius) {
        hit = meteorite;
        break;
      }
    }

    if (hit) {
      applyProjectileDamage(hit, state.meteorites, 1);
      if (hit.hp <= 0) {
        state.meteorites = state.meteorites.filter((m) => m.id !== hit!.id);
        assignDestroyedMeteorite(state, grid, energy);
      }
      continue;
    }

    remaining.push(projectile);
  }

  state.projectiles = remaining;
}

function updateProcessorJobs(
  state: CombatState,
  grid: GridCell[][],
  energy: number[][],
  dt: number,
): void {
  const remaining: ProcessorJob[] = [];

  for (const job of state.processorJobs) {
    if (grid[job.cellY][job.cellX] !== "processor") {
      continue;
    }
    if (!isBlockPowered(energy, job.cellX, job.cellY, "processor")) {
      remaining.push(job);
      continue;
    }

    job.timeLeft -= dt;
    if (job.timeLeft <= 0) {
      state.combatMoney += PROCESSOR_REWARD;
    } else {
      remaining.push(job);
    }
  }

  state.processorJobs = remaining;
}

function updateMeteoriteMovement(
  state: CombatState,
  grid: GridCell[][],
  dt: number,
  arenaWidth: number,
  arenaHeight: number,
): GridCell[][] {
  const cellSize = combatCellSize(grid.length);
  let nextGrid = grid.map((row) => [...row]);
  const remaining: Meteorite[] = [];
  const energy = computeEnergy(grid);
  const shielded = computeShieldCoverage(grid, energy, state.shieldStates);

  for (const meteorite of state.meteorites) {
    meteorite.x += meteorite.vx * dt;
    meteorite.y += meteorite.vy * dt;

    if (
      meteorite.x < state.shipX - 80 ||
      meteorite.x > arenaWidth + 200 ||
      meteorite.y < -80 ||
      meteorite.y > arenaHeight + 80
    ) {
      continue;
    }

    const cell = worldToCell(
      meteorite.x,
      meteorite.y,
      state.shipX,
      state.shipY,
      cellSize,
    );

    if (isInsideGrid(cell.x, cell.y, nextGrid) && shielded[cell.y][cell.x]) {
      const shield = findShieldProtectingCell(cell.x, cell.y, state.shieldStates);
      if (shield) {
        shield.hp -= meteorite.hp;
        if (shield.hp <= 0) {
          shield.hp = 0;
          shield.rechargeLeft = SHIELD_RECHARGE_TIME_SEC;
        }
      }
      continue;
    }

    if (isInsideGrid(cell.x, cell.y, nextGrid) && nextGrid[cell.y][cell.x] !== null) {
      const blockCenter = cellWorldPos(
        cell.x,
        cell.y,
        state.shipX,
        state.shipY,
        cellSize,
      );
      const hitDist = Math.hypot(
        meteorite.x - blockCenter.x,
        meteorite.y - blockCenter.y,
      );

      if (hitDist <= METEORITE_HIT_RADIUS) {
        if (nextGrid[cell.y][cell.x] === "core") {
          state.defeated = true;
          state.message = "Поражение! Метеорит попал в главный блок. Деньги за бой не сохранены.";
        }
        nextGrid = removeBlock(nextGrid, cell.x, cell.y);
        continue;
      }
    }

    remaining.push(meteorite);
  }

  state.meteorites = remaining;
  return nextGrid;
}

function tryAdvanceWaveIfNeeded(state: CombatState): void {
  if (state.spawnRemaining > 0) {
    return;
  }
  if (state.waveIndex >= COMBAT_WAVES.length - 1) {
    return;
  }

  state.waveIndex += 1;
  const nextDifficulty = COMBAT_WAVES[state.waveIndex];
  state.difficulty = nextDifficulty;
  state.spawnRemaining = getWaveCount(state.attackTier, nextDifficulty);
  state.spawnTimer = 0;
}

function updateHealerMeteors(state: CombatState, dt: number): void {
  for (const healer of state.meteorites) {
    if (healer.kind !== "healer") {
      continue;
    }

    healer.healTimer -= dt;
    if (healer.healTimer > 0) {
      continue;
    }

    healer.healTimer = HEALER_HEAL_INTERVAL_SEC;

    for (const target of state.meteorites) {
      if (target.id === healer.id) {
        continue;
      }
      const dist = Math.hypot(target.x - healer.x, target.y - healer.y);
      if (dist <= HEALER_HEAL_RADIUS) {
        target.hp = Math.min(target.maxHp, target.hp + HEALER_HEAL_AMOUNT);
      }
    }
  }
}

function updateSpawning(
  state: CombatState,
  dt: number,
  nextId: { value: number },
  arenaWidth: number,
  arenaHeight: number,
  gridDimension: number,
): void {
  tryAdvanceWaveIfNeeded(state);

  if (state.spawnRemaining <= 0) {
    return;
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) {
    return;
  }

  state.meteorites.push(
    spawnMeteorite(
      nextId.value++,
      arenaWidth,
      arenaHeight,
      state.shipX,
      state.shipY,
      state.attackTier,
      gridDimension,
      state.waveIndex,
    ),
  );
  state.spawnRemaining -= 1;

  if (state.spawnRemaining <= 0) {
    const waveBefore = state.waveIndex;
    tryAdvanceWaveIfNeeded(state);
    if (state.waveIndex > waveBefore && state.spawnRemaining > 0) {
      state.spawnTimer = 0;
      return;
    }
  }

  if (state.spawnRemaining > 0) {
    state.spawnTimer =
      METEORITE_SPAWN_INTERVAL_MIN +
      Math.random() * (METEORITE_SPAWN_INTERVAL_MAX - METEORITE_SPAWN_INTERVAL_MIN);
  }
}

export interface CombatStepResult {
  grid: GridCell[][];
  state: CombatState;
  finished: boolean;
  victory: boolean;
  defeated: boolean;
}

export function stepCombat(
  state: CombatState,
  grid: GridCell[][],
  dt: number,
  nextMeteoriteId: { value: number },
  arenaWidth: number,
  arenaHeight: number,
): CombatStepResult {
  if (state.victory || state.defeated) {
    return {
      grid,
      state,
      finished: true,
      victory: state.victory,
      defeated: state.defeated,
    };
  }

  updateSpawning(state, dt, nextMeteoriteId, arenaWidth, arenaHeight, grid.length);

  const energy = computeEnergy(grid);
  if (state.shieldStates.length === 0) {
    state.shieldStates = initShieldStates(grid, energy);
  }
  syncShieldStates(state, grid, energy);
  updateShieldRecharge(state, dt);

  startPendingJobs(state, grid, energy);
  updateCannons(state, grid, energy, dt);
  updateProjectiles(state, grid, energy, dt);
  updateProcessorJobs(state, grid, energy, dt);
  updateHealerMeteors(state, dt);

  let nextGrid = updateMeteoriteMovement(state, grid, dt, arenaWidth, arenaHeight);

  if (state.defeated) {
    state.processorJobs = [];
    state.pendingMeteorites = [];
    state.projectiles = [];
    return {
      grid: nextGrid,
      state,
      finished: true,
      victory: false,
      defeated: true,
    };
  }

  const allWavesSpawned =
    state.waveIndex >= COMBAT_WAVES.length - 1 && state.spawnRemaining === 0;
  const allDead = state.meteorites.length === 0;
  const jobsDone =
    state.processorJobs.length === 0 && state.pendingMeteorites.length === 0;

  if (allWavesSpawned && allDead && jobsDone) {
    state.projectiles = [];
    state.victory = true;
    state.message = `Победа! +${state.combatMoney} за переработку.`;
    return {
      grid: nextGrid,
      state,
      finished: true,
      victory: true,
      defeated: false,
    };
  }

  return {
    grid: nextGrid,
    state,
    finished: false,
    victory: false,
    defeated: false,
  };
}

export function buildShipPosition(
  arenaWidth: number,
  arenaHeight: number,
  gridDimension: number,
): { shipX: number; shipY: number } {
  const gridSize = gridPixelSize(combatCellSize(gridDimension), gridDimension);
  return {
    shipX: Math.max(24, arenaWidth * 0.06),
    shipY: (arenaHeight - gridSize.height) / 2,
  };
}

export function centeredShipPosition(
  arenaWidth: number,
  arenaHeight: number,
  gridDimension: number,
): { shipX: number; shipY: number } {
  const gridSize = gridPixelSize(combatCellSize(gridDimension), gridDimension);
  return {
    shipX: (arenaWidth - gridSize.width) / 2,
    shipY: (arenaHeight - gridSize.height) / 2,
  };
}
