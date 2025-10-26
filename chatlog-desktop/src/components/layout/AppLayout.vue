<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import TopToolbar from './TopToolbar.vue'
import StatusBar from './StatusBar.vue'
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <Sidebar />
    </aside>
    <main class="main">
      <TopToolbar />
      <section class="content">
        <router-view />
      </section>
      <StatusBar />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: 100vh;
  background: var(--bg, #0f1115);
  color: var(--fg, #f2f2f2);
}
.sidebar {
  border-right: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(20px);
  background: rgba(255,255,255,0.04);
}
.main {
  display: grid;
  grid-template-rows: auto 1fr auto;
}
.content {
  padding: 12px 16px;
  overflow: auto;
}
</style>

