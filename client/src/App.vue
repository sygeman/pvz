<template>
  <div class="app">
    <AuthView v-if="!user" />
    <GameView v-else />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useGameStore } from './store.js';
import { storeToRefs } from 'pinia';
import AuthView from './components/AuthView.vue';
import GameView from './components/GameView.vue';

const store = useGameStore();
const { user } = storeToRefs(store);

onMounted(() => {
  // Check for session in URL (from GitHub callback)
  const urlParams = new URLSearchParams(window.location.search);
  const session = urlParams.get('session');
  if (session) {
    store.setSession(session);
    window.history.replaceState({}, '', '/');
  }
  
  // Fetch user if we have session
  store.fetchUser();
});
</script>

<style>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}
</style>
