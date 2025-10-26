import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'
import waitOn from 'wait-on'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let backend: ReturnType<typeof spawn> | null = null
let serverCfg: {
  addr?: string
  dataDir?: string
  dataKey?: string
  imgKey?: string
  workDir?: string
  platform?: string
  version?: number
  autoDecrypt?: boolean
} = {}

type AppConfig = typeof serverCfg & { startOnLaunch?: boolean; useExternal?: boolean }
let appConfig: AppConfig = {}
let configPath = ''

function loadConfig(): AppConfig {
  try {
    if (configPath && fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(raw)
    }
  } catch {}
  return {}
}

function saveConfig(cfg: AppConfig) {
  try {
    if (!configPath) return
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
  } catch {}
}

function repoRoot(): string {
  // APP_ROOT = packages/chatlog-desktop
  const appRoot = process.env.APP_ROOT || path.join(__dirname, '..')
  return path.resolve(appRoot, '..', '..')
}

function resolveBundledBin(): string | null {
  // When packaged: process.resourcesPath points to app resources
  // We copy backend to Resources/chatlog (a single file). Some packagers may create a folder.
  const candidates = [
    path.join(process.resourcesPath || '', 'chatlog', 'chatlog'), // folder + binary
    path.join(process.resourcesPath || '', 'chatlog'),            // plain file
    path.join(process.resourcesPath || '', 'Resources', 'chatlog')
  ]
  for (const p of candidates) {
    try { if (p && require('fs').existsSync(p)) return p } catch {}
  }
  return null
}

function detectWeChatDataDir(): string | null {
  const homeDir = require('os').homedir()
  const platform = process.platform

  if (platform === 'darwin') {
    // macOS paths
    const wechatPaths = [
      path.join(homeDir, 'Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat'),
      path.join(homeDir, 'Library/Application Support/com.tencent.xinWeChat'),
      path.join(homeDir, 'Documents/WeChat Files'),
    ]

    for (const basePath of wechatPaths) {
      try {
        // Check for version directory
        const versionDir = path.join(basePath, '2.0b4.0.9')
        if (require('fs').existsSync(versionDir)) {
          // Check for subdirectory structure (newer WeChat versions)
          const items = require('fs').readdirSync(versionDir)
          const subdirs = items.filter((item: string) => {
            const itemPath = path.join(versionDir, item)
            try {
              return require('fs').statSync(itemPath).isDirectory() && item.length === 32 // UUID-like directory
            } catch {
              return false
            }
          })

          if (subdirs.length > 0) {
            // Use the first subdirectory (usually the user data)
            const actualDataDir = path.join(versionDir, subdirs[0])
            console.log(`Detected WeChat subdirectory structure: ${actualDataDir}`)
            return actualDataDir
          }

          // If no subdirectories, try the version directory directly
          if (require('fs').existsSync(path.join(versionDir, 'Message'))) {
            return versionDir
          }
        }
      } catch (error) {
        // Continue to next path
      }
    }
  } else if (platform === 'win32') {
    // Windows paths
    const wechatPaths = [
      path.join(homeDir, 'Documents', 'WeChat Files'),
      path.join(homeDir, 'AppData', 'Roaming', 'Tencent', 'WeChat'),
      path.join('C:\\Program Files (x86)\\Tencent\\WeChat'),
      path.join('C:\\Program Files\\Tencent\\WeChat'),
    ]

    for (const basePath of wechatPaths) {
      try {
        // Check for WeChat Files directory
        if (require('fs').existsSync(basePath)) {
          // Look for WeChat Data directories
          const items = require('fs').readdirSync(basePath)
          const dataDirs = items.filter((item: string) => {
            const itemPath = path.join(basePath, item)
            try {
              return require('fs').statSync(itemPath).isDirectory() && item.includes('wxid_')
            } catch {
              return false
            }
          })

          if (dataDirs.length > 0) {
            const actualDataDir = path.join(basePath, dataDirs[0])
            console.log(`Detected Windows WeChat data directory: ${actualDataDir}`)
            return actualDataDir
          }

          // If no user directories, try the base path
          if (require('fs').existsSync(path.join(basePath, 'Message'))) {
            return basePath
          }
        }
      } catch (error) {
        // Continue to next path
      }
    }
  }

  return null
}

