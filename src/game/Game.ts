import { BLOCK_COST, COMBAT_WAVES, DIFFICULTY_LABELS } from "./constants";
import {
  type CombatState,
  COMBAT_CELL_SIZE,
  buildShipPosition,
  createCombatState,
  stepCombat,
  updateShipMovement,
} from "./combat";
import {
  canPlaceBlock,
  canSellBlock,
  computeEnergy,
  computeShieldCoverage,
  createInitialGrid,
  placeBlock,
  removeBlock,
} from "./grid";
import { Input } from "./Input";
import {
  clearSave,
  createFreshSave,
  loadSave,
  snapshotFromGame,
  writeSave,
} from "./save";
import type {
  BlockType,
  Difficulty,
  GameMode,
  GridCell,
  Meteorite,
  ProcessorJob,
  Projectile,
  ShieldRuntimeState,
} from "./types";

export interface GameState {
  mode: GameMode;
  money: number;
  grid: GridCell[][];
  energy: number[][];
  shieldCoverage: boolean[][];
  shieldStates: ShieldRuntimeState[];
  selectedBlock: BlockType | null;
  sellMode: boolean;
  shieldUnlocked: boolean;
  campaignsWon: number;
  attackTier: number;
  combatWave: number;
  combatWaveTotal: number;
  combatWaveLabel: string | null;
  combat: CombatState | null;
  combatMeteorites: Meteorite[];
  combatProjectiles: Projectile[];
  combatProcessorJobs: ProcessorJob[];
  combatMoney: number;
  statusMessage: string | null;
  cellSize: number;
  shipX: number;
  shipY: number;
  arenaWidth: number;
  arenaHeight: number;
}

export class Game {
  private onUpdate: (state: GameState) => void;
  private input: Input;
  private rafId: number | null = null;
  private lastTime = 0;
  private mode: GameMode = "build";
  private money = 0;
  private grid: GridCell[][] = createInitialGrid();
  private selectedBlock: BlockType | null = null;
  private sellMode = false;
  private campaignsWon = 0;
  private combat: CombatState | null = null;
  private nextMeteoriteId = 1;
  private statusMessage: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private combatStartMoney = 0;
  private arenaWidth = window.innerWidth;
  private arenaHeight = window.innerHeight;
  private readonly onResize: () => void;

