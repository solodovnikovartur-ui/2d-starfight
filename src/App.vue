<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import CombatField from "./components/CombatField.vue";
import GameHud from "./components/GameHud.vue";
import ShipGrid from "./components/ShipGrid.vue";
import { Game, type GameState } from "./game/Game";

const gameState = ref<GameState | null>(null);
let game: Game | null = null;

function focusGame(): void {
  (document.activeElement as HTMLElement | null)?.blur();
}

function onPlace(x: number, y: number): void {
  game?.tryPlaceBlock(x, y);
}

function onSell(x: number, y: number): void {
  game?.trySellBlock(x, y);
}

onMounted(() => {
  game = new Game((state) => {
    gameState.value = state;
  });
  game.start();
});

onUnmounted(() => {
  game?.stop();
});
</script>

<template>
  <div class="game-shell" @pointerdown="focusGame">
    <div v-if="gameState && game" class="game-world">
      <CombatField :state="gameState" />
      <ShipGrid :state="gameState" @place="onPlace" @sell="onSell" />
      <GameHud :state="gameState" :game="game" />
    </div>
  </div>
</template>
