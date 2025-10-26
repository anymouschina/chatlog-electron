export type BackendCfg = Partial<{
  addr: string
  dataDir: string
  dataKey: string
  imgKey: string
  workDir: string
  platform: string
  version: number
  autoDecrypt: boolean
}>

export const IPC = {
  getState: () => window.ipcRenderer.invoke('backend:getState') as Promise<{ running: boolean; addr: string }>,
  start: (cfg: BackendCfg) => window.ipcRenderer.invoke('backend:start', cfg) as Promise<{ ok: boolean }>,
  stop: () => window.ipcRenderer.invoke('backend:stop') as Promise<{ ok: boolean }>,
  getDataKey: (p: { pid?: number; force?: boolean; showXorKey?: boolean }) => window.ipcRenderer.invoke('op:getDataKey', p) as Promise<{ ok: boolean; output?: string; error?: string }>,
  decrypt: (p: { platform?: string; version?: number; dataDir?: string; dataKey?: string; workDir?: string }) => window.ipcRenderer.invoke('op:decrypt', p) as Promise<{ ok: boolean; output?: string; error?: string }>,
}

