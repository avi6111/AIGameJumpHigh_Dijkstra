<template>
  <!-- 给最外层加一个固定的定位，确保它能悬浮在页面（包括 Three.js 画布）之上 -->
  <div class="vue-overlay">
    <h2>我是 Vue 内容</h2>
    <button @click="count++">点击次数: {{ count }}</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);
</script>

<style scoped>
/* 核心：使用 fixed 定位让它悬浮在屏幕最上层 */
.vue-overlay {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 9999; /* 确保在 Three.js 的 canvas 之上 */
  background-color: rgba(255, 255, 255, 0.9); /* 加个背景色方便观察 */
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

button {
  margin-top: 10px;
  padding: 5px 10px;
  cursor: pointer;
}
</style>