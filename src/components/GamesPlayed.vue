<template>
  <div class="chart-container">
    <div class="chart" ref="chart"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as d3 from 'd3';

type DailyCount = { day: number; count: number };
type Cumulative = { day: number; total: number };

// Accept an optional dataFile prop
const props = defineProps<{ dataFile?: string }>();

const chart = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (!chart.value) return;

  // Prepare parser
  const parseDate = d3.timeParse('%m/%d/%Y');
  let rawData: Array<{ Date: Date; Person: string; Game: string }> = [];

  // Attempt to load CSV if prop provided
  if (props.dataFile) {
    try {
      const csvUrl = import.meta.env.BASE_URL + `data/${props.dataFile}`;
      rawData = (await d3.csv(csvUrl, d => ({
        Date: parseDate(d.Date as string)!,
        Person: d.Person as string,
        Game: d.Game as string,
      }))) as any;
    } catch (err) {
      console.warn('Could not load dataFile:', props.dataFile, err);
    }
  }

  // Dimensions & margins
  const margin = { top: 20, right: 70, bottom: 100, left: 70 };
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

  // Compute dailyCounts and cumulative if data exists
  let dailyCounts: DailyCount[];
  let cumulative: Cumulative[];
  if (rawData.length > 0) {
    const [minDate, maxDate] = d3.extent(rawData, d => d.Date) as [Date, Date];
    const dates: Date[] = [];
    for (let dt = new Date(minDate); dt <= maxDate; dt.setDate(dt.getDate() + 1)) {
      dates.push(new Date(dt));
    }
    const dateToDay = new Map<number, number>(dates.map((d, i) => [d.getTime(), i + 1]));
    dailyCounts = dates.map(d => ({
      day: dateToDay.get(d.getTime())!,
      count: rawData.filter(r => r.Date.getTime() === d.getTime()).length,
    }));
    let run = 0;
    cumulative = dailyCounts.map(d => {
      run += d.count;
      return { day: d.day, total: run };
    });
  } else {
    // Fallback arrays
    dailyCounts = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, count: 0 }));
    cumulative = dailyCounts.map(d => ({ day: d.day, total: 0 }));
  }

  // Scales
  const x = d3.scaleBand<number>()
    .domain(dailyCounts.map(d => d.day))
    .range([0, width])
    .padding(0.1);

  const yBarMax = rawData.length > 0 ? d3.max(dailyCounts, d => d.count)! : 10;
  const yBar = d3.scaleLinear().domain([0, yBarMax]).nice().range([height, 0]);
  const yLineMax = rawData.length > 0 ? d3.max(cumulative, d => d.total)! : 10;
  const yLine = d3.scaleLinear().domain([0, yLineMax]).nice().range([height, 0]);

  // Draw axes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  svg.append('g')
    .call(d3.axisLeft(yBar));

  // Right-side axis for line
  svg.append('g')
    .attr('transform', `translate(${width},0)`)
    .call(d3.axisRight(yLine));

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

  // Right axis label
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${width + margin.right - 15},${height / 2}) rotate(90)`)
    .text('Total Games');

  // If no data, show message and exit
  if (rawData.length === 0) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .text(`Unable to load data: ${props.dataFile}`);
    return;
  }

  // Bar animation
  svg.selectAll('.bar')
    .data(dailyCounts)
    .enter()
    .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.day)!)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', 'steelblue')
    .transition().duration(1500)
      .attr('y', d => yBar(d.count))
      .attr('height', d => height - yBar(d.count));

  // Line animation
  const lineGen = d3.line<Cumulative>()
    .x(d => x(d.day)! + x.bandwidth() / 2)
    .y(d => yLine(d.total));
  const path = svg.append('path')
    .datum(cumulative)
    .attr('fill', 'none')
    .attr('stroke', 'orange')
    .attr('stroke-width', 2)
    .attr('d', lineGen as any);
  const totalLen = (path.node() as SVGPathElement).getTotalLength();
  path.attr('stroke-dasharray', `${totalLen} ${totalLen}`)
      .attr('stroke-dashoffset', totalLen)
    .transition().duration(2000)
      .attr('stroke-dashoffset', 0);

  // Legend
  const legendY = height + axisLabelOffset + 20;
  const legend = svg.append('g')
    .attr('transform', `translate(${width / 2}, ${legendY})`)
    .style('font-size', '12px');
  const entries = [
    { label: 'Games / Day', type: 'rect', color: 'steelblue' },
    { label: 'Total Games', type: 'circle', color: 'orange' }
  ];
  const entrySpace = 150;
  entries.forEach((e, i) => {
    const xOff = (i - (entries.length - 1) / 2) * entrySpace;
    const gEnt = legend.append('g').attr('transform', `translate(${xOff}, 0)`);
    if (e.type === 'rect') {
      gEnt.append('rect').attr('x', 0).attr('y', -6).attr('width', 12).attr('height', 12).attr('fill', e.color);
    } else {
      gEnt.append('circle').attr('cx', 6).attr('cy', 0).attr('r', 6).attr('fill', e.color);
    }
    gEnt.append('text')
      .attr('x', 18)
      .attr('y', 0)
      .attr('dominant-baseline', 'middle')
      .attr('dy', '0.12em')
      .text(e.label);
  });

  // Hover layers
  const hoverLine = svg.append('g').style('display', 'none');
  hoverLine.append('circle').attr('r', 4).attr('fill', 'orange');
  hoverLine.append('text').attr('class', 'hover-label').attr('text-anchor', 'middle').attr('dy', -10);
  const hoverBar = svg.append('g').style('display', 'none');
  hoverBar.append('text').attr('class', 'bar-label').attr('text-anchor', 'middle').attr('dy', -5);

  // Interaction overlay
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mouseover', () => { hoverLine.style('display', null); hoverBar.style('display', null); })
    .on('mouseout', () => { hoverLine.style('display', 'none'); hoverBar.style('display', 'none'); })
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const centers = dailyCounts.map(d => x(d.day)! + x.bandwidth() / 2);
      const idx = d3.bisector((d: number) => d).center(centers, mx);
      const c = cumulative[idx], b = dailyCounts[idx];
      const cxL = x(c.day)! + x.bandwidth() / 2, cyL = yLine(c.total);
      hoverLine.select('circle').attr('cx', cxL).attr('cy', cyL);
      hoverLine.select('text').attr('x', cxL).attr('y', cyL).text(c.total);
      const cxB = x(b.day)! + x.bandwidth() / 2, cyB = yBar(b.count);
      hoverBar.select('text').attr('x', cxB).attr('y', cyB).text(b.count);
    });
});
</script>

<style scoped>
.chart-container {
  text-align: center;
}

.bar-label,
.hover-label {
  font-size: 12px;
  fill: black;
  pointer-events: none;
}
</style>