function isConfigReady(cfg: Partial<typeof serverCfg> & Partial<AppConfig>): boolean {
  const hasDirs = !!(cfg.dataDir && cfg.dataDir.length) || !!(cfg.workDir && cfg.workDir.length)
  const hasKey = !!(cfg.dataKey && cfg.dataKey.length)
  return hasDirs && hasKey
}

function buildServerArgs(cfg: typeof serverCfg): string[] {
  const args = ['server']
  const plat = cfg.platform || (process.platform === 'darwin' ? 'darwin' : (process.platform === 'win32' ? 'windows' : ''))
  // Default to v3 for modern WeChat; backend will fail fast if mismatched
  // Windows typically uses v3, macOS can be v3 or v4
  const ver = cfg.version && cfg.version > 0 ? cfg.version : 3
  if (cfg.addr) args.push('--addr', cfg.addr)
  if (cfg.dataDir) args.push('--data-dir', cfg.dataDir)
  // Only include dataKey if it's a real key (not the default placeholder)
  if (cfg.dataKey && cfg.dataKey !== 'default-key-for-initial-setup') args.push('--data-key', cfg.dataKey)
  if (cfg.imgKey) args.push('--img-key', cfg.imgKey)
  if (cfg.workDir) args.push('--work-dir', cfg.workDir)
  if (plat) args.push('--platform', plat)
  if (ver) args.push('--version', String(ver))
  // Always enable auto-decrypt - let backend handle key acquisition automatically
  args.push('--auto-decrypt')
  return args
}

async function stopBackend(force = false) {
  return new Promise<void>((resolve) => {
    if (!backend) return resolve()
    const p = backend; backend = null
    const timer = setTimeout(() => { try { p.kill('SIGKILL') } catch {} resolve() }, force ? 200 : 1500)
    p.once('exit', () => { clearTimeout(timer); resolve() })
    try { p.kill('SIGTERM') } catch { try { p.kill() } catch {} }
  })
}

async function spawnBackend(cfg?: Partial<typeof serverCfg>) {
  if (cfg) serverCfg = { ...serverCfg, ...cfg }

  // Auto-detect data directory if not provided
  if (!serverCfg.dataDir) {
    const detectedDataDir = detectWeChatDataDir()
    if (detectedDataDir) {
      serverCfg.dataDir = detectedDataDir
      console.log(`Auto-detected WeChat data directory: ${detectedDataDir}`)
    }
  }

  // persist serverCfg to config
  appConfig = { ...appConfig, ...serverCfg }
  saveConfig(appConfig)
  await stopBackend()
  const rr = repoRoot()
  const binName = process.platform === 'win32' ? 'chatlog.exe' : 'chatlog'
  const packaged = resolveBundledBin()
  const envBin = process.env.CHATLOG_BIN
  const candidates = [
    envBin,
    packaged,
    path.join(rr, 'packages', 'chatlog_macos', 'chatlog'),
    path.join(rr, 'bin', binName),
  ].filter(Boolean) as string[]
  let binPath = candidates.find(p => { try { return require('fs').existsSync(p) } catch { return false } }) || ''
  const addr = serverCfg.addr || process.env.CHATLOG_HTTP_ADDR || '127.0.0.1:5030'
  serverCfg.addr = addr
  const env = { ...process.env, CHATLOG_HTTP_ADDR: addr }
  // Use a stable cwd in packaged app to avoid path issues
  const cwd = process.resourcesPath || rr

  // Backend now handles auto key acquisition, no need to pre-acquire here
  console.log('Starting backend - it will auto-acquire dataKey if needed')

  const cmd = binPath
  const args = buildServerArgs(serverCfg)
  console.log(`Attempting to start backend: ${cmd} ${args.join(' ')}`)
  console.log(`Working directory: ${cwd}`)
  console.log(`Binary exists: ${require('fs').existsSync(cmd)}`)

  // Prepare log file under userData
  const logDir = app.getPath('userData')
  const logFile = path.join(logDir, 'chatlog-server.log')
  try { fs.mkdirSync(logDir, { recursive: true }) } catch {}
  try {
    backend = spawn(cmd, args, { cwd, env, stdio: 'pipe' })
    console.log('Backend spawned successfully')
  } catch (error) {
    console.log(`Failed to spawn backend: ${error}`)
    // fallback to `go run . server`
    const go = process.platform === 'win32' ? 'go.exe' : 'go'
    console.log(`Falling back to go run: ${go} run . ${args.join(' ')}`)
    backend = spawn(go, ['run', '.', ...args], { cwd, env, stdio: 'pipe' })
  }

  const append = (text: string) => {
    try { fs.appendFileSync(logFile, text) } catch {}
  }
  backend?.stdout?.on('data', (d) => { const s = String(d); process.stdout.write(`[server] ${s}`); append(s) })
  backend?.stderr?.on('data', (d) => { const s = String(d); process.stderr.write(`[server] ${s}`); append(s) })
  backend?.on('exit', async (_code, _signal) => {
    // do not auto-restart; user or config change will start it explicitly
    backend = null
    append(`\n[server] exited code=${_code} signal=${_signal}\n`)
  })

  // wait for health
  console.log(`Waiting for backend health check at http://${addr}/health`)
  try {
    await waitOn({ resources: [`http://${addr}/health`], timeout: 30000, validateStatus: () => true })
    console.log('Backend health check passed - backend should now have auto-acquired dataKey if needed')
  } catch (error) {
    console.log(`Backend health check failed: ${error}`)
    throw error
  }
}

