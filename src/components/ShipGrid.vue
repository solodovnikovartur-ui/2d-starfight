<script setup lang="ts">
import { computed } from "vue";
import { BLOCK_ENERGY_REQUIRED, BLOCK_LABELS, PROCESSOR_TIME_SEC, SHIELD_RECHARGE_TIME_SEC } from "../game/constants";
import type { GameState } from "../game/Game";
import type { GridCell } from "../game/types";
import BlockArt from "./BlockArt.vue";

const props = defineProps<{
  state: GameState;
}>();

const emit = defineEmits<{
  place: [x: number, y: number];
  sell: [x: number, y: number];
}>();

const isBuildMode = computed(() => props.state.mode === "build");

const cells = computed(() => {
  const size = props.state.grid.length;
  const list: { x: number; y: number; cell: GridCell }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = props.state.grid[y][x];
      if (!isBuildMode.value && cell === null) {
        continue;
      }
      list.push({ x, y, cell });
    }
  }
  return list;
});

function cellGridStyle(x: number, y: number): Record<string, string> {
  if (isBuildMode.value) {
    return {};
  }
  return {
    gridColumn: `${x + 1}`,
    gridRow: `${y + 1}`,
  };
}

function isPowered(cell: GridCell, x: number, y: number): boolean {
  if (!cell || cell === "power") return false;
  if (cell === "core") return true;
  return props.state.energy[y][x] >= BLOCK_ENERGY_REQUIRED[cell];
}

function cellClass(cell: GridCell, x: number, y: number): Record<string, boolean> {
  const powered = isPowered(cell, x, y);
  return {
    "ship-cell--empty": cell === null,
    "ship-cell--core": cell === "core",
    "ship-cell--processor": cell === "processor",
    "ship-cell--cannon": cell === "cannon",
    "ship-cell--mgun": cell === "mgun",
    "ship-cell--power": cell === "power",
    "ship-cell--shield": cell === "shield",
    "ship-cell--shield-recharging": cell === "shield" && isShieldRecharging(x, y),
    "ship-cell--powered": powered && cell !== null && cell !== "power",
    "ship-cell--unpowered": !powered && cell !== null && cell !== "power" && cell !== "core",
    "ship-cell--shielded": props.state.shieldCoverage[y][x],
    "ship-cell--placeable":
      isBuildMode.value &&
      cell === null &&
      props.state.selectedBlock !== null &&
      !props.state.sellMode,
    "ship-cell--sellable":
      isBuildMode.value && props.state.sellMode && cell !== null && cell !== "core",
  };
}

function label(cell: GridCell): string {
  if (!cell) return "";
  return BLOCK_LABELS[cell];
}

function isCellDisabled(cell: GridCell): boolean {
  if (!isBuildMode.value) {
    return true;
  }
  if (props.state.sellMode) {
    return cell === null || cell === "core";
  }
  return cell !== null;
}

function onCellClick(x: number, y: number, cell: GridCell): void {
  if (!isBuildMode.value) return;
  if (props.state.sellMode && cell !== null && cell !== "core") {
    emit("sell", x, y);
    return;
  }
  emit("place", x, y);
}

function processorProgress(x: number, y: number): number | null {
  const job = props.state.combatProcessorJobs.find(
    (j) => j.cellX === x && j.cellY === y,
  );
  if (!job) return null;
  return 1 - job.timeLeft / PROCESSOR_TIME_SEC;
}

function shieldHpProgress(x: number, y: number): number | null {
  const shield = props.state.shieldStates.find((s) => s.cellX === x && s.cellY === y);
  if (!shield || shield.rechargeLeft > 0) return null;
  return shield.hp / shield.maxHp;
}

function shieldRechargeProgress(x: number, y: number): number | null {
  const shield = props.state.shieldStates.find((s) => s.cellX === x && s.cellY === y);
  if (!shield || shield.rechargeLeft <= 0) return null;
  return 1 - shield.rechargeLeft / SHIELD_RECHARGE_TIME_SEC;
}

function isShieldRecharging(x: number, y: number): boolean {
  const shield = props.state.shieldStates.find((s) => s.cellX === x && s.cellY === y);
  return shield !== undefined && shield.rechargeLeft > 0;
}
</script>

<template>
  <div
    class="ship-grid-wrap"
    :class="{ 'ship-grid-wrap--combat': state.mode === 'combat' }"
    :style="{
      '--cell-size': `${state.cellSize}px`,
      left: `${state.shipX}px`,
      top: `${state.shipY}px`,
    }"
  >
    <div
      class="ship-grid"
      :style="{
        gridTemplateColumns: `repeat(${state.gridSize}, var(--cell-size))`,
        gridTemplateRows: `repeat(${state.gridSize}, var(--cell-size))`,
      }"
    >
      <button
        v-for="{ x, y, cell } in cells"
        :key="`${x}-${y}`"
        class="ship-cell"
        :class="cellClass(cell, x, y)"
        :style="cellGridStyle(x, y)"
        :disabled="isCellDisabled(cell)"
        :title="label(cell)"
        @click="onCellClick(x, y, cell)"
      >
        <BlockArt v-if="cell" class="ship-cell__art" :type="cell" />
        <span
          v-if="shieldHpProgress(x, y) !== null"
          class="ship-cell__progress ship-cell__progress--shield"
          :style="{ transform: `scaleX(${shieldHpProgress(x, y) ?? 0})` }"
        />
        <span
          v-if="shieldRechargeProgress(x, y) !== null"
          class="ship-cell__progress ship-cell__progress--recharge"
          :style="{ transform: `scaleX(${shieldRechargeProgress(x, y) ?? 0})` }"
        />
        <span
          v-if="processorProgress(x, y) !== null"
          class="ship-cell__progress"
          :style="{ transform: `scaleX(${processorProgress(x, y) ?? 0})` }"
        />
      </button>
    </div>
  </div>
</template>
