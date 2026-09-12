<template>
  <div class="level-config-error" @click.self="handleClose">
    <div class="error-window">
      <!-- 关闭按钮 -->
      <button class="btn-close" @click="handleClose">✕</button>
      <!-- 1. 状态提示：配置没配关卡 -->
      <div class="error-header">
        <h2 class="error-title">️ 关卡配置缺失</h2>
        <p class="error-desc">
          当前进度：<strong>第【{{ currLevel }}】关</strong>。系统检测到当前关卡配置未正确设置，无法继续游戏。
        </p>
      </div>

      <!-- 2. 图文提示：如何操作返回第一关 -->
      <div class="guide-section">
        <h3 class="guide-title"> 如何返回第一关？</h3>
        <div class="guide-content">
          <!-- 图片提示区域 -->
          <div class="guide-image-wrapper">
            <img 
              :src="guideImage" 
              alt="返回第一关操作指引" 
              class="guide-image"
            />
          </div>
          
          <!-- 文字步骤提示 -->
          <ul class="guide-steps">
            <li>点击屏幕右上角的 <strong>「菜单」</strong> 按钮。</li>
            <li>在弹出的面板中选择 <strong>「Level」</strong>。</li>
            <li>修改 <strong>「数字」</strong> 后，F5刷新即可重新开始。</li>
          </ul>
        </div>
      </div>

      <!-- 3. 快捷操作按钮 -->
      <div class="action-area">
        <button class="back-btn" @click="handleBackToFirstLevel">
           一键返回第一关
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getActiveLevel } from '../Level';
// 假设的引导图片路径（请替换为实际图片）
const guideImage = ref(`${import.meta.env.BASE_URL}images/guide-back-to-level-1.png`);
const currLevel = ref(getActiveLevel()?.currentLevel);

// ============ 事件 ============
const emit = defineEmits<{
  (e: 'close'): void;
}>();

// ============ 方法 ============
function handleClose() {
  emit('close');
}

// 返回第一关的处理逻辑（currentLevel 内部从 0 开始，0 即第 1 关）
const handleBackToFirstLevel = () => {
  const level = getActiveLevel();
  if (!level) return;
  level.currentLevel = 0;   // setter 内部会写入 localStorage
  location.reload();        // 重新走 preloadLevelLayout，按第一关初始化
};
</script>

<style scoped>
/* ========== 黑色虚化遮罩层（同 VResultWinX 的 floating-overlay） ========== */
.level-config-error {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  pointer-events: auto;
}

/* ========== 居中浮动窗口（不占满全屏） ========== */
.error-window {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: rgba(20, 30, 28, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(184, 201, 167, 0.3);
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
  color: #f1f6ec;
  font-family: "Avenir Next", "Trebuchet MS", sans-serif;
  box-sizing: border-box;
}

/* ========== 关闭按钮 ========== */
.btn-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.2);
  font-size: 20px;
  cursor: pointer;
  transition: color 0.2s, transform 0.2s;
  font-family: inherit;
  padding: 4px 8px;
}

.btn-close:hover {
  color: rgba(255, 255, 255, 0.6);
  transform: rotate(90deg);
}

.error-header {
  margin-bottom: 24px;
}

.error-title {
  font-size: 24px;
  color: #e67e22;
  margin: 0 0 10px;
}

.error-desc {
  font-size: 15px;
  line-height: 1.6;
  color: #b8c9a7;
  margin: 0;
}

.guide-section {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto 24px;
  box-sizing: border-box;
}

.guide-title {
  font-size: 18px;
  margin: 0 0 15px;
  color: #d0df92;
  text-align: left;
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.guide-image-wrapper {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.guide-image {
  width: 100%;
  height: auto;
  display: block;
}

.guide-steps {
  margin: 0;
  text-align: left;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.8;
  color: #c9d7bc;
}

.guide-steps strong {
  color: #f1f6ec;
}

.action-area {
  margin-top: 10px;
}

.back-btn {
  background: linear-gradient(135deg, #d0df92, #b8d06a);
  color: #17201c;
  border: none;
  padding: 12px 30px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.3s ease;
}

.back-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 28px rgba(208, 223, 146, 0.4);
}

.back-btn:active {
  transform: translateY(0) scale(0.98);
}
</style>
