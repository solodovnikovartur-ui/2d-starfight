export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type BlockType = "core" | "processor" | "cannon" | "power" | "shield";

export type GridCell = BlockType | null;

export type Difficulty = keyof typeof import("./constants").DIFFICULTY_METEORITE_COUNTS;

export type MeteoriteKind = "normal" | "big";

export type GameMode = "build" | "combat";

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Meteorite {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  kind: MeteoriteKind;
  critImmune: boolean;
}

export interface ProcessorJob {
  cellX: number;
  cellY: number;
  timeLeft: number;
}

export interface PendingMeteorite {
  processorX: number;
  processorY: number;
}

export interface ShieldRuntimeState {
  cellX: number;
  cellY: number;
  hp: number;
  maxHp: number;
  rechargeLeft: number;
}

export interface SaveData {
  version: number;
  money: number;
  grid: GridCell[][];
  campaignsWon: number;
}
