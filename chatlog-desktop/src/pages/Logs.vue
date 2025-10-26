<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'

const content = ref('')
const info = ref<{ size?: number; mtime?: number; path?: string }>({})
const loading = ref(false)
const timer = ref<any>(null)
const interval = 1500

async function loadOnce() {
  try {
    loading.value = true
    const ret = await (window as any).ipcRenderer.invoke('logs:read')
    if (ret?.ok) {
      content.value = ret.content || ''
      info.value = { size: ret.size, mtime: ret.mtime, path: ret.path }
      await nextTick()
      const el = document.querySelector('.log-body') as HTMLElement | null
      if (el) el.scrollTop = el.scrollHeight
    }
  } finally { loading.value = false }
}

function startAuto() {
  stopAuto(); timer.value = setInterval(loadOnce, interval)
}
function stopAuto() { if (timer.value) { clearInterval(timer.value); timer.value = null } }

async function openFolder() {
  const ret = await (window as any).ipcRenderer.invoke('logs:open')
  if (!ret?.ok && ret?.error) alert(ret.error)
}
async function clearLog() {
  const ret = await (window as any).ipcRenderer.invoke('logs:clear')
  if (!ret?.ok && ret?.error) alert(ret.error)
  await loadOnce()
}

onMounted(async () => { await loadOnce(); startAuto() })
onBeforeUnmount(stopAuto)
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <div class="left">后端日志 {{ info.size || 0 }} bytes · <span class="muted">{{ info.path }}</span></div>
      <div class="right">
        <button class="btn" @click="loadOnce" :disabled="loading">{{ loading ? '刷新中…' : '刷新' }}</button>
        <button class="btn" @click="openFolder">在访达中显示</button>
        <button class="btn" @click="clearLog">清空</button>
      </div>
    </div>
    <pre class="log-body">{{ content }}</pre>
  </div>
</template>

<style scoped>
.panel { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(255,255,255,.04); height: 100%; display: grid; grid-template-rows: auto 1fr; }
.toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
.left { font-size: 12px; }
.muted { opacity: .7; }
.right { display: flex; gap: 6px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 6px 10px; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,.12); }
.log-body { white-space: pre-wrap; overflow: auto; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 12px; }
</style>
