<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Backend, type ChatRoom } from '../services/backend'
const list = ref<ChatRoom[]>([])
const q = ref('')
const pageSize = 100
const offset = ref(0)
const hasMore = ref(true)
const loadingMore = ref(false)
const listEl = ref<HTMLElement | null>(null)
const SCROLL_THRESHOLD = 120
let debounceTimer: any = null

async function load(reset = true) {
  try {
    if (reset) {
      offset.value = 0
      const resp = await Backend.getChatRooms({ keyword: q.value, limit: pageSize, offset: offset.value })
      list.value = resp.items || []
      hasMore.value = (resp.items?.length || 0) === pageSize
      await nextTick()
      // 保持当前位置（首次加载无特殊处理）
    } else {
      await loadMore()
    }
  } catch {}
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const el = listEl.value
    const prevBottom = el ? (el.scrollHeight - el.scrollTop) : 0
    offset.value += pageSize
    const resp = await Backend.getChatRooms({ keyword: q.value, limit: pageSize, offset: offset.value })
    const items = resp.items || []
    list.value = list.value.concat(items)
    hasMore.value = items.length === pageSize
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - prevBottom
  } finally {
    loadingMore.value = false
  }
}

function onScrollList(e: Event) {
  const el = e.target as HTMLElement
  if (!el) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD
  if (nearBottom) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => loadMore(), 150)
  }
}

onMounted(() => load(true))
const router = useRouter()
function openChat(g: ChatRoom) {
  router.push({ path: '/chat', query: { talker: g.name, nick: encodeURIComponent(g.nickName || g.name) } })
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <input class="search" v-model="q" placeholder="搜索群聊…" @keyup.enter="() => load(true)" />
    </div>
    <div ref="listEl" class="list" @scroll.passive="onScrollList">
      <div v-for="g in list" :key="g.name" class="row clickable" @click="openChat(g)">
        <div class="nick">{{ g.nickName || g.name }}</div>
        <div class="sub">群主: {{ g.owner }} · 成员: {{ g.users?.length ?? 0 }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.04); height: 100%; display: grid; grid-template-rows: auto 1fr; }
.toolbar { margin-bottom: 10px; }
.search { width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: inherit; padding: 6px 8px; }
.list { overflow: auto; }
.row { padding: 8px; border-radius: 8px; }
.row.clickable { cursor: pointer; }
.row.clickable:hover { background: rgba(255,255,255,.06); }
.row:hover { background: rgba(255,255,255,.06); }
.nick { font-weight: 500; }
.sub { opacity: .6; font-size: 12px; }
</style>
