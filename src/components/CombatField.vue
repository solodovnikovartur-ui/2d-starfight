<script setup lang="ts">
import type { GameState } from "../game/Game";

defineProps<{
  state: GameState;
}>();
</script>

<template>
  <div v-if="state.mode === 'combat'" class="combat-field">
    <div
      v-for="meteorite in state.combatMeteorites"
      :key="meteorite.id"
      class="meteorite"
      :class="{ 'meteorite--big': meteorite.kind === 'big' }"
      :style="{ left: `${meteorite.x}px`, top: `${meteorite.y}px` }"
    >
      <span class="meteorite__hp">{{ meteorite.hp }}</span>
    </div>
    <div
      v-for="projectile in state.combatProjectiles"
      :key="projectile.id"
      class="projectile"
      :style="{ left: `${projectile.x}px`, top: `${projectile.y}px` }"
    />
  </div>
</template>
