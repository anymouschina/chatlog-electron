<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, nextTick } from 'vue'
import { marked } from 'marked'
import * as htmlToImage from 'html-to-image'
import { useRoute } from 'vue-router'
import { Backend, type Message } from '../services/backend'

const route = useRoute()
const talker = computed(() => String(route.query.talker || ''))
const title = computed(() => decodeURIComponent(String(route.query.nick || '聊天记录')))

// search controls
const from = ref<string>('')
const to = ref<string>('')
const keyword = ref<string>('')
const loading = ref(false)
// summarize modal
const showSummary = ref(false)
const summaryDate = ref<string>('')
const summaryPrompt = ref<string>('')
const summaryTalkers = ref<string>('')
// multi-select picker state
const showPicker = ref(false)
const pickerTab = ref<'session'|'chatroom'>('session')
const pickerKeyword = ref('')
const pickerLoading = ref(false)
const pickerSessions = ref<any[]>([])
const pickerChatrooms = ref<any[]>([])
const selectedTalkers = ref<{ id: string; name: string }[]>([])
const summaryLoading = ref(false)
const showSummaryResult = ref(false)
const summaryResult = ref<string>('')
const summaryError = ref<string>('')
const currentReqId = ref<string>('')
const isStreaming = ref(false)
const progressCount = ref(0)
const groupIndex = ref(0)
const groupTotal = ref(0)
const currentGroupName = ref('')
// screenshot
const isCapturing = ref(false)
const messages = ref<Message[]>([])
const pageSize = 200
const offset = ref(0)
const hasMore = ref(true)
const bodyEl = ref<HTMLElement | null>(null)
const loadingMore = ref(false)
const SCROLL_THRESHOLD = 120
let scrollDebounce: any = null

function rangeString(): string {
  // default last 30 days if not set
  const now = new Date()
  const d30 = new Date(); d30.setDate(now.getDate() - 30)
  const f = from.value || d30.toISOString().slice(0,10)
  const t = to.value || now.toISOString().slice(0,10)
  return `${f}~${t}`
}

async function load() {
  if (!talker.value) return
  loading.value = true
  try {
    offset.value = 0
    const list = await Backend.getChatlog({ time: rangeString(), talker: talker.value, keyword: keyword.value || undefined, limit: pageSize, offset: offset.value })
    messages.value = list
    hasMore.value = list.length === pageSize
    await nextTick()
    // 初次加载，滚动到底部，符合聊天阅读习惯
    const el = bodyEl.value
    if (el) el.scrollTop = el.scrollHeight
    // 视口内不足以占满时，自动继续加载，直到填满或没有更多
    await ensureFilled()
  } catch (e) {
    console.error('load chat error', e)
    messages.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

function onSearch() { load() }

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    offset.value += pageSize
    const el = bodyEl.value
    const prevBottom = el ? (el.scrollHeight - el.scrollTop) : 0
    const list = await Backend.getChatlog({ time: rangeString(), talker: talker.value, keyword: keyword.value || undefined, limit: pageSize, offset: offset.value })
    messages.value = messages.value.concat(list)
    hasMore.value = list.length === pageSize
    await nextTick()
    // 维持当前位置，不回弹到顶部
    if (el) el.scrollTop = el.scrollHeight - prevBottom
  } catch (e) { console.error('load more error', e); hasMore.value = false }
  finally { loadingMore.value = false }
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (!el) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD
  if (nearBottom) {
    if (scrollDebounce) clearTimeout(scrollDebounce)
    scrollDebounce = setTimeout(() => {
      loadMore()
    }, 150)
  }
}

async function ensureFilled() {
  const el = bodyEl.value
  if (!el) return
  // 在可见高度内，自动连续加载，直到占满或没有更多
  while (hasMore.value && !loadingMore.value && el.scrollHeight <= el.clientHeight + 8) {
    await loadMore()
    await nextTick()
  }
}

