<template>
  <div class="stats-card">
    <div class="stat">
      <div class="value players">{{ playersCount }}</div>
      <div class="label">Unique Players</div>
    </div>
    <div class="stat">
      <div class="value games">{{ gamesCount }}</div>
      <div class="label">Games Logged</div>
    </div>
    <div class="stat">
      <div class="value types">{{ typesCount }}</div>
      <div class="label">Game Types</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

// Accept a data file name as prop for reusability
const props = defineProps<{
  dataFile: string;
}>();

const gamesCount = ref(0);
const playersCount = ref(0);
const typesCount = ref(0);

onMounted(async () => {
  // Build CSV URL from prop
  const csvUrl = import.meta.env.BASE_URL + `data/${props.dataFile}`;
  const data = (await d3.csv(csvUrl)) as Array<{ Date: string; Person: string; Game: string }>;

  gamesCount.value = data.length;
  playersCount.value = new Set(data.map(d => d.Person)).size;
  typesCount.value = new Set(data.map(d => d.Game)).size;
});
</script>

<style scoped>
.stats-card {
  display: flex;
  justify-content: space-around;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 0.75rem;
  margin: 0 auto 2rem;
  max-width: 600px;
  background: #fff;
}
.stat {
  text-align: center;
}
.value {
  font-size: 2rem;
  font-weight: bold;
}
.value.games {
  color: steelblue;
}
.value.players {
  color: darkgreen;
}
.value.types {
  color: #4B0082;
}
.label {
  margin-top: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
}
</style>