  constructor(onUpdate: (state: GameState) => void) {
    this.onUpdate = onUpdate;
    this.input = new Input();
    this.onResize = () => {
      this.arenaWidth = window.innerWidth;
      this.arenaHeight = window.innerHeight;
      this.emit();
    };
    window.addEventListener("resize", this.onResize);

    const saved = loadSave();
    if (saved) {
      this.money = saved.money;
      this.grid = saved.grid.map((row) => [...row]);
      this.campaignsWon = saved.campaignsWon;
      this.statusMessage = "Прогресс загружен";
    } else {
      const fresh = createFreshSave();
      this.money = fresh.money;
      this.grid = fresh.grid.map((row) => [...row]);
      this.campaignsWon = fresh.campaignsWon;
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.emit();
    this.tick(this.lastTime);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("resize", this.onResize);
    this.input.destroy();
    this.persist();
  }

  selectBlock(type: BlockType): void {
    if (type === "core") {
      return;
    }
    if (type === "shield" && this.campaignsWon < 1) {
      return;
    }
    this.selectedBlock = this.selectedBlock === type ? null : type;
    this.sellMode = false;
    this.emit();
  }

  toggleSellMode(): void {
    if (this.mode !== "build") {
      return;
    }
    this.sellMode = !this.sellMode;
    if (this.sellMode) {
      this.selectedBlock = null;
    }
    this.emit();
  }

  tryPlaceBlock(x: number, y: number): void {
    if (this.mode !== "build" || !this.selectedBlock || this.sellMode) {
      return;
    }
    if (!canPlaceBlock(this.grid, x, y, this.money)) {
      return;
    }

    this.grid = placeBlock(this.grid, x, y, this.selectedBlock);
    this.money -= BLOCK_COST;
    this.scheduleSave();
    this.emit();
  }

  trySellBlock(x: number, y: number): void {
    if (this.mode !== "build" || !this.sellMode) {
      return;
    }
    if (!canSellBlock(this.grid, x, y)) {
      return;
    }

    this.grid = removeBlock(this.grid, x, y);
    this.money += BLOCK_COST;
    this.scheduleSave();
    this.emit();
  }

  startCombatCampaign(): void {
    if (this.mode !== "build") {
      return;
    }

    const attackTier = this.campaignsWon >= 1 ? 2 : 1;
    this.combatStartMoney = this.money;
    this.combat = createCombatState(
      COMBAT_WAVES[0],
      this.arenaWidth,
      this.arenaHeight,
      attackTier,
    );
    this.nextMeteoriteId = 1;
    this.mode = "combat";
    this.statusMessage =
      attackTier >= 2
        ? "Вторая атака! Больше метеоритов и появились большие. WASD — двигать корабль"
        : "Бой начался! WASD — двигать корабль";
    this.scheduleSave();
    this.emit();
  }

  restartGame(message = "Новая игра"): void {
    clearSave();
    const fresh = createFreshSave();
    this.mode = "build";
    this.money = fresh.money;
    this.grid = fresh.grid.map((row) => [...row]);
    this.campaignsWon = fresh.campaignsWon;
    this.selectedBlock = null;
    this.sellMode = false;
    this.combat = null;
    this.statusMessage = message;
    this.emit();
  }

  dismissMessage(): void {
    this.statusMessage = null;
    this.emit();
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.update(dt);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    if (this.mode !== "combat" || !this.combat) {
      return;
    }

    updateShipMovement(this.combat, this.input, dt, this.arenaWidth, this.arenaHeight);

    const idRef = { value: this.nextMeteoriteId };
    const result = stepCombat(
      this.combat,
      this.grid,
      dt,
      idRef,
      this.arenaWidth,
      this.arenaHeight,
    );
    this.nextMeteoriteId = idRef.value;
    this.grid = result.grid;
    this.combat = result.state;

    if (result.finished) {
      if (result.victory) {
        this.money = this.combatStartMoney + this.combat.combatMoney;
        this.campaignsWon += 1;
        if (this.campaignsWon === 1) {
          this.statusMessage = `Победа! +${this.combat.combatMoney} за переработку. Разблокирован блок: Щит!`;
        } else {
          this.statusMessage = `Победа! Все волны пройдены. +${this.combat.combatMoney} за переработку.`;
        }
        this.mode = "build";
        this.combat = null;
        this.scheduleSave();
      } else if (result.defeated) {
        this.restartGame("Главный блок уничтожен! Игра начата заново.");
      }
    }

    this.emit();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.persist();
      this.saveTimer = null;
    }, 300);
  }

  private persist(): void {
    if (this.mode === "combat") {
      return;
    }
    writeSave(snapshotFromGame(this.money, this.grid, this.campaignsWon));
  }

  private getShipPosition(): { shipX: number; shipY: number } {
    if (this.mode === "combat" && this.combat) {
      return { shipX: this.combat.shipX, shipY: this.combat.shipY };
    }
    return buildShipPosition(this.arenaWidth, this.arenaHeight);
  }

  private emit(): void {
    const inCombat = this.mode === "combat" && this.combat !== null;
    const shipPos = this.getShipPosition();
    const energy = computeEnergy(this.grid);
    const shieldStates = inCombat && this.combat ? this.combat.shieldStates : [];
    const attackTier =
      inCombat && this.combat ? this.combat.attackTier : this.campaignsWon >= 1 ? 2 : 1;

    this.onUpdate({
      mode: this.mode,
      money: inCombat ? this.combatStartMoney + (this.combat?.combatMoney ?? 0) : this.money,
      grid: this.grid,
      energy,
      shieldCoverage: computeShieldCoverage(this.grid, energy, shieldStates),
      shieldStates,
      selectedBlock: this.selectedBlock,
      sellMode: this.sellMode,
      shieldUnlocked: this.campaignsWon >= 1,
      campaignsWon: this.campaignsWon,
      attackTier,
      combatWave: inCombat && this.combat ? this.combat.waveIndex + 1 : 0,
      combatWaveTotal: COMBAT_WAVES.length,
      combatWaveLabel: inCombat && this.combat
        ? DIFFICULTY_LABELS[this.combat.difficulty]
        : null,
      combat: this.combat,
      combatMeteorites: this.combat?.meteorites ?? [],
      combatProjectiles: this.combat?.projectiles ?? [],
      combatProcessorJobs: this.combat?.processorJobs ?? [],
      combatMoney: this.combat?.combatMoney ?? 0,
      statusMessage: this.statusMessage,
      cellSize: COMBAT_CELL_SIZE,
      shipX: shipPos.shipX,
      shipY: shipPos.shipY,
      arenaWidth: this.arenaWidth,
      arenaHeight: this.arenaHeight,
    });
  }
}

export type { BlockType, Difficulty };
