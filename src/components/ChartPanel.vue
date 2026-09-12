<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const props = defineProps<{ option: EChartsOption; label: string }>()
const chartElement = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let observer: ResizeObserver | null = null

function render() {
  chart?.setOption(props.option, { notMerge: true, lazyUpdate: true })
}

onMounted(() => {
  if (!chartElement.value) return
  chart = echarts.init(chartElement.value, undefined, { renderer: 'svg' })
  render()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(chartElement.value)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <div ref="chartElement" class="chart-panel" role="img" :aria-label="label"></div>
</template>
