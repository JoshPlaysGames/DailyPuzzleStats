<template>
  <div class="info">
    <div class="title">Hello</div>
    <div ref="chart"></div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

const chart = ref(null);

onMounted(() => {
  const data = [10, 15, 20, 25];
  const width = 300, height = 150;

  const svg = d3.select(chart.value)
    .append('svg')
      .attr('width', width)
      .attr('height', height);

  svg.selectAll('rect')
    .data(data)
    .enter().append('rect')
      .attr('x', (d,i) => i * 70)
      .attr('y', d => height - d * 4)
      .attr('width', 50)
      .attr('height', d => d * 4)
      .attr('fill', 'blue');
});
</script>
