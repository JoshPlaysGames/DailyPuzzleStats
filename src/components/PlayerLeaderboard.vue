<template>
  <div class="leaderboard-container">
    <div class="chart-wrapper">
      <h3>Total Entries</h3>
      <div ref="leftChart"></div>
    </div>
    <div class="chart-wrapper">
      <h3>Days Played</h3>
      <div ref="rightChart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

type Entry = { Date: Date; Person: string; Game: string };

const props = defineProps<{ dataFile?: string }>();
const leftChart = ref<HTMLElement | null>(null);
const rightChart = ref<HTMLElement | null>(null);

async function loadData(): Promise<Entry[]> {
  if (!props.dataFile) return [];
  const parseDate = d3.timeParse('%m/%d/%Y');
  try {
    const raw = await d3.csv(import.meta.env.BASE_URL + `data/${props.dataFile}`) as any[];
    return raw.map(d => ({
      Date: parseDate(d.Date) as Date,
      Person: d.Person,
      Game: d.Game
    }));
  } catch (e) {
    console.warn('Could not load dataFile', props.dataFile, e);
    return [];
  }
}

function drawBarChart(
  container: HTMLElement,
  data: Array<{ player: string; value: number }>
) {
  container.innerHTML = '';
  const margin = { top: 30, right: 80, bottom: 20, left: 120 };
  const barHeight = 40;
  const width = 500 - margin.left - margin.right;
  const height = data.length * barHeight;

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)!])
    .range([0, width]);
  const y = d3.scaleBand<string>()
    .domain(data.map(d => d.player))
    .range([0, height])
    .padding(0.2);

  const svg = d3.select(container)
    .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // Bars with animation
  const bars = svg.selectAll('rect')
    .data(data)
    .enter().append('rect')
      .attr('y', d => y(d.player)!)
      .attr('height', y.bandwidth())
      .attr('x', 0)
      .attr('width', 0)
      .attr('fill', 'steelblue');

  bars.transition()
    .duration(1500)
    .attr('width', d => x(d.value));

  // Player labels
  svg.append('g')
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll('text')
      .style('font-size', '16px');

  // Value labels at end of bars
  const labels = svg.selectAll('.value-label')
    .data(data)
    .enter().append('text')
      .attr('class', 'value-label')
      .attr('x', 0)
      .attr('y', d => y(d.player)! + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('font-size', '16px');

  labels.transition()
    .delay(1500)
    .duration(0)
    .attr('x', d => x(d.value) + 8)
    .text(d => d.value.toString());
}

onMounted(async () => {
  const entries = await loadData();
  if (!entries.length) return;

  const players = Array.from(new Set(entries.map(e => e.Person)));
  const totals = players.map(player => ({
    player,
    value: entries.filter(e => e.Person === player).length
  }));
  const daysSet = entries.reduce((map, e) => {
    const key = e.Person;
    const dt = e.Date.toDateString();
    if (!map.has(key)) map.set(key, new Set<string>());
    map.get(key)!.add(dt);
    return map;
  }, new Map<string, Set<string>>());
  const daysPlayed = players.map(player => ({
    player,
    value: daysSet.get(player)!.size
  }));

  totals.sort((a, b) => b.value - a.value);
  daysPlayed.sort((a, b) => b.value - a.value);

  if (leftChart.value) drawBarChart(leftChart.value, totals);
  if (rightChart.value) drawBarChart(rightChart.value, daysPlayed);
});
</script>

<style scoped>
.leaderboard-container {
  display: flex;
  gap: 80px;
  justify-content: center;
  align-items: flex-start;
}
.chart-wrapper {
  flex: 1;
}
.chart-wrapper h3 {
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 20px;
}
</style>