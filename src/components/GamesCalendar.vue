<template>
  <div class="chart-container">
    <div ref="chart"></div>
    <select v-model="selectedPlayer" @change="updateChart" class="player-select">
      <option value="All">All</option>
      <option v-for="player in players" :key="player" :value="player">{{ player }}</option>
    </select>
    <div ref="hoverLabel" class="hover-label"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

type Entry = { Date: Date; Person: string; Game: string };

const props = defineProps<{ dataFile?: string }>();
const chart = ref<HTMLElement | null>(null);
const hoverLabel = ref<HTMLElement | null>(null);
const rawEntries = ref<Entry[]>([]);
const players = ref<string[]>([]);
const selectedPlayer = ref<string>('All');

async function loadData(): Promise<void> {
  if (!props.dataFile) return;
  const parseDate = d3.timeParse('%m/%d/%Y');
  try {
    const raw = (await d3.csv(import.meta.env.BASE_URL + `data/${props.dataFile}`)) as any[];
    rawEntries.value = raw.map(d => ({
      Date: parseDate(d.Date) as Date,
      Person: d.Person,
      Game: d.Game
    }));
    players.value = Array.from(new Set(rawEntries.value.map(e => e.Person))).sort();
  } catch {
    console.warn('Could not load dataFile', props.dataFile);
    rawEntries.value = [];
  }
}

function formatOrdinal(day: number): string {
  const j = day % 10,
        k = day % 100;
  if (j == 1 && k != 11) return day + 'st';
  if (j == 2 && k != 12) return day + 'nd';
  if (j == 3 && k != 13) return day + 'rd';
  return day + 'th';
}

function updateChart(): void {
  drawCalendar(
    selectedPlayer.value === 'All'
      ? rawEntries.value
      : rawEntries.value.filter(e => e.Person === selectedPlayer.value)
  );
}

function drawCalendar(entries: Entry[]): void {
  if (!chart.value) return;
  chart.value.innerHTML = '';
  if (!entries.length) {
    d3.select(chart.value)
      .append('text')
      .attr('x', 0).attr('y', 0)
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .style('font-size', '16px')
      .text('No data');
    return;
  }

  const counts = d3.rollup(entries, v => v.length, d => d.Date.getTime());
  const first = entries[0].Date;
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  const cols = 7;
  const totalSlots = startDay + daysInMonth;
  const rows = Math.ceil(totalSlots / cols);

  const cellSize = 40;
  const weekdays = ['S', 'M', 'Tu', 'W', 'Th', 'F', 'S'];
  const width = cellSize * cols;
  const height = cellSize * (rows + 1);

  const maxCount = d3.max(Array.from(counts.values())) || 1;
  const colorRange = selectedPlayer.value === 'All'
    ? ['#eee', 'steelblue']
    : ['#eee', 'purple'];
  const color = d3.scaleLinear<string>()
    .domain([0, maxCount])
    .range(colorRange);

  const svg = d3.select(chart.value)
    .append('svg')
      .attr('width', width + 60)
      .attr('height', height)
    .append('g')
      .attr('transform', 'translate(60,0)');

  // X axis labels
  svg.append('g')
    .selectAll('text')
    .data(weekdays)
    .enter().append('text')
      .attr('x', (_, i) => i * cellSize + cellSize / 2)
      .attr('y', cellSize / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(d => d)
      .style('font-size', '14px');

  // Y axis labels
  const weeks = Array.from({ length: rows }, (_, i) => i + 1);
  svg.append('g')
    .attr('transform', `translate(0,${cellSize})`)
    .selectAll('text.week')
    .data(weeks)
    .enter().append('text')
      .attr('class', 'week-label')
      .attr('x', -15)
      .attr('y', (_, i) => i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(d => d.toString())
      .style('font-size', '14px');

  const cellsG = svg.append('g')
    .attr('transform', `translate(0,${cellSize})`);

  for (let day = 1; day <= daysInMonth; day++) {
    const slot = startDay + (day - 1);
    const row = Math.floor(slot / cols);
    const col = slot % cols;
    const dateObj = new Date(year, month, day);
    const ts = dateObj.getTime();
    const cnt = counts.get(ts) || 0;
    const rect = cellsG.append('rect')
      .attr('x', col * cellSize)
      .attr('y', row * cellSize)
      .attr('width', cellSize - 2)
      .attr('height', cellSize - 2)
      .attr('fill', color(cnt));
    rect.on('mouseover', () => {
      if (hoverLabel.value) {
        const dateStr = d3.timeFormat('%B ')(dateObj) + formatOrdinal(day) + ', ' + year;
        hoverLabel.value.innerHTML = `${dateStr}: <strong>${cnt} Entries</strong>`;
        hoverLabel.value.style.opacity = '1';
      }
    }).on('mouseout', () => {
      if (hoverLabel.value) hoverLabel.value.style.opacity = '0';
    });
  }
}

onMounted(async () => {
  await loadData();
  updateChart();
});
</script>

<style scoped>
.chart-container {
  text-align: center;
  padding: 0.5rem 0 100px;
}
.hover-label {
  margin-top: 0.5rem;
  font-size: 16px;
  transition: opacity 0.3s;
  opacity: 0;
}
.week-label {
  font-size: 12px;
}
.player-select {
  margin-top: 0.5rem;
  font-size: 18px;
  width: 250px;
  padding: 0.25rem;
}
</style>