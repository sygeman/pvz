<template>
  <div class="stat-card">
    <span class="label">{{ label }}</span>
    <span class="value">{{ value }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number]
});
</script>

<style scoped>
.stat-card {
  background: rgba(255,255,255,0.1);
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  backdrop-filter: blur(10px);
}

.label {
  display: block;
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 5px;
}

.value {
  display: block;
  font-size: 1.3rem;
  font-weight: bold;
  color: #ffd700;
}
</style>
