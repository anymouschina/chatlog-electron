<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { ConfigAPI, type AppConfig } from '../services/config'
import { IPC } from '../services/ipc'

const cfg = reactive<AppConfig>({ addr: '127.0.0.1:5030', dataDir: '', workDir: '', dataKey: '', platform: '', version: undefined, autoDecrypt: false, startOnLaunch: true, useExternal: false })

async function load() {
  const c = await ConfigAPI.get()
  Object.assign(cfg, c)
}

async function save() {
  await ConfigAPI.set(cfg)
  alert('设置已保存')
}

async function restartServer() {
  await IPC.start(cfg)
  const u = new URL((cfg.addr || 'http://127.0.0.1:5030').startsWith('http') ? (cfg.addr as string) : `http://${cfg.addr}`)
  const base = `${u.protocol}//${u.host}`
  const mod = await import('../services/backend')
  mod.setBase(base)
  alert('服务已重启并应用配置')
}

async function pickDataDir() {
  const r = await ConfigAPI.pickDir(); if (!r.canceled && r.path) cfg.dataDir = r.path
}
async function pickWorkDir() {
  const r = await ConfigAPI.pickDir(); if (!r.canceled && r.path) cfg.workDir = r.path
}

onMounted(load)
</script>

<template>
  <div class="grid">
    <div class="card">
      <h3>服务</h3>
      <div class="row"><label>地址</label><input v-model="(cfg.addr as any)" class="input" placeholder="127.0.0.1:5030" /></div>
      <div class="row"><label>外部后端</label><input type="checkbox" v-model="(cfg.useExternal as any)" /> <span class="hint">启用后，应用将不再拉起/停止内置后端，仅使用上面的地址通信</span></div>
      <div class="row"><label>自动解密</label><input type="checkbox" v-model="(cfg.autoDecrypt as any)" /></div>
      <div class="row">
        <button class="btn" @click="restartServer">应用并重启</button>
      </div>
    </div>
    <div class="card">
      <h3>路径</h3>
      <div class="row"><label>数据目录</label><input v-model="(cfg.dataDir as any)" class="input" /><button class="btn" @click="pickDataDir">选择</button></div>
      <div class="row"><label>工作目录</label><input v-model="(cfg.workDir as any)" class="input" /><button class="btn" @click="pickWorkDir">选择</button></div>
    </div>
    <div class="card">
      <h3>安全</h3>
      <div class="row"><label>数据密钥</label><input v-model="(cfg.dataKey as any)" class="input" placeholder="DataKey" /></div>
      <div class="row"><label>图片密钥</label><input v-model="(cfg.imgKey as any)" class="input" placeholder="ImgKey (可选)" /></div>
    </div>
    <div class="card">
      <h3>平台</h3>
      <div class="row"><label>平台</label><input v-model="(cfg.platform as any)" class="input" placeholder="darwin/windows" /></div>
      <div class="row"><label>版本</label><input v-model.number="(cfg.version as any)" class="input" placeholder="0" /></div>
    </div>
    <div class="card">
      <h3>操作</h3>
      <div class="row"><button class="btn" @click="save">保存</button></div>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.card { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.04); min-height: 140px; }
.row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
label { width: 80px; opacity: .8; }
.input { flex: 1; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: inherit; padding: 8px 10px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 8px 12px; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,.12); }
.hint { opacity: .7; font-size: 12px; }
</style>
