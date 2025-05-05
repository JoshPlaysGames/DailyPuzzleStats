<template>
  <div class="chart-container">
    <div ref="chart"></div>
    <select v-model="selectedPlayer" @change="updateChart" class="player-select">
      <option value="All">All</option>
      <option v-for="player in players" :key="player" :value="player">{{ player }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

// Optional CSV filename prop
const props = defineProps<{ dataFile?: string }>();
const chart = ref<HTMLElement | null>(null);
const rawData = ref<Array<{ Person: string; Game: string }>>([]);
const players = ref<string[]>([]);
const selectedPlayer = ref<string>('All');

async function loadData() {
  if (!props.dataFile) return;
  try {
    const data = (await d3.csv(import.meta.env.BASE_URL + `data/${props.dataFile}`)) as any;
    rawData.value = data.map((d: any) => ({ Person: d.Person, Game: d.Game }));
    players.value = Array.from(new Set(rawData.value.map(d => d.Person))).sort();
  } catch {
    console.warn('Unable to load', props.dataFile);
  }
}

function updateChart() {
  const container = chart.value;
  if (container) {
    container.innerHTML = '';
    const filtered = selectedPlayer.value === 'All'
      ? rawData.value
      : rawData.value.filter(d => d.Person === selectedPlayer.value);
    drawChart(filtered);
  }
}

function drawChart(dataArray: Array<{ Game: string }>) {
  if (!chart.value) return;
  if (!dataArray.length) {
    d3.select(chart.value)
      .append('text')
      .attr('x', 0).attr('y', 0)
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .style('font-size', '16px')
      .text(`No data for ${selectedPlayer.value}`);
    return;
  }

  // Aggregate counts
  const counts = d3.rollup(dataArray, v => v.length, d => d.Game);
  const data = Array.from(counts, ([key, value]) => ({ key, value }));
  const total = d3.sum(data, d => d.value);

  // Dimensions
  const width = 800, height = 600, margin = 40;
  const radius = Math.min(width, height) / 2 - margin;

  // Create SVG
  const svg = d3.select(chart.value)
    .append('svg')
      .attr('width', width)
      .attr('height', height)
    .append('g')
      .attr('transform', `translate(${width/2},${height/2})`);

  // Center text group
  const center = svg.append('g').style('opacity', 0);
  const labelText = center.append('text')
    .attr('class', 'center-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.5em');
  const valueText = center.append('text')
    .attr('class', 'center-value')
    .attr('text-anchor', 'middle')
    .attr('dy', '1em');

  // Color
  const color = d3.scaleOrdinal(d3.schemeDark2).domain(data.map(d=>d.key));

  // Pie layout
  const pie = d3.pie<{key:string;value:number}>()
    .sort(null)
    .value(d=>d.value);
  const arcs = pie(data);

  // Arc generators
  const arc = d3.arc<d3.PieArcDatum<{key:string;value:number}>>()
    .innerRadius(radius*0.5)
    .outerRadius(radius*0.8);
  const outerArc = d3.arc<d3.PieArcDatum<{key:string;value:number}>>()
    .innerRadius(radius*0.9)
    .outerRadius(radius*0.9);

  // Draw slices
  svg.selectAll('path.slice')
    .data(arcs)
    .enter().append('path')
      .attr('class','slice')
      .attr('d', arc)
      .attr('fill', d=>color(d.data.key))
      .attr('stroke','white')
      .attr('stroke-width','2px')
      .style('opacity',0.7)
      .on('mouseover', (_,d) => {
        labelText.text(d.data.key)
          .style('font-weight','bold')
          .style('font-size','20px');
        valueText.text(`${d.data.value} Entries`)
          .style('font-size','16px');
        center.transition().duration(300).style('opacity',1);
      })
      .on('mouseout', () => center.transition().duration(300).style('opacity',0));

  // Threshold 1%
  const threshold = 0.01;
  const data_ready = arcs.filter(d=>d.data.value/total >= threshold);

  // Polylines and labels
  svg.selectAll('polyline')
    .data(data_ready)
    .enter().append('polyline')
      .attr('stroke','black')
      .style('fill','none')
      .attr('stroke-width',1)
      .attr('points', d => {
        const posA = arc.centroid(d);
        const posB = outerArc.centroid(d);
        const posC = outerArc.centroid(d);
        const mid = d.startAngle + (d.endAngle-d.startAngle)/2;
        posC[0] = radius * 0.95 * (mid < Math.PI ? 1 : -1);
        return [posA, posB, posC];
      });

  svg.selectAll('text.label')
    .data(data_ready)
    .enter().append('text')
      .attr('transform', d => {
        const pos = outerArc.centroid(d);
        const mid = d.startAngle + (d.endAngle-d.startAngle)/2;
        pos[0] = radius * 0.99 * (mid < Math.PI ? 1 : -1);
        return `translate(${pos})`;
      })
      .style('text-anchor', d => {
        const mid = d.startAngle + (d.endAngle-d.startAngle)/2;
        return mid < Math.PI ? 'start' : 'end';
      })
      .text(d=>d.data.key);
}

onMounted(async () => {
  await loadData();
  updateChart();
});
</script>

<style scoped>
.chart-container { text-align: center; }
.center-label, .center-value { fill: black; }
.player-select {
  margin-top: 0.5rem;
  font-size: 18px;
  width: 250px;
  padding: 0.25rem;
}
</style>