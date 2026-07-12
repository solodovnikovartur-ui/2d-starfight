<script setup lang="ts">
import type { BlockType } from "../game/types";

defineProps<{
  type: BlockType;
  small?: boolean;
}>();
</script>

<template>
  <svg
    class="block-art"
    :class="{ 'block-art--small': small }"
    viewBox="0 0 64 64"
    aria-hidden="true"
  >
    <!-- Ядро корабля -->
    <g v-if="type === 'core'">
      <rect x="14" y="18" width="36" height="28" rx="6" fill="#4a4a7a" stroke="#a8a8e8" stroke-width="2" />
      <rect x="22" y="26" width="20" height="12" rx="3" fill="#88ccff" opacity="0.85" />
      <circle cx="32" cy="14" r="5" fill="#6a6aaa" stroke="#c8c8ff" stroke-width="1.5" />
      <line x1="32" y1="19" x2="32" y2="18" stroke="#c8c8ff" stroke-width="2" />
    </g>

    <!-- Автопушка -->
    <g v-else-if="type === 'cannon'">
      <rect x="10" y="36" width="28" height="14" rx="4" fill="#5a3a3a" stroke="#cc8888" stroke-width="2" />
      <rect x="30" y="30" width="26" height="10" rx="3" fill="#7a4a4a" stroke="#ffaaaa" stroke-width="2" />
      <circle cx="18" cy="43" r="4" fill="#3a2020" />
      <rect x="52" y="32" width="6" height="6" rx="1" fill="#ffcc88" />
    </g>

    <!-- Переработчик -->
    <g v-else-if="type === 'processor'">
      <rect x="16" y="14" width="32" height="36" rx="5" fill="#2a5a42" stroke="#6ed4a0" stroke-width="2" />
      <path d="M24 24 L40 24 L36 34 L28 34 Z" fill="#1a4030" stroke="#8ef0b8" stroke-width="1.5" />
      <rect x="22" y="38" width="20" height="6" rx="2" fill="#4a9a6a" />
      <circle cx="26" cy="48" r="3" fill="#8ef0b8" />
      <circle cx="38" cy="48" r="3" fill="#8ef0b8" />
    </g>

    <!-- Блок питания -->
    <g v-else-if="type === 'power'">
      <rect x="18" y="16" width="28" height="36" rx="4" fill="#5a5a1a" stroke="#eeee66" stroke-width="2" />
      <rect x="24" y="22" width="16" height="24" rx="2" fill="#3a3a10" stroke="#cccc44" stroke-width="1.5" />
      <path
        d="M34 28 L30 36 L33 36 L30 44 L38 34 L35 34 L38 28 Z"
        fill="#ffee55"
        stroke="#fff8aa"
        stroke-width="1"
      />
    </g>

    <!-- Щит -->
    <g v-else-if="type === 'shield'">
      <path
        d="M32 10 L52 20 L52 38 C52 48 42 54 32 58 C22 54 12 48 12 38 L12 20 Z"
        fill="#2a4a6a"
        stroke="#66ccff"
        stroke-width="2"
      />
      <path
        d="M32 18 L44 25 L44 38 C44 44 38 48 32 50 C26 48 20 44 20 38 L20 25 Z"
        fill="#3a6a9a"
        opacity="0.7"
      />
      <ellipse cx="32" cy="34" rx="8" ry="10" fill="#88ddff" opacity="0.35" />
    </g>
  </svg>
</template>
