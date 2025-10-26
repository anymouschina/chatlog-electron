export interface PagedResp<T> { items: T[] }

export interface Session { userName: string; nickName: string; content: string; nOrder: number; nTime: string }
export interface Contact { userName: string; alias: string; remark: string; nickName: string; isFriend?: boolean }
export interface ChatRoomUser { userName: string; displayName: string }
export interface ChatRoom { name: string; remark?: string; nickName?: string; owner: string; users?: ChatRoomUser[] }
export interface Message { seq?: number; time?: string; talker?: string; talkerName?: string; sender?: string; senderName?: string; content?: string; type?: number; isSelf?: boolean; contents?: Record<string, any> }

let baseURL: string = (import.meta.env.VITE_CHATLOG_SERVER as string) || 'http://127.0.0.1:5030'

export function setBase(url: string) {
  baseURL = url
}
export function getBase() { return baseURL }

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(baseURL + url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const Backend = {
  get baseURL() { return baseURL },
  set baseURL(v: string) { baseURL = v },
  health: async () => {
    const res = await fetch(baseURL + '/health')
    return res.ok
  },
  getSessions: (params?: { keyword?: string; limit?: number; offset?: number }) =>
    http<PagedResp<Session>>(`/api/v1/session?format=json${params?.keyword ? `&keyword=${encodeURIComponent(params.keyword)}` : ''}${params?.limit ? `&limit=${params.limit}` : ''}${params?.offset ? `&offset=${params.offset}` : ''}`),
  getContacts: (params?: { keyword?: string; limit?: number; offset?: number }) =>
    http<PagedResp<Contact>>(`/api/v1/contact?format=json${params?.keyword ? `&keyword=${encodeURIComponent(params.keyword)}` : ''}${params?.limit ? `&limit=${params.limit}` : ''}${params?.offset ? `&offset=${params.offset}` : ''}`),
  getChatRooms: (params?: { keyword?: string; limit?: number; offset?: number }) =>
    http<PagedResp<ChatRoom>>(`/api/v1/chatroom?format=json${params?.keyword ? `&keyword=${encodeURIComponent(params.keyword)}` : ''}${params?.limit ? `&limit=${params.limit}` : ''}${params?.offset ? `&offset=${params.offset}` : ''}`),
  getChatlog: (params: { time: string; talker?: string; sender?: string; keyword?: string; limit?: number; offset?: number }) =>
    http<Message[]>(`/api/v1/chatlog?format=json&time=${encodeURIComponent(params.time)}${params.talker ? `&talker=${encodeURIComponent(params.talker)}` : ''}${params.sender ? `&sender=${encodeURIComponent(params.sender)}` : ''}${params.keyword ? `&keyword=${encodeURIComponent(params.keyword)}` : ''}${params.limit ? `&limit=${params.limit}` : ''}${params.offset ? `&offset=${params.offset}` : ''}`),
  // control endpoints
  controlAutoDecrypt: async (enable: boolean) => {
    const res = await fetch(baseURL + '/api/v1/control/autodecrypt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enable }) })
    if (!res.ok) throw new Error('autodecrypt failed')
    return res.json()
  },
  controlDecrypt: async () => {
    const res = await fetch(baseURL + '/api/v1/control/decrypt', { method: 'POST' })
    if (!res.ok) throw new Error('decrypt failed')
    return res.json()
  },
  controlConfig: async (payload: Partial<{ addr: string; dataDir: string; dataKey: string; imgKey: string; workDir: string; platform: string; version: number }>) => {
    const res = await fetch(baseURL + '/api/v1/control/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('config failed')
    return res.json()
  },
  controlInstances: async () => {
    const res = await fetch(baseURL + '/api/v1/control/instances')
    if (!res.ok) throw new Error('instances failed')
    return res.json() as Promise<{ items: { pid: number; name: string; full_version: string; data_dir: string }[] }>
  },
  controlState: async () => {
    const res = await fetch(baseURL + '/api/v1/control/state')
    if (!res.ok) throw new Error('state failed')
    return res.json() as Promise<any>
  },
}
