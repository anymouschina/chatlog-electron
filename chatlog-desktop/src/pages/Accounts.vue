<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Backend } from '../services/backend'
import { ConfigAPI } from '../services/config'
import { IPC } from '../services/ipc'

type Ins = { pid: number; name: string; full_version: string; data_dir: string }
const list = ref<Ins[]>([])
const loading = ref(false)

async function refresh() {
  loading.value = true
  try {
    const state = await IPC.getState()
    const u = (state.addr || '127.0.0.1:5030').startsWith('http') ? state.addr : `http://${state.addr}`
    const mod = await import('../services/backend'); mod.setBase(u as string)
    const resp = await Backend.controlInstances()
    list.value = resp.items
  } catch { list.value = [] }
  loading.value = false
}

async function apply(ins: Ins) {
  // write DataDir from instance, keep other settings as-is
  const cfg = await ConfigAPI.get(); cfg.dataDir = ins.data_dir
  await ConfigAPI.set(cfg)
  await IPC.start(cfg)
  alert(`已切换到 ${ins.name} (${ins.pid})`)
}

onMounted(refresh)
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <button class="btn" @click="refresh">刷新</button>
    </div>
    <div v-if="loading" class="hint">加载中…</div>
    <div v-else class="list">
      <div class="row" v-for="ins in list" :key="ins.pid">
        <div class="main">{{ ins.name }} <span class="muted">PID: {{ ins.pid }}</span></div>
        <div class="sub">版本: {{ ins.full_version }} · 目录: {{ ins.data_dir }}</div>
        <div class="act"><button class="btn" @click="apply(ins)">切换</button></div>
      </div>
      <div v-if="!list.length" class="hint">未检测到微信进程</div>
    </div>
  </div>
</template>

<style scoped>
.panel { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.04); height: 100%; display: grid; grid-template-rows: auto 1fr; }
.toolbar { margin-bottom: 10px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 6px 10px; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,.12); }
.list { overflow: auto; display: grid; gap: 10px; }
.row { padding: 10px; border-radius: 10px; background: rgba(255,255,255,.04); display: grid; grid-template-columns: 1fr auto; gap: 6px; }
.main { font-weight: 600; }
.sub { grid-column: 1 / span 1; opacity: .7; font-size: 12px; }
.act { grid-column: 2; align-self: center; }
.muted { opacity: .6; font-weight: 400; margin-left: 6px; }
.hint { opacity: .7; }
</style>

