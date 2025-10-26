<script setup lang="ts">
function onWeChatLogin() { alert('微信小程序扫码登录（预留接口占位）') }
</script>

<template>
  <div class="card">
    <h3>外部接入</h3>
    <div class="row">
      <button class="btn" @click="onWeChatLogin">WeChat 小程序扫码登录</button>
    </div>
  </div>
</template>

<style scoped>
.card { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.04); }
.row { margin-top: 12px; }
.btn { border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #fff; padding: 8px 12px; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,.12); }
</style>

