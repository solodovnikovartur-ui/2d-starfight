<script setup lang="ts">
import { HEALER_HEAL_RADIUS, SHIELDER_AURA_RADIUS } from "../game/constants";
import type { GameState } from "../game/Game";

defineProps<{
  state: GameState;
}>();

const healerAuraDiameter = HEALER_HEAL_RADIUS * 2;
const shielderAuraDiameter = SHIELDER_AURA_RADIUS * 2;

function displayHp(hp: number): number {
  return Math.max(0, Math.ceil(hp));
}
</script>

<template>
  <div v-if="state.mode === 'combat'" class="combat-field">
    <div
      v-for="meteorite in state.combatMeteorites"
      :key="meteorite.id"
      class="meteorite"
      :class="{
        'meteorite--big': meteorite.kind === 'big',
        'meteorite--healer': meteorite.kind === 'healer',
        'meteorite--shielder': meteorite.kind === 'shielder',
      }"
      :style="{ left: `${meteorite.x}px`, top: `${meteorite.y}px` }"
    >
      <span
        v-if="meteorite.kind === 'healer'"
        class="meteorite__heal-aura"
        :style="{
          width: `${healerAuraDiameter}px`,
          height: `${healerAuraDiameter}px`,
          marginLeft: `-${HEALER_HEAL_RADIUS}px`,
          marginTop: `-${HEALER_HEAL_RADIUS}px`,
        }"
      />
      <span
        v-if="meteorite.kind === 'shielder'"
        class="meteorite__shield-aura"
        :style="{
          width: `${shielderAuraDiameter}px`,
          height: `${shielderAuraDiameter}px`,
          marginLeft: `-${SHIELDER_AURA_RADIUS}px`,
          marginTop: `-${SHIELDER_AURA_RADIUS}px`,
        }"
      />
      <span class="meteorite__hp">{{ displayHp(meteorite.hp) }}</span>
      <span v-if="meteorite.kind === 'healer'" class="meteorite__healer-mark">+</span>
      <span v-if="meteorite.kind === 'shielder'" class="meteorite__shielder-mark">🛡</span>
    </div>
    <div
      v-for="projectile in state.combatProjectiles"
      :key="projectile.id"
      class="projectile"
      :style="{ left: `${projectile.x}px`, top: `${projectile.y}px` }"
    />
  </div>
</template>
