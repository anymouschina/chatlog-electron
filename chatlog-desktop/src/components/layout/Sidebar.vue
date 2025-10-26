<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

type Item = { path: string; label: string; icon: string }
const items: Item[] = [
  { path: '/contacts', label: '联系人', icon: 'person.2' },
  { path: '/groups', label: '群聊', icon: 'person.3' },
  { path: '/logs', label: '日志', icon: 'doc' },
]

function goto(path: string) { router.push(path) }
</script>

<template>
  <div class="sidebar">
    <div class="title">最后的总结大师</div>
    <nav>
      <button v-for="it in items" :key="it.path"
              class="nav"
              :class="{ active: route.path === it.path }"
              @click="goto(it.path)">
        <span class="icon"></span>
        <span class="label">{{ it.label }}</span>
      </button>
    </nav>
    <div class="spacer"></div>
    <div class="help">
      <img src="/help.jpg" alt="扫码反馈使用体验问题" />
      <div class="caption">扫码反馈使用体验问题</div>
    </div>
  </div>
  
</template>

<style scoped>
.sidebar { padding: 14px 10px; height: 100%; min-height: 860px; display: flex; flex-direction: column; }
.title { font-weight: 600; font-size: 14px; opacity: .9; padding: 6px 10px 12px; }
.nav {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 8px;
  color: inherit; background: transparent; border: 0; cursor: pointer;
}
.nav:hover { background: rgba(255,255,255,0.06); }
.nav.active { background: rgba(255,255,255,0.12); }
.icon { width: 18px; text-align: center; opacity: .75; }
.label { font-size: 13px; }
.spacer { flex: 1; }
.help { padding: 8px 6px 16px; }
.help img { width: 100%; border-radius: 8px; display: block; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
.help .caption { text-align: center; font-size: 12px; opacity: .8; margin-top: 6px; }
</style>
