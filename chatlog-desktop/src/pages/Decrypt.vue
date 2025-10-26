<script setup lang="ts">
import { ConfigAPI } from '../services/config'
import { IPC } from '../services/ipc'
async function onDecrypt() {
  // prefer server-side decrypt without restart
  try {
    const base = await IPC.getState()
    const u = (base.addr || '127.0.0.1:5030').startsWith('http') ? base.addr : `http://${base.addr}`
    const mod = await import('../services/backend'); mod.setBase(u as string)
    await (await import('../services/backend')).Backend.controlDecrypt()
    alert('解密完成')
  } catch (e) {
    // fallback to CLI
    const cfg = await ConfigAPI.get()
    const ret = await IPC.decrypt({ platform: cfg.platform, version: cfg.version, dataDir: cfg.dataDir, dataKey: cfg.dataKey, workDir: cfg.workDir })
    alert(ret.ok ? '解密完成' : `解密失败:\n${ret.error}`)
  }
}
async function onToggleAuto() {
  const cfg = await ConfigAPI.get(); cfg.autoDecrypt = !cfg.autoDecrypt; await ConfigAPI.set(cfg); await IPC.start(cfg); alert(`自动解密：${cfg.autoDecrypt ? '已开启' : '已关闭'}`)
}
</script>

<template>
  <div class="grid">
    <div class="card">
      <h3>解密操作</h3>
      <button class="btn" @click="onDecrypt">🔓 解密数据</button>
      <button class="btn" @click="onToggleAuto">⚙️ 自动解密 开/关</button>
    </div>
    <div class="card">
      <h3>任务列表</h3>
      <div class="task">暂无任务</div>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.card { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.04); min-height: 200px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 8px 12px; cursor: pointer; margin-right: 8px; }
.btn:hover { background: rgba(255,255,255,.12); }
</style>