let progressHandler: any
let groupHandler: any
onMounted(() => {
  load()
  const ipc = (window as any).ipcRenderer
  progressHandler = (_event: any, payload: { requestId?: string; content?: string }) => {
    if (!payload?.requestId || payload.requestId !== currentReqId.value) return
    const piece = String(payload?.content || '')
    if (!piece) return
    summaryResult.value += piece
    progressCount.value += 1
    // auto scroll result area to bottom if visible
    nextTick(() => {
      const el = document.querySelector('.modal .result') as HTMLElement | null
      if (el) el.scrollTop = el.scrollHeight
    })
  }
  ipc.on('summarize:progress', progressHandler)
  groupHandler = (_event: any, payload: { requestId?: string; index?: number; total?: number; name?: string }) => {
    if (!payload?.requestId || payload.requestId !== currentReqId.value) return
    // update group progress
    groupIndex.value = Number(payload.index || 0)
    groupTotal.value = Number(payload.total || 0)
    currentGroupName.value = String(payload.name || '')
    // reset per-group chunk counter
    progressCount.value = 0
  }
  ipc.on('summarize:group', groupHandler)
})
onBeforeUnmount(() => { try { (window as any).ipcRenderer?.off('summarize:progress', progressHandler); (window as any).ipcRenderer?.off('summarize:group', groupHandler) } catch {} })

function openSummary() {
  summaryDate.value = ''
  summaryPrompt.value = ''
  summaryTalkers.value = ''
  summaryError.value = ''
  showSummary.value = true
  // reset group progress
  groupIndex.value = 0
  groupTotal.value = 0
  currentGroupName.value = ''
}

async function startSummary() {
  summaryError.value = ''
  if (!summaryDate.value) { summaryError.value = '必须选择日期'; return }
  const extras = summaryTalkers.value.split(',').map(s => s.trim()).filter(Boolean)
  const picked = selectedTalkers.value.map(x => x.id)
  const allTalkers = [talker.value, ...extras, ...picked].filter(Boolean)
  if (!allTalkers.length) { summaryError.value = '请至少填写一个聊天对象（可在“更多聊天对象”中输入）'; return }
  summaryLoading.value = true
  try {
    const ipc = (window as any).ipcRenderer
    // prepare UI for progressive display
    summaryResult.value = ''
    showSummary.value = false
    showSummaryResult.value = true
    currentReqId.value = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
    isStreaming.value = true
    progressCount.value = 0
    const ret = await ipc.invoke('summarize:day', { date: summaryDate.value, talker: talker.value || '', talkers: [...new Set([...extras, ...picked])].join(','), prompt: summaryPrompt.value || '', requestId: currentReqId.value })
    if (!ret?.ok) throw new Error(ret?.error || '总结失败')
    isStreaming.value = false
  } catch (e: any) {
    summaryError.value = e?.message || String(e)
    isStreaming.value = false
  } finally {
    summaryLoading.value = false
  }
}

function openPicker() {
  pickerKeyword.value = ''
  pickerTab.value = 'session'
  pickerSessions.value = []
  pickerChatrooms.value = []
  showPicker.value = true
  loadPicker()
}

async function loadPicker() {
  try {
    pickerLoading.value = true
    if (pickerTab.value === 'session') {
      const resp = await Backend.getSessions({ keyword: pickerKeyword.value || undefined, limit: 200, offset: 0 })
      pickerSessions.value = resp.items || []
    } else {
      const resp = await Backend.getChatRooms({ keyword: pickerKeyword.value || undefined, limit: 200, offset: 0 })
      pickerChatrooms.value = resp.items || []
    }
  } catch (e) {
    console.error('load picker error', e)
  } finally {
    pickerLoading.value = false
  }
}

function togglePick(id: string, name: string) {
  const idx = selectedTalkers.value.findIndex(x => x.id === id)
  if (idx >= 0) selectedTalkers.value.splice(idx, 1)
  else selectedTalkers.value.push({ id, name })
  // sync to input
  const list = new Set(summaryTalkers.value.split(',').map(s => s.trim()).filter(Boolean))
  list.add(id)
  summaryTalkers.value = Array.from(list).join(',')
}

function removePicked(id: string) {
  const idx = selectedTalkers.value.findIndex(x => x.id === id)
  if (idx >= 0) selectedTalkers.value.splice(idx, 1)
  const list = summaryTalkers.value.split(',').map(s => s.trim()).filter(Boolean).filter(x => x !== id)
  summaryTalkers.value = list.join(',')
}