function createWindow() {
  const isDev = !!VITE_DEV_SERVER_URL
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    title: '群聊总结大师',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 14 } : undefined,
    backgroundColor: '#1e1e1e',
    width: 1200,
    height: 900,
    minHeight: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: !isDev, // relax CORS in dev for API calls
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())

    // Send configuration status to renderer
    const isConfigured = isConfigReady(serverCfg)
    win?.webContents.send('config:status', {
      configured: isConfigured,
      needsConfig: !isConfigured,
      configKeys: {
        hasDataDir: !!(serverCfg.dataDir && serverCfg.dataDir.length) || !!(serverCfg.workDir && serverCfg.workDir.length),
        hasDataKey: !!(serverCfg.dataKey && serverCfg.dataKey.length)
      }
    })
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    try { backend?.kill('SIGTERM') } catch {}
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Always stop backend on app quit (including macOS Cmd+Q)
app.on('before-quit', async () => {
  try { await stopBackend(true) } catch {}
})

app.whenReady().then(async () => {
  configPath = path.join(app.getPath('userData'), 'chatlog-electron.json')
  appConfig = loadConfig()
  // bootstrap server config from stored config
  serverCfg = { ...serverCfg, ...appConfig }
  const addr = serverCfg.addr || process.env.CHATLOG_HTTP_ADDR || '127.0.0.1:5030'
  // Always attempt to start backend and let it auto-detect WeChat directories/keys
  try {
    await spawnBackend({ addr })
    console.log('Backend started (auto-detect mode)')
  } catch (error) {
    console.log('Backend failed to auto-start:', error)
  }
  createWindow()
})

// IPC: backend control
ipcMain.handle('backend:getState', async () => ({ running: !!backend, addr: serverCfg.addr || '127.0.0.1:5030' }))
ipcMain.handle('backend:start', async (_e, cfg: Partial<typeof serverCfg>) => {
  try {
    if (appConfig.useExternal) {
      serverCfg = { ...serverCfg, ...cfg }
      appConfig = { ...appConfig, ...serverCfg }
      saveConfig(appConfig)
      return { ok: true }
    }
    await spawnBackend(cfg)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
})
ipcMain.handle('backend:stop', async () => { if (!appConfig.useExternal) { await stopBackend(true) }; return { ok: true } })

// IPC: chat operations via CLI
function runChatlog(args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }) {
  const rr = repoRoot()
  const binName = process.platform === 'win32' ? 'chatlog.exe' : 'chatlog'
  const packaged = resolveBundledBin()
  const envBin = process.env.CHATLOG_BIN
  const fs = require('fs') as typeof import('fs')
  const candidates = [
    envBin,
    packaged,
    path.join(rr, 'packages', 'chatlog_macos', 'chatlog'),
    path.join(rr, 'bin', binName),
  ].filter(Boolean) as string[]
  const env = { ...process.env, ...(opts?.env || {}) }
  const cwd = opts?.cwd || (process.resourcesPath || rr)

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    let out = '', err = ''
    const trySpawn = (idx: number) => {
      if (idx >= candidates.length) {
        // final fallback: go run
        const go = process.platform === 'win32' ? 'go.exe' : 'go'
        const p = spawn(go, ['run', '.', ...args], { cwd, env })
        p.stdout.on('data', (d) => (out += String(d)))
        p.stderr.on('data', (d) => (err += String(d)))
        p.on('error', (e) => { err += `\n${e?.message || e}` })
        p.on('exit', (code) => resolve({ code, stdout: out, stderr: err }))
        return
      }
      const binPath = candidates[idx]
      try {
        if (!fs.existsSync(binPath)) return trySpawn(idx + 1)
        const p = spawn(binPath, args, { cwd, env })
        p.stdout.on('data', (d) => (out += String(d)))
        p.stderr.on('data', (d) => (err += String(d)))
        p.on('error', (_e) => {
          // try next candidate
          trySpawn(idx + 1)
        })
        p.on('exit', (code) => resolve({ code, stdout: out, stderr: err }))
      } catch (_e) {
        trySpawn(idx + 1)
      }
    }
    trySpawn(0)
  })
}

