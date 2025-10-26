<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { Backend, type Session, type Message } from '../services/backend'

const q = ref('')
const sessions = ref<Session[]>([])
// sessions list pagination
const sessPageSize = 100
const sessOffset = ref(0)
const sessHasMore = ref(true)
const sessLoading = ref(false)
const listEl = ref<HTMLElement | null>(null)
const LIST_SCROLL_THRESHOLD = 120
let listDebounce: any = null
const active = ref<Session | null>(null)
const messages = ref<Message[]>([])
const pageSize = 200
const offset = ref(0)
const hasMore = ref(true)
const loadingMore = ref(false)
const bodyEl = ref<HTMLElement | null>(null)
const SCROLL_THRESHOLD = 120
let scrollDebounce: any = null
// 防止切换会话后立即触发底部自动加载
const allowAutoLoad = ref(false)

async function loadSessions(reset = true) {
  try {
    if (reset) {
      sessOffset.value = 0
      const resp = await Backend.getSessions({ keyword: q.value || '', limit: sessPageSize, offset: sessOffset.value })
      sessions.value = resp.items || []
      sessHasMore.value = (resp.items?.length || 0) === sessPageSize
      if (!active.value && sessions.value.length) selectSession(sessions.value[0])
    } else {
      await loadMoreSessions()
    }
  } catch (_) { /* noop */ }
}

async function loadMoreSessions() {
  if (sessLoading.value || !sessHasMore.value) return
  sessLoading.value = true
  try {
    const el = listEl.value
    const prevBottom = el ? (el.scrollHeight - el.scrollTop) : 0
    sessOffset.value += sessPageSize
    const resp = await Backend.getSessions({ keyword: q.value || '', limit: sessPageSize, offset: sessOffset.value })
    const items = resp.items || []
    sessions.value = sessions.value.concat(items)
    sessHasMore.value = items.length === sessPageSize
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - prevBottom
  } finally { sessLoading.value = false }
}

function onScrollSessions(e: Event) {
  const el = e.target as HTMLElement
  if (!el) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - LIST_SCROLL_THRESHOLD
  if (nearBottom) {
    if (listDebounce) clearTimeout(listDebounce)
    listDebounce = setTimeout(() => loadMoreSessions(), 150)
  }
}

async function selectSession(s: Session) {
  active.value = s
  try {
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
    const now = new Date()
    const time = `${yearAgo.toISOString().slice(0,10)}~${now.toISOString().slice(0,10)}`
    offset.value = 0
    const list = await Backend.getChatlog({ time, talker: s.userName, limit: pageSize, offset: offset.value })
    messages.value = list
    hasMore.value = list.length === pageSize
    // 不再自动滚动到底部，避免立即触发多次加载；等用户主动滚动后再允许自动加载
    allowAutoLoad.value = false
  } catch (_) { messages.value = [] }
}

onMounted(loadSessions)
async function loadMore() {
  if (loadingMore.value || !hasMore.value || !active.value) return
  loadingMore.value = true
  try {
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1)
    const now = new Date()
    const time = `${yearAgo.toISOString().slice(0,10)}~${now.toISOString().slice(0,10)}`
    const el = bodyEl.value
    const prevBottom = el ? (el.scrollHeight - el.scrollTop) : 0
    offset.value += pageSize
    const list = await Backend.getChatlog({ time, talker: active.value.userName, limit: pageSize, offset: offset.value })
    messages.value = messages.value.concat(list)
    hasMore.value = list.length === pageSize
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - prevBottom
  } catch (e) { console.error('load more error', e); hasMore.value = false }
  finally { loadingMore.value = false }
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (!el) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD
  if (nearBottom) {
    // 首次滚动事件用来解除保护，不触发加载
    if (!allowAutoLoad.value) { allowAutoLoad.value = true; return }
    if (scrollDebounce) clearTimeout(scrollDebounce)
    scrollDebounce = setTimeout(() => {
      loadMore()
    }, 150)
  }
}

// 取消自动填充，避免切换会话后无限加载
</script>

<template>
  <div class="three">
    <aside ref="listEl" class="col list" @scroll.passive="onScrollSessions">
      <input class="search" v-model="q" placeholder="搜索会话…" @keyup.enter="() => loadSessions(true)" />
      <div class="item" v-for="s in sessions" :key="s.userName" :class="{active: active?.userName===s.userName}" @click="selectSession(s)">
        <div class="nick">{{ s.nickName || s.userName }}</div>
        <div class="preview">{{ s.content }}</div>
      </div>
    </aside>
    <section ref="bodyEl" class="col messages" @scroll.passive="onScroll">
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
      <div v-else class="empty">无消息或加载中…</div>
    </section>
    <aside class="col detail">
      <div class="panel">详情面板</div>
    </aside>
  </div>
</template>

<style scoped>
.three { display: grid; grid-template-columns: 320px 1fr 320px; gap: 12px; height: 100%; }
.col { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 12px; background: rgba(255,255,255,.03); }
.list { overflow: auto; }
.search { width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: inherit; padding: 6px 8px; margin-bottom: 10px; }
.item { padding: 8px; border-radius: 8px; cursor: pointer; }
.item:hover { background: rgba(255,255,255,.06); }
.item.active { background: rgba(10,132,255,.2); }
.messages { overflow: auto; padding: 20px; }
.msg { display: flex; flex-direction: column; align-items: flex-start; margin: 6px 0; }
.msg.right { align-items: flex-end; }
.sender { opacity: .75; font-size: 12px; margin: 0 6px 4px; }
.bubble { display: inline-block; max-width: 60%; padding: 8px 12px; border-radius: 10px; margin: 0; white-space: normal; overflow-wrap: anywhere; text-align: left; }
.bubble.left { background: rgba(255,255,255,.08); }
.bubble.right { background: #0a84ff; }
.bubble .img { max-width: 240px; max-height: 240px; border-radius: 6px; display: block; }
.time { text-align: center; opacity: .6; font-size: 12px; margin: 8px 0; }
.detail .panel { opacity: .8; }
</style>
