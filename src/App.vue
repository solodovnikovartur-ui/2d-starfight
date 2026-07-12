<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import GameHud from "./components/GameHud.vue";
import { Game, type GameState } from "./game/Game";

const gameState = ref<GameState | null>(null);

let game: Game | null = null;

function focusGame(): void {
  (document.activeElement as HTMLElement | null)?.blur();
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
    <div v-if="gameState" class="game-world">
      <GameHud :state="gameState" />
    </div>
  </div>
</template>
