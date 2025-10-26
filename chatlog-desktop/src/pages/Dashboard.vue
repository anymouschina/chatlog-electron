<script setup lang="ts">
</script>

<template>
  <div class="cards">
    <div class="card">账号与进程</div>
    <div class="card">版本/平台</div>
    <div class="card">数据密钥状态</div>
    <div class="card">数据/工作目录使用量</div>
    <div class="card">HTTP/MCP 状态</div>
    <div class="card">自动解密</div>
  </div>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.card { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; min-height: 120px; background: rgba(255,255,255,.04); }
</style>

