import { COMBAT_WAVES, DIFFICULTY_LABELS, STATUS_MESSAGE_DURATION_MS, getBlockCost } from "./constants";
import {
  type CombatState,
  buildShipPosition,
  combatCellSize,
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
  ensureGridSizeForCampaigns,
  expandGrid,
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
  mgunUnlocked: boolean;
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
  gridSize: number;
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
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
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
      this.campaignsWon = saved.campaignsWon;
      this.grid = ensureGridSizeForCampaigns(saved.grid, this.campaignsWon);
      this.statusMessage = "Прогресс загружен";
      this.persistIfNeeded();
    } else {
      const fresh = createFreshSave();
      this.money = fresh.money;
      this.grid = fresh.grid.map((row) => [...row]);
      this.campaignsWon = fresh.campaignsWon;
    }
  }

  start(): void {
    this.syncProgress();
    this.armStatusMessageDismiss();
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
    if (this.messageTimer !== null) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.persist();
  }

  selectBlock(type: BlockType): void {
    if (type === "core") {
      return;
    }
    if (type === "shield" && this.campaignsWon < 1) {
      return;
    }
    if (type === "mgun" && this.campaignsWon < 3) {
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
    if (!canPlaceBlock(this.grid, x, y, this.money, this.selectedBlock)) {
      return;
    }

    this.grid = placeBlock(this.grid, x, y, this.selectedBlock);
    this.money -= getBlockCost(this.selectedBlock);
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

    const before = this.grid.map((row) => [...row]);
    this.grid = removeBlock(this.grid, x, y);

    let refund = 0;
    for (let py = 0; py < before.length; py++) {
      for (let px = 0; px < before.length; px++) {
        const block = before[py][px];
        if (block && this.grid[py][px] === null) {
          refund += getBlockCost(block);
        }
      }
    }
    this.money += refund;
    this.scheduleSave();
    this.emit();
  }

  startCombatCampaign(): void {
    if (this.mode !== "build") {
      return;
    }

    const attackTier = this.getNextAttackTier();
    this.combatStartMoney = this.money;
    this.combat = createCombatState(
      COMBAT_WAVES[0],
      this.arenaWidth,
      this.arenaHeight,
      attackTier,
      this.grid.length,
    );
    this.nextMeteoriteId = 1;
    this.mode = "combat";
    if (attackTier >= 4) {
      this.setStatusMessage(
        "Четвёртая атака! Щитовики снижают урон метеоритам в радиусе. WASD — двигать корабль",
      );
    } else if (attackTier >= 3) {
      this.setStatusMessage(
        "Третья атака! Появились хилеры — лечат метеориты рядом. WASD — двигать корабль",
      );
    } else if (attackTier >= 2) {
      this.setStatusMessage(
        "Вторая атака! Большие метеориты. С 3-й волны — хилеры. WASD — двигать корабль",
      );
    } else {
      this.setStatusMessage("Бой начался! WASD — двигать корабль");
    }
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
    this.setStatusMessage(message);
    this.emit();
  }

  dismissMessage(): void {
    if (this.messageTimer !== null) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.statusMessage = null;
    this.emit();
  }

  private setStatusMessage = (message: string | null): void => {
    if (this.messageTimer !== null) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.statusMessage = message;
    this.armStatusMessageDismiss();
  };

  private armStatusMessageDismiss = (): void => {
    if (this.statusMessage === null) {
      return;
    }
    if (this.messageTimer !== null) {
      clearTimeout(this.messageTimer);
    }
    this.messageTimer = setTimeout(() => {
      this.statusMessage = null;
      this.messageTimer = null;
      this.emit();
    }, STATUS_MESSAGE_DURATION_MS);
  };

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

    updateShipMovement(
      this.combat,
      this.input,
      dt,
      this.arenaWidth,
      this.arenaHeight,
      this.grid.length,
    );

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
          this.setStatusMessage(
            `Победа! +${this.combat.combatMoney} за переработку. Разблокирован блок: Щит!`,
          );
        } else if (this.campaignsWon === 2) {
          this.grid = expandGrid(this.grid);
          this.persistIfNeeded();
          this.setStatusMessage(
            `Победа! +${this.combat.combatMoney} за переработку. Поле строительства расширено до 7×7!`,
          );
        } else if (this.campaignsWon === 3) {
          this.setStatusMessage(
            `Победа! +${this.combat.combatMoney} за переработку. Разблокирован блок: Пулемёт!`,
          );
        } else {
          this.setStatusMessage(
            `Победа! Все волны пройдены. +${this.combat.combatMoney} за переработку.`,
          );
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

  private syncProgress(): void {
    const nextGrid = ensureGridSizeForCampaigns(this.grid, this.campaignsWon);
    if (nextGrid.length !== this.grid.length) {
      this.grid = nextGrid;
      this.persistIfNeeded();
    }
  }

  private persistIfNeeded(): void {
    if (this.mode === "combat") {
      return;
    }
    writeSave(snapshotFromGame(this.money, this.grid, this.campaignsWon));
  }

  private getNextAttackTier(): number {
    if (this.campaignsWon >= 3) {
      return 4;
    }
    if (this.campaignsWon >= 2) {
      return 3;
    }
    if (this.campaignsWon >= 1) {
      return 2;
    }
    return 1;
  }

  private getShipPosition(): { shipX: number; shipY: number } {
    if (this.mode === "combat" && this.combat) {
      return { shipX: this.combat.shipX, shipY: this.combat.shipY };
    }
    return buildShipPosition(this.arenaWidth, this.arenaHeight, this.grid.length);
  }

  private emit(): void {
    this.syncProgress();
    const inCombat = this.mode === "combat" && this.combat !== null;
    const shipPos = this.getShipPosition();
    const energy = computeEnergy(this.grid);
    const shieldStates = inCombat && this.combat ? this.combat.shieldStates : [];
    const attackTier =
      inCombat && this.combat ? this.combat.attackTier : this.getNextAttackTier();

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
      mgunUnlocked: this.campaignsWon >= 3,
      campaignsWon: this.campaignsWon,
      attackTier,
      gridSize: this.grid.length,
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
      cellSize: combatCellSize(this.grid.length),
      shipX: shipPos.shipX,
      shipY: shipPos.shipY,
      arenaWidth: this.arenaWidth,
      arenaHeight: this.arenaHeight,
    });
  }
}

export type { BlockType, Difficulty };
