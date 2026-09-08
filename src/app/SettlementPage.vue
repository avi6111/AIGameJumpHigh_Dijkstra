<template>
  <div class="settlement-overlay" v-if="visible">
    <!-- 内容 -->
     1111111111111
     222222
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const visible = ref(true);
let isProcessing = false;

const emit = defineEmits(['restart', 'close']);

function handleRestart() {
  // ✅ 防止重复点击
  if (isProcessing) return;
  isProcessing = true;
  
  emit('restart');
}

function handleClose() {
  if (isProcessing) return;
  isProcessing = true;
  
  emit('close');
}

// 组件卸载时清理
onMounted(() => {
  console.log('结算页面已挂载');
});
</script>