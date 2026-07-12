<script setup lang="ts">
import type { GameState } from "../game/Game";

defineProps<{
  state: GameState;
}>();

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
</script>

<template>
  <div class="hud">
    <div class="hud__top">
      <div class="hud__panel">
        <span class="hud__label">Время</span>
        <span class="hud__value">{{ formatTime(state.elapsed) }}</span>
      </div>
    </div>
    <p class="hud__hint">WASD / стрелки · Space</p>
  </div>
</template>