ipcMain.handle('op:getDataKey', async (_e, payload: { pid?: number; force?: boolean; showXorKey?: boolean }) => {
  const args = ['key']
  if (payload?.pid) args.push('--pid', String(payload.pid))
  if (payload?.force) args.push('--force')
  if (payload?.showXorKey) args.push('--xor-key')
  const ret = await runChatlog(args)
  if (ret.code === 0) return { ok: true, output: ret.stdout.trim() }
  return { ok: false, error: ret.stderr || ret.stdout }
})

ipcMain.handle('op:decrypt', async (_e, payload: { platform?: string; version?: number; dataDir?: string; dataKey?: string; workDir?: string }) => {
  const args = ['decrypt']
  if (payload?.platform) args.push('--platform', payload.platform)
  if (payload?.version) args.push('--version', String(payload.version))
  if (payload?.dataDir) args.push('--data-dir', payload.dataDir)
  if (payload?.dataKey) args.push('--data-key', payload.dataKey)
  if (payload?.workDir) args.push('--work-dir', payload.workDir)
  const ret = await runChatlog(args)
  if (ret.code === 0) return { ok: true, output: ret.stdout.trim() }
  return { ok: false, error: ret.stderr || ret.stdout }
})

// IPC: config
ipcMain.handle('config:get', async () => appConfig)
ipcMain.handle('config:set', async (_e, cfg: Partial<AppConfig>) => {
  appConfig = { ...appConfig, ...cfg }
  // also merge to server config for next start
  serverCfg = { ...serverCfg, ...cfg }
  saveConfig(appConfig)
  return { ok: true }
})

// IPC: select directory
ipcMain.handle('dialog:selectDirectory', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  if (res.canceled || !res.filePaths?.length) return { canceled: true }
  return { canceled: false, path: res.filePaths[0] }
})

