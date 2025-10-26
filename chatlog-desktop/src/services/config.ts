import type { BackendCfg } from './ipc'

export type AppConfig = BackendCfg & { startOnLaunch?: boolean; useExternal?: boolean }

export const ConfigAPI = {
  get: () => window.ipcRenderer.invoke('config:get') as Promise<AppConfig>,
  set: (cfg: Partial<AppConfig>) => window.ipcRenderer.invoke('config:set', cfg) as Promise<{ ok: boolean }>,
  pickDir: () => window.ipcRenderer.invoke('dialog:selectDirectory') as Promise<{ canceled: boolean; path?: string }>,
}