async function exportImage() {
  try {
    const node = document.querySelector('.modal .result') as HTMLElement | null
    if (!node) throw new Error('未找到总结内容区域')
    // Clone to remove viewport constraints, capture full content as long image
    const wrapper = document.createElement('div')
    wrapper.style.position = 'absolute'
    wrapper.style.left = '-10000px'
    wrapper.style.top = '0'
    wrapper.style.padding = '12px'
    wrapper.style.background = '#232323'
    wrapper.style.color = getComputedStyle(node).color || '#fff'
    wrapper.style.width = `${node.clientWidth}px`
    const clone = node.cloneNode(true) as HTMLElement
    clone.style.maxHeight = 'none'
    clone.style.overflow = 'visible'
    clone.style.height = 'auto'
    clone.style.width = '100%'
    wrapper.appendChild(clone)
    document.body.appendChild(wrapper)
    await nextTick()
    const width = Math.max(clone.scrollWidth, wrapper.clientWidth)
    const height = clone.scrollHeight
    // Very tall images can fail due to canvas limits; lower pixelRatio when too long
    const pixelRatio = height > 12000 ? 1 : 2
    const dataUrl = await htmlToImage.toPng(clone, { cacheBust: true, pixelRatio, backgroundColor: '#232323', width, height, style: { maxHeight: 'none', overflow: 'visible', height: 'auto' } })
    document.body.removeChild(wrapper)
    const ipc = (window as any).ipcRenderer
    const ret = await ipc.invoke('file:saveDataUrl', { dataUrl, defaultPath: '智能总结.png' })
    if (ret?.canceled) return
    if (!ret?.ok) throw new Error(ret?.error || '保存失败')
    alert('已保存图片到：' + ret.path)
  } catch (e: any) {
    alert(e?.message || String(e))
  }
}

function copySummary() {
  try { navigator.clipboard?.writeText(summaryResult.value) } catch {}
}