// IPC: save data url as file (PNG)
ipcMain.handle('file:saveDataUrl', async (_e, payload: { dataUrl: string; defaultPath?: string }) => {
  try {
    const dataUrl = String(payload?.dataUrl || '')
    if (!dataUrl.startsWith('data:image/')) return { ok: false, error: '无效的图片数据' }
    const res = await dialog.showSaveDialog({
      defaultPath: payload?.defaultPath || 'summary.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (res.canceled || !res.filePath) return { ok: false, canceled: true }
    const filePath = res.filePath
    const b64 = dataUrl.split(',')[1]
    const buf = Buffer.from(b64, 'base64')
    fs.writeFileSync(filePath, buf)
    return { ok: true, path: filePath }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
})

// IPC: backend logs
ipcMain.handle('logs:read', async () => {
  try {
    const logDir = app.getPath('userData')
    const logFile = path.join(logDir, 'chatlog-server.log')
    let content = ''
    try { content = fs.readFileSync(logFile, 'utf-8') } catch { content = '' }
    const st = fs.existsSync(logFile) ? fs.statSync(logFile) : null
    return { ok: true, content, size: st?.size || 0, mtime: st?.mtimeMs || 0, path: logFile }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
})
ipcMain.handle('logs:open', async () => {
  try {
    const p = path.join(app.getPath('userData'), 'chatlog-server.log')
    if (fs.existsSync(p)) { await shell.showItemInFolder(p); return { ok: true } }
    return { ok: false, error: '日志文件不存在' }
  } catch (e: any) { return { ok: false, error: e?.message || String(e) } }
})
ipcMain.handle('logs:clear', async () => {
  try {
    const p = path.join(app.getPath('userData'), 'chatlog-server.log')
    if (fs.existsSync(p)) fs.truncateSync(p, 0)
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e?.message || String(e) } }
})

// IPC: summarize a single day's chat via external API
// payload: { date: 'YYYY-MM-DD', talker: string, prompt?: string }
ipcMain.handle('summarize:day', async (e, payload: { date: string; talker?: string; talkers?: string; prompt?: string; requestId?: string }) => {
  try {
    const date = String(payload?.date || '').trim()
    const talkerSingle = String(payload?.talker || '').trim()
    const talkersCsv = String(payload?.talkers || '').trim()
    const talkerParam = [talkerSingle, ...talkersCsv.split(',').map(s => s.trim()).filter(Boolean)].filter(Boolean).join(',')
    if (!date) return { ok: false, error: '必须选择日期' }
    if (!talkerParam) return { ok: false, error: '请至少填写一个聊天对象' }

    const addr = serverCfg.addr || process.env.CHATLOG_HTTP_ADDR || '127.0.0.1:5030'
    const base = `http://${addr}`
    const reqId = payload?.requestId || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const talkers = talkerParam.split(',').map(s => s.trim()).filter(Boolean)
    const sendProgress = (piece: string) => { try { e.sender.send('summarize:progress', { requestId: reqId, content: piece }) } catch {} }
    const sendGroup = (idx: number, total: number, talkerId: string, name: string) => { try { e.sender.send('summarize:group', { requestId: reqId, index: idx, total, talker: talkerId, name }) } catch {} }

    for (let i = 0; i < talkers.length; i++) {
      const tId = talkers[i]
      // fetch this group's messages for the day
      const url = `${base}/api/v1/chatlog?format=json&time=${encodeURIComponent(date)}&talker=${encodeURIComponent(tId)}`
      const res = await fetch(url)
      if (!res.ok) return { ok: false, error: `获取聊天记录失败：${res.status} ${res.statusText}` }
      const msgs = await res.json() as Array<{ time?: string; senderName?: string; sender?: string; content?: string; talkerName?: string; talker?: string }>
      const groupName = (msgs?.[0]?.talkerName || tId)
      // notify group start
      sendGroup(i + 1, talkers.length, tId, groupName)
      // heading
      sendProgress(`\n\n## 群：${groupName}\n\n`)
      // build plain text
      const lines: string[] = []
      for (const m of msgs) {
        const ts = m.time ? new Date(m.time).toLocaleString() : ''
        const room = m.talkerName || m.talker || ''
        const sender = m.senderName || m.sender || ''
        const content = (m.content || '').replace(/\s+/g, ' ').trim()
        const prefix = room ? `[${room}] ` : ''
        lines.push(`${ts} ${prefix}${sender}: ${content}`.trim())
      }
      const message = lines.join('\n')

      const body = JSON.stringify({ prompt: payload?.prompt || '', message })
      const summaryURL = 'https://n8n-preview.beqlee.icu/webhook/b2199135-477f-4fab-b45e-dfd21ef1f86b'
      const sres = await fetch(summaryURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

      const bodyStream: any = (sres as any).body
      if (bodyStream && typeof bodyStream.getReader === 'function') {
        const reader = bodyStream.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx)
            buf = buf.slice(idx + 1)
            const t = line.trim(); if (!t) continue
            try {
              const obj = JSON.parse(t)
              if (obj?.type === 'item') {
                const c = obj?.content
                if (typeof c === 'string' && c && c !== 'undefined') sendProgress(c)
              }
            } catch {
              sendProgress(t)
            }
          }
        }
        const rem = buf.trim(); if (rem) { try { const obj = JSON.parse(rem); if (obj?.type === 'item' && typeof obj?.content === 'string') sendProgress(obj.content) } catch { sendProgress(rem) } }
      } else {
        const raw = await sres.text()
        const lines = raw.split(/\r?\n/)
        for (const line of lines) {
          const t = line.trim(); if (!t) continue
          try { const obj = JSON.parse(t); if (obj?.type === 'item' && typeof obj?.content === 'string' && obj.content !== 'undefined') sendProgress(obj.content) } catch { sendProgress(t) }
        }
      }
    }
    return { ok: true, status: 200 }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
})
