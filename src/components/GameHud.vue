<script setup lang="ts">
import { computed } from "vue";
import { BLOCK_ENERGY_REQUIRED, BLOCK_LABELS, getBlockCost } from "../game/constants";
import type { Game, GameState } from "../game/Game";
import type { BlockType } from "../game/types";
import BlockArt from "./BlockArt.vue";

const props = defineProps<{
  state: GameState;
  game: Game;
}>();

const buildBlocks = computed((): BlockType[] => {
  const blocks: BlockType[] = ["processor", "cannon", "power"];
  if (props.state.shieldUnlocked) {
    blocks.push("shield");
  }
  if (props.state.mgunUnlocked) {
    blocks.push("mgun");
  }
  return blocks;
});

function blockLabel(type: BlockType): string {
  const energy = BLOCK_ENERGY_REQUIRED[type];
  const cost = getBlockCost(type);
  const energyLabel = energy > 0 ? ` (${energy}⚡)` : "";
  return `${BLOCK_LABELS[type]}${energyLabel} — ${cost} ₽`;
}
</script>

<template>
  <div class="hud">
    <div class="hud__top">
      <div class="hud__panel">
        <span class="hud__label">Деньги</span>
        <span class="hud__value hud__value--money">{{ state.money }} ₽</span>
      </div>
      <div v-if="state.mode === 'combat'" class="hud__panel">
        <span class="hud__label">За бой</span>
        <span class="hud__value">+{{ state.combatMoney }}</span>
      </div>
      <div v-if="state.mode === 'combat'" class="hud__panel">
        <span class="hud__label">Атака</span>
        <span class="hud__value">{{ state.attackTier }}</span>
      </div>
      <div v-if="state.mode === 'combat'" class="hud__panel">
        <span class="hud__label">Волна</span>
        <span class="hud__value">
          {{ state.combatWave }}/{{ state.combatWaveTotal }} — {{ state.combatWaveLabel }}
        </span>
      </div>
      <div class="hud__panel">
        <span class="hud__label">Поле</span>
        <span class="hud__value">{{ state.gridSize }}×{{ state.gridSize }}</span>
      </div>
      <div class="hud__panel">
        <span class="hud__label">Побед</span>
        <span class="hud__value">{{ state.campaignsWon }}</span>
      </div>
      <div class="hud__panel">
        <span class="hud__label">Режим</span>
        <span class="hud__value">
          {{ state.mode === "build" ? "Строительство" : "Бой" }}
        </span>
      </div>
    </div>

    <aside v-if="state.mode === 'build'" class="hud__sidebar">
      <p class="hud__section-title">Построить</p>
      <div class="hud__palette">
        <button
          v-for="block in buildBlocks"
          :key="block"
          class="hud__btn hud__btn--block"
          :class="{ 'hud__btn--active': state.selectedBlock === block }"
          @click="game.selectBlock(block)"
        >
          <BlockArt :type="block" small />
          <span>{{ blockLabel(block) }}</span>
        </button>
      </div>

      <p v-if="state.shieldUnlocked" class="hud__hint hud__hint--unlock">
        Щит защищает 3×3: метеориты бьют по HP щита, потом перезарядка (2⚡)
      </p>

      <p class="hud__section-title hud__section-title--spaced">Продать</p>
      <button
        class="hud__btn hud__btn--sell"
        :class="{ 'hud__btn--active': state.sellMode }"
        @click="game.toggleSellMode()"
      >
        Режим продажи
      </button>

      <p v-if="state.sellMode" class="hud__hint">
        Нажми на блок, чтобы продать по его стоимости
      </p>
      <p v-else-if="state.selectedBlock" class="hud__hint">
        Нажми на пустую клетку рядом с кораблём
      </p>
      <p v-else class="hud__hint">Выбери блок для постройки или продажи</p>
    </aside>

    <p v-if="state.mode === 'combat'" class="hud__hint hud__hint--combat">WASD — двигать корабль</p>

    <div class="hud__bottom">
      <div class="hud__bottom-bar">
        <div class="hud__actions">
          <button
            v-if="state.mode === 'build'"
            class="hud__btn hud__btn--combat"
            @click="game.startCombatCampaign()"
          >
            X — В бой
          </button>
          <button class="hud__btn hud__btn--danger" @click="game.restartGame()">
            Начать заново
          </button>
        </div>
        <p class="hud__autosave">Автосохранение включено</p>
      </div>
    </div>

    <div v-if="state.statusMessage" class="toast" @click="game.dismissMessage()">
      {{ state.statusMessage }}
    </div>
  </div>
</template>
