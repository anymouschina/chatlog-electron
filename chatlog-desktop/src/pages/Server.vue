<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IPC } from '../services/ipc'
const addr = ref('http://127.0.0.1:5030')
const running = ref(false)

async function refresh() {
  const s = await IPC.getState()
  running.value = s.running
  addr.value = s.addr?.startsWith('http') ? s.addr : `http://${s.addr}`
}

async function onStartStop() {
  if (running.value) {
    await IPC.stop()
  } else {
    const u = new URL(addr.value)
    await IPC.start({ addr: `${u.hostname}:${u.port || 5030}` })
  }
  await refresh()
}

onMounted(refresh)
</script>

<template>
  <div class="card">
    <h3>HTTP / MCP 服务</h3>
    <div class="row">
      <label>地址</label>
      <input class="input" v-model="addr" placeholder="127.0.0.1:5030 或 http://…" />
    </div>
    <div class="row">
      <button class="btn" @click="onStartStop">🌐 {{ running ? '停止服务' : '启动服务' }}</button>
      <a class="link" :href="addr" target="_blank">在浏览器中打开</a>
    </div>
  </div>
</template>

<style scoped>
.card { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.04); }
.row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
label { width: 60px; opacity: .8; }
.input { flex: 1; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: inherit; padding: 8px 10px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 8px 12px; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,.12); }
.link { color: #4aa3ff; text-decoration: none; }
</style>
