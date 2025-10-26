<script setup lang="ts">
import { onMounted, ref } from 'vue'

const info = ref({
  account: '', pid: '', version: '', http: '', data: '', work: '',
})

async function refresh() {
  try {
    const state = await window.ipcRenderer.invoke('backend:getState')
    const base = state?.addr?.startsWith('http') ? state.addr : `http://${state?.addr || '127.0.0.1:5030'}`
    const res = await fetch(base + '/api/v1/session')
    if (res.ok) {
      // placeholder: only to test connectivity
      info.value.http = base
    }
  } catch {}
}

onMounted(() => {
  refresh()
  setInterval(refresh, 5000)
})
</script>

<template>
  <footer class="status">
    <div>HTTP: <b>{{ info.http || '未启动' }}</b></div>
    <div>账号: {{ info.account || '-' }}</div>
    <div>版本: {{ info.version || '-' }}</div>
  </footer>
</template>

<style scoped>
.status { display: grid; grid-template-columns: auto auto auto 1fr; gap: 16px; align-items: center; padding: 6px 12px; border-top: 1px solid rgba(255,255,255,.08); font-size: 12px; opacity: .9; }
</style>
