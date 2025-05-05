<template>
  <div ref="chart"></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

type DailyCount = { day: number; count: number };
type Cumulative = { day: number; total: number };

const chart = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (!chart.value) return;

  // Build CSV URL
  const csvUrl = import.meta.env.BASE_URL + 'data/2025_GamesClub_Data.csv';

  // Parse dates
  const parseDate = d3.timeParse('%m/%d/%Y');
  const rawData = (await d3.csv(csvUrl, d => ({
    Date: parseDate(d.Date as string)!,
    Person: d.Person as string,
    Game: d.Game as string,
  }))) as Array<{ Date: Date; Person: string; Game: string }>;

  // Generate full range of dates
  const [minDate, maxDate] = d3.extent(rawData, d => d.Date) as [Date, Date];
  const dates: Date[] = [];
  for (let dt = new Date(minDate); dt <= maxDate; dt.setDate(dt.getDate() + 1)) {
    dates.push(new Date(dt));
  }

  // Map dates to day index
  const dateToDay = new Map<number, number>(
    dates.map((d, i) => [d.getTime(), i + 1])
  );

  // Compute daily counts and cumulative totals
  const dailyCounts: DailyCount[] = dates.map(d => ({
    day: dateToDay.get(d.getTime())!,
    count: rawData.filter(r => r.Date.getTime() === d.getTime()).length
  }));
  let running = 0;
  const cumulative: Cumulative[] = dailyCounts.map(d => {
    running += d.count;
    return { day: d.day, total: running };
  });

  // Chart dimensions and margins
  const margin = { top: 20, right: 150, bottom: 100, left: 70 };
  const width = 900 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const axisLabelOffset = 50;

  // Create SVG canvas
  const svg = d3.select(chart.value)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .style('font-family', 'Roboto, sans-serif')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand<number>()
    .domain(dailyCounts.map(d => d.day))
    .range([0, width])
    .padding(0.1);
  const yBar = d3.scaleLinear()
    .domain([0, d3.max(dailyCounts, d => d.count)!])
    .nice()
    .range([height, 0]);
  const yLine = d3.scaleLinear()
    .domain([0, d3.max(cumulative, d => d.total)!])
    .nice()
    .range([height, 0]);

  // Draw axes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svg.append('g')
    .call(d3.axisLeft(yBar));

  // Axis labels
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('x', width / 2)
    .attr('y', height + axisLabelOffset)
    .text('Day');
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${-margin.left + 15},${height / 2}) rotate(-90)`)
    .text('Number of Games');

  // Draw bars
  svg.selectAll('.bar')
    .data(dailyCounts)
    .enter()
    .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.day)!)
      .attr('y', d => yBar(d.count))
      .attr('width', x.bandwidth())
      .attr('height', d => height - yBar(d.count))
      .attr('fill', 'steelblue');

  // Draw cumulative line
  const lineGen = d3.line<Cumulative>()
    .x(d => x(d.day)! + x.bandwidth() / 2)
    .y(d => yLine(d.total));
  svg.append('path')
    .datum(cumulative)
    .attr('fill', 'none')
    .attr('stroke', 'orange')
    .attr('stroke-width', 2)
    .attr('d', lineGen);

  // Legend entries
  const legendY = height + axisLabelOffset + 20;
  const legend = svg.append('g')
    .attr('transform', `translate(${width / 2}, ${legendY})`)
    .style('font-size', '12px');
  const entries = [
    { label: 'Games / Day', type: 'rect', color: 'steelblue' },
    { label: 'Total Games', type: 'circle', color: 'orange' }
  ];
  const entrySpacing = 150;

  entries.forEach((d, i) => {
    const xOffset = (i - (entries.length - 1) / 2) * entrySpacing;
    const gEntry = legend.append('g')
      .attr('transform', `translate(${xOffset}, 0)`);
    if (d.type === 'rect') {
      gEntry.append('rect')
        .attr('x', 0)
        .attr('y', -6)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d.color);
    } else {
      gEntry.append('circle')
        .attr('cx', 6)
        .attr('cy', 0)
        .attr('r', 6)
        .attr('fill', d.color);
    }
    gEntry.append('text')
      .attr('x', 18)
      .attr('y', 0)
      .attr('dominant-baseline', 'middle')
      .attr('dy', '0.12em')
      .text(d.label);
  });

  // Hover layers
  const hoverLine = svg.append('g').style('display', 'none');
  hoverLine.append('circle').attr('r', 4).attr('fill', 'orange');
  hoverLine.append('text')
    .attr('class', 'hover-label')
    .attr('text-anchor', 'middle')
    .attr('dy', -10);

  const hoverBar = svg.append('g').style('display', 'none');
  hoverBar.append('text')
    .attr('class', 'bar-label')
    .attr('text-anchor', 'middle')
    .attr('dy', -5);

  // Interaction overlay
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mouseover', () => {
      hoverLine.style('display', null);
      hoverBar.style('display', null);
    })
    .on('mouseout', () => {
      hoverLine.style('display', 'none');
      hoverBar.style('display', 'none');
    })
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const xCenters = dailyCounts.map(d => x(d.day)! + x.bandwidth() / 2);
      const bisect = d3.bisector((d: number) => d).center;
      const idx = bisect(xCenters, mx);

      const c = cumulative[idx];
      const b = dailyCounts[idx];
      const cxLine = x(c.day)! + x.bandwidth() / 2;
      const cyLine = yLine(c.total);
      hoverLine.select('circle').attr('cx', cxLine).attr('cy', cyLine);
      hoverLine.select('text').attr('x', cxLine).attr('y', cyLine).text(c.total);

      const cxBar = x(b.day)! + x.bandwidth() / 2;
      const cyBar = yBar(b.count);
      hoverBar.select('text').attr('x', cxBar).attr('y', cyBar).text(b.count);
    });
});
</script>

<style scoped>
.bar-label,
.hover-label {
  font-size: 12px;
  fill: black;
  pointer-events: none;
}
</style>
