<script setup lang="ts">
import { useRouter } from 'vue-router'
import { IPC } from '../../services/ipc'
const router = useRouter()

async function onGetKey() {
  const ret = await IPC.getDataKey({})
  alert(ret.ok ? `获取成功:\n${ret.output}` : `获取失败:\n${ret.error}`)
}
async function onDecrypt() {
  const ret = await IPC.decrypt({})
  alert(ret.ok ? `解密完成` : `解密失败:\n${ret.error}`)
}
async function onToggleServer() {
  // 外部后端模式：仅切换前端数据源
  const cfg = await (await import('../../services/config')).ConfigAPI.get()
  if (cfg.useExternal) {
    const u = (cfg.addr || '127.0.0.1:5030').startsWith('http') ? (cfg.addr as string) : `http://${cfg.addr}`
    const mod = await import('../../services/backend')
    mod.setBase(u as string)
    alert(`已切换到外部后端: ${u}`)
    return
  }
  const state = await IPC.getState()
  if (state.running) {
    await IPC.stop(); alert('已停止服务')
  } else {
    const ret: any = await IPC.start({})
    if (!ret.ok) { alert(ret?.error || '启动失败，请在“设置”中完善 数据目录/工作目录 和 数据密钥'); return }
    const s = await IPC.getState(); const u = (s.addr || '127.0.0.1:5030').startsWith('http') ? s.addr : `http://${s.addr}`
    const mod = await import('../../services/backend'); mod.setBase(u as string)
    alert('已启动服务')
  }
}
async function onToggleAuto() {
  // try HTTP control first
  try {
    const base = await IPC.getState()
    const u = (base.addr || '127.0.0.1:5030').startsWith('http') ? base.addr : `http://${base.addr}`
    const mod = await import('../../services/backend'); mod.setBase(u as string)
    // naive toggle: enable=true first, if already enabled it will still return ok
    await (await import('../../services/backend')).Backend.controlAutoDecrypt(true)
    alert('已开启自动解密')
  } catch {
    // fallback: restart with flag
    const state = await IPC.getState(); await IPC.start({ autoDecrypt: true, addr: state.addr })
    alert('已开启自动解密（重启方式）')
  }
}
async function onSwitchAccount() {
  router.push('/accounts')
}
</script>

<template>
  <header class="toolbar">
    <div class="right">
      <button class="btn" @click="onGetKey">🔑 获取密钥</button>
      <button class="btn" @click="onDecrypt">🔓 解密</button>
      <button class="btn" @click="onToggleServer">🌐 启动/停止</button>
      <button class="btn" @click="onToggleAuto">⚙️ 自动解密</button>
      <button class="btn" @click="onSwitchAccount">👤 切换账号</button>
    </div>
  </header>
</template>

<style scoped>
.toolbar { display: grid; grid-template-columns: 1fr; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03); backdrop-filter: blur(20px); }
.right { display: flex; justify-content: flex-start; gap: 6px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 6px 10px; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,.12); }
</style>
