import type { BlockType } from "./types";

export const GRID_SIZE = 5;
export const GRID_SIZE_LARGE = 7;
export const CENTER = 2;
export const LARGE_CENTER = 3;
export const START_MONEY = 5000;
export const BLOCK_COST = 500;
export const PROCESSOR_TIME_SEC = 5;
export const PROCESSOR_REWARD = 50;
export const METEORITE_HITS_TO_DESTROY = 5;
export const BIG_METEORITE_HITS_TO_DESTROY = 10;
export const BIG_METEORITE_SPAWN_CHANCE = 0.28;
export const HEALER_METEORITE_HP = 4;
export const HEALER_METEORITE_SPAWN_CHANCE = 0.15;
export const HEALER_HEAL_INTERVAL_SEC = 2;
export const HEALER_HEAL_AMOUNT = 1;
export const HEALER_HEAL_RADIUS = 120;
export const CANNON_FIRE_INTERVAL_SEC = 0.7;
export const MACHINEGUN_COST = 1000;
export const MACHINEGUN_FIRE_INTERVAL_SEC = CANNON_FIRE_INTERVAL_SEC / 3;
export const SHIELDER_METEORITE_HP = 5;
export const SHIELDER_METEORITE_SPAWN_CHANCE = 0.14;
export const SHIELDER_AURA_RADIUS = 120;
export const SHIELDER_DAMAGE_REDUCTION = 0.33;
export const METEORITE_SPEED = 28;
export const METEORITE_HIT_RADIUS = 28;
export const SHIP_MOVE_SPEED = 280;
export const BULLET_SPEED = 520;
export const PROJECTILE_HIT_RADIUS = 14;
export const GRID_GAP = 4;
export const COMBAT_CELL_SIZE = 72;
export const COMBAT_CELL_SIZE_LARGE = 56;
export const METEORITE_SPAWN_INTERVAL_MIN = 0.35;
export const METEORITE_SPAWN_INTERVAL_MAX = 0.7;
export const SHIELD_RADIUS = 1;
export const SHIELD_MAX_HP = 30;
export const SHIELD_RECHARGE_TIME_SEC = 8;
export const SAVE_KEY = "2d-starfight-save";
export const SAVE_VERSION = 4;
export const STATUS_MESSAGE_DURATION_MS = 4000;

export const BLOCK_ENERGY_REQUIRED = {
  core: 0,
  processor: 1,
  cannon: 1,
  mgun: 1,
  power: 0,
  shield: 2,
} as const;

export const DIFFICULTY_METEORITE_COUNTS = {
  low: 5,
  medium: 12,
  high: 25,
} as const;

export const DIFFICULTY_METEORITE_COUNTS_HARD = {
  low: 9,
  medium: 20,
  high: 38,
} as const;

export const DIFFICULTY_METEORITE_COUNTS_TIER3 = {
  low: 12,
  medium: 26,
  high: 45,
} as const;

export const DIFFICULTY_METEORITE_COUNTS_TIER4 = {
  low: 14,
  medium: 32,
  high: 52,
} as const;

export const COMBAT_WAVES = ["low", "medium", "high"] as const;

export const DIFFICULTY_LABELS = {
  low: "Мало метеоритов",
  medium: "Средне",
  high: "Много метеоритов",
} as const;

export const BLOCK_LABELS = {
  core: "Ядро",
  processor: "Переработчик",
  cannon: "Автопушка",
  mgun: "Пулемёт",
  power: "Питание",
  shield: "Щит",
} as const;

export function getBlockCost(type: BlockType): number {
  if (type === "mgun") {
    return MACHINEGUN_COST;
  }
  return BLOCK_COST;
}