async function captureScreenshot() {
  if (isCapturing.value || !messages.value.length) return
  isCapturing.value = true

  try {
    // 使用 html2canvas 库来截图
    const html2canvas = (window as any).html2canvas
    if (!html2canvas) {
      // 动态加载 html2canvas
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
      document.head.appendChild(script)

      await new Promise((resolve) => {
        script.onload = resolve
      })
    }

    const chatBody = bodyEl.value
    if (!chatBody) return

    // 等待所有内容加载完成
    await nextTick()

    // 创建一个临时的容器来包含所有聊天内容
    const tempContainer = document.createElement('div')
    tempContainer.style.cssText = `
      position: fixed;
      top: -9999px;
      left: 0;
      width: ${chatBody.scrollWidth}px;
      background: #232323;
      padding: 20px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `

    // 复制聊天内容
    tempContainer.innerHTML = chatBody.innerHTML

    // 添加标题
    const titleEl = document.createElement('div')
    titleEl.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      color: #fff;
    `
    titleEl.textContent = `${title.value} (${from.value || '开始'} ~ ${to.value || '现在'})`
    tempContainer.insertBefore(titleEl, tempContainer.firstChild)

    document.body.appendChild(tempContainer)

    // 截图
    const canvas = await (window as any).html2canvas(tempContainer, {
      backgroundColor: '#232323',
      scale: 2, // 高清截图
      useCORS: true,
      allowTaint: true,
      height: tempContainer.scrollHeight,
      width: tempContainer.scrollWidth
    })

    // 转换为 blob 并下载
    canvas.toBlob((blob: Blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `聊天记录_${title.value}_${new Date().toISOString().slice(0,10)}.png`
      a.click()
      URL.revokeObjectURL(url)
    })

    // 清理临时元素
    document.body.removeChild(tempContainer)

  } catch (error: any) {
    console.error('截图失败:', error)
    alert('截图失败: ' + error.message)
  } finally {
    isCapturing.value = false
  }
}
</script>

<template>
  <div class="chat-wrap">
    <div class="search">
      <div class="title">{{ title }}</div>
      <div class="controls">
        <label>起始</label>
        <input type="date" v-model="from" />
        <label>结束</label>
        <input type="date" v-model="to" />
        <input class="kw" placeholder="关键字（可选）" v-model="keyword" @keyup.enter="onSearch" />
        <button class="btn" @click="onSearch">查询</button>
        <button class="btn" @click="openSummary">智能总结</button>
        <button class="btn" @click="captureScreenshot" :disabled="isCapturing || !messages.length">
          {{ isCapturing ? '生成中…' : '生成图片' }}
        </button>
      </div>
    </div>
    <div ref="bodyEl" class="chat-body" v-if="!loading" @scroll.passive="onScroll">
      <template v-if="messages.length">
        <div v-for="(m, i) in messages" :key="i">
          <div class="time" v-if="i===0 || new Date(messages[i-1]?.time||'').getTime()+600000 < new Date(m.time||'').getTime()">{{ new Date(m.time||'').toLocaleString() }}</div>
          <div class="msg" :class="m.isSelf ? 'right' : 'left'">
            <div class="sender" v-if="!m.isSelf">{{ m.senderName || m.sender }}</div>
            <div class="bubble" :class="m.isSelf ? 'right' : 'left'">
              <template v-if="m.type === 3">
                <span class="content">图片消息暂不支持</span>
              </template>
              <template v-else>
                <span class="content">{{ m.content }}</span>
              </template>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="empty">暂无数据</div>
    </div>
    <div class="loading" v-else>查询中…</div>
  </div>
  
  <!-- Summarize Modal -->
  <div v-if="showSummary" class="modal-mask" @click.self="showSummary=false">
    <div class="modal">
      <div class="modal-title">智能总结</div>
      <div class="modal-body">
        <div class="row">
          <label>选择日期</label>
          <input type="date" v-model="summaryDate" />
        </div>
        <div class="row">
          <label>提示词（可选）</label>
          <textarea v-model="summaryPrompt" placeholder="例如：请用要点总结当天沟通内容，提取待办与结论"></textarea>
        </div>
        <div class="row">
          <label>更多聊天对象（可选，逗号分隔）</label>
          <div class="pickers">
            <input v-model="summaryTalkers" placeholder="可输入多个群/联系人 ID，以英文逗号分隔" />
            <button class="btn" type="button" @click="openPicker" style="margin-left:8px;">选择对象</button>
          </div>
          <div v-if="selectedTalkers.length" class="chips">
            <span class="chip" v-for="s in selectedTalkers" :key="s.id">{{ s.name || s.id }} ({{ s.id }}) <i @click="removePicked(s.id)">×</i></span>
          </div>
          <small class="hint">不填则默认仅当前聊天对象；多个对象将合并汇总（每条消息会标注所属群）。</small>
        </div>
        <div v-if="summaryError" class="error">{{ summaryError }}</div>
      </div>
      <div class="modal-actions">
        <button class="btn" @click="showSummary=false" :disabled="summaryLoading">取消</button>
        <button class="btn" @click="startSummary" :disabled="summaryLoading">{{ summaryLoading ? '总结中…' : '开始总结' }}</button>
      </div>
    </div>
  </div>

  <!-- Summary Result Modal (progressive, markdown supported) -->
  <div v-if="showSummaryResult" class="modal-mask" @click.self="showSummaryResult=false">
    <div class="modal">
      <div class="modal-title">总结结果</div>
      <div class="modal-body">
        <div v-if="summaryError" class="error">{{ summaryError }}</div>
        <div v-if="isStreaming && groupTotal>0" class="progress"><span class="spinner"></span> 群进度：{{ groupIndex }}/{{ groupTotal }}（当前：{{ currentGroupName || '—' }}）</div>
        <div v-if="isStreaming" class="progress"><span class="spinner"></span> 生成中… 已接收 {{ progressCount }} 片段</div>
        <div class="result markdown" v-html="marked(summaryResult)"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" @click="exportImage">生成图片</button>
        <button class="btn" @click="copySummary">复制</button>
        <button class="btn" @click="showSummaryResult=false">关闭</button>
      </div>
    </div>
  </div>

  <!-- Picker Modal -->
  <div v-if="showPicker" class="modal-mask" @click.self="showPicker=false">
    <div class="modal">
      <div class="modal-title">选择对象</div>
      <div class="modal-body">
        <div class="tabs">
          <button class="tab" :class="{active: pickerTab==='session'}" @click="pickerTab='session'; loadPicker()">最近会话</button>
          <button class="tab" :class="{active: pickerTab==='chatroom'}" @click="pickerTab='chatroom'; loadPicker()">群聊</button>
        </div>
        <div class="row pick-search">
          <input placeholder="搜索关键词（昵称/ID）" v-model="pickerKeyword" @keyup.enter="loadPicker" />
          <button class="btn" @click="loadPicker">搜索</button>
        </div>
        <div class="pick-list" v-if="pickerTab==='session'">
          <div class="pick-item" v-for="(s,i) in pickerSessions" :key="s.userName||i" @click="togglePick(s.userName, s.nickName || s.userName)">
            <input type="checkbox" :checked="!!selectedTalkers.find(x=>x.id===s.userName)" />
            <div class="meta">
              <div class="name">{{ s.nickName || s.userName }}</div>
              <div class="id">{{ s.userName }}</div>
            </div>
          </div>
          <div v-if="pickerLoading" class="loading">加载中…</div>
          <div v-if="!pickerLoading && !pickerSessions.length" class="empty">无结果</div>
        </div>
        <div class="pick-list" v-else>
          <div class="pick-item" v-for="(r,i) in pickerChatrooms" :key="r.name||i" @click="togglePick(r.name, r.nickName || r.name)">
            <input type="checkbox" :checked="!!selectedTalkers.find(x=>x.id===r.name)" />
            <div class="meta">
              <div class="name">{{ r.nickName || r.name }}</div>
              <div class="id">{{ r.name }}</div>
            </div>
          </div>
          <div v-if="pickerLoading" class="loading">加载中…</div>
          <div v-if="!pickerLoading && !pickerChatrooms.length" class="empty">无结果</div>
        </div>
        <div class="chips" v-if="selectedTalkers.length">
          <span class="chip" v-for="s in selectedTalkers" :key="s.id">{{ s.name || s.id }} ({{ s.id }}) <i @click="removePicked(s.id)">×</i></span>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" @click="selectedTalkers=[]; summaryTalkers='';">清空</button>
        <button class="btn" @click="showPicker=false">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-wrap { display: grid; grid-template-rows: auto 1fr; gap: 12px; height: 100%; }
.search { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 12px; background: rgba(255,255,255,.04); }
.title { font-weight: 600; margin-bottom: 8px; }
.controls { display: flex; align-items: center; gap: 8px; }
label { opacity: .8; font-size: 12px; }
input[type="date"], .kw { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: inherit; padding: 6px 8px; }
.kw { min-width: 240px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 6px 12px; cursor: pointer; transition: all 0.2s; }
.btn:hover:not(:disabled) { background: rgba(255,255,255,.12); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.chat-body { overflow: auto; padding: 6px 10px; }
.more { display: flex; justify-content: center; padding: 8px; }
.time { text-align: center; opacity: .6; font-size: 12px; margin: 6px 0; }
.msg { display: flex; flex-direction: column; align-items: flex-start; margin: 2px 0; }
.msg.right { align-items: flex-end; }
.sender { opacity: .75; font-size: 12px; margin: 0 6px 4px; }
.bubble { max-width: 70%; padding: 8px 12px; border-radius: 10px; white-space: normal; overflow-wrap: anywhere; text-align: left; }
.bubble.left { background: rgba(255,255,255,.08); }
.bubble.right { background: #0a84ff; }
.bubble .img { max-width: 280px; max-height: 280px; border-radius: 6px; display: block; }
.empty, .loading { opacity: .7; padding: 12px; }

/* modal */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 560px; max-width: calc(100% - 40px); background: #232323; color: #fff; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
.modal-title { font-weight: 600; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,.08); }
.modal-body { padding: 14px 16px; display: grid; gap: 12px; }
.modal-actions { padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid rgba(255,255,255,.08); }
.progress { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; opacity: .9; font-size: 12px; }
.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.2); border-top-color: #0a84ff; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.row { display: grid; gap: 6px; }
.row textarea { min-height: 120px; resize: vertical; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: inherit; padding: 8px; }
.error { color: #ff6b6b; font-size: 12px; }
.result { text-align: left; white-space: pre-wrap; max-height: 50vh; overflow: auto; background: rgba(255,255,255,.04); padding: 12px; border-radius: 8px; }
.markdown :where(h1,h2,h3,h4,h5,h6) { margin: 8px 0; }
.markdown pre, .markdown code { background: rgba(255,255,255,.06); padding: 2px 4px; border-radius: 4px; }
.markdown pre { padding: 8px; overflow: auto; }

/* picker */
.pickers { display: flex; align-items: center; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.chip { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); padding: 4px 8px; border-radius: 16px; font-size: 12px; }
.chip i { cursor: pointer; margin-left: 6px; opacity: .8; }
.tabs { display: flex; gap: 8px; margin-bottom: 8px; }
.tab { border-radius: 6px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 6px 10px; cursor: pointer; }
.tab.active { background: #0a84ff; }
.pick-list { max-height: 40vh; overflow: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; }
.pick-item { display: flex; gap: 8px; align-items: center; padding: 8px; border-bottom: 1px dashed rgba(255,255,255,.08); cursor: pointer; }
.pick-item:hover { background: rgba(255,255,255,.04); }
.pick-item .meta { display: grid; }
.pick-item .name { font-weight: 600; }
.pick-item .id { opacity: .7; font-size: 12px; }
</style>
