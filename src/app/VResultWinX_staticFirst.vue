<!-- src/components/StarSettlement.vue -->
<template>
  <div class="floating-overlay" @click.self="handleClose">
    <div class="floating-window">
      <!-- 标题 -->
      <h2>🎉 关卡完成！</h2>
      <p class="subtitle">{{ getLevelMessage() }}</p>

      <!-- ⭐ 星星 -->
      <div class="stars-container">
        <span
          v-for="i in 3"
          :key="i"
          class="star"
          :class="{
            filled: i <= filledStars,
            half: i === Math.ceil(filledStars) && filledStars % 1 !== 0,
            empty: i > Math.ceil(filledStars)
          }"
        >
          {{ getStarIcon(i) }}
        </span>
        <span class="star-score">{{ filledStars.toFixed(1) }} / 3</span>
      </div>

      <!-- 数据统计 -->
      <div class="stats">
        <div class="stat-item">
          <span class="label">步数</span>
          <span class="value">{{ steps }}</span>
        </div>
        <div class="stat-item">
          <span class="label">得分</span>
          <span class="value">{{ score }}</span>
        </div>
        <div class="stat-item">
          <span class="label">用时</span>
          <span class="value">{{ time }}</span>
        </div>
      </div>

      <!-- 按钮 -->
      <div class="actions">
        <button class="btn-primary" @click="handleNextLevel">
          🚀 下一关
        </button>
        <button class="btn-secondary" @click="handleRetry">
          🔄 重新玩
        </button>
      </div>

      <!-- 关闭按钮（可选） -->
      <button class="btn-close" @click="handleClose">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// ============ Props ============
const props = defineProps<{
  // 星星数量：可以是 0, 0.5, 1, 1.5, 2, 2.5, 3
  stars?: number;
  // 步数
  steps?: number;
  // 得分
  score?: number;
  // 用时
  time?: string;
}>();

// ============ 默认值 ============
const filledStars = props.stars ?? 2.5;
const steps = props.steps ?? 128;
const score = props.score ?? 256;
const time = props.time ?? '1:19';

// ============ 事件 ============
const emit = defineEmits<{
  (e: 'nextLevel'): void;
  (e: 'retry'): void;
  (e: 'close'): void;
}>();

// ============ 方法 ============
function getLevelMessage(): string {
  if (filledStars >= 3) return '🌟 完美通关！太棒了！';
  if (filledStars >= 2) return '⭐ 表现出色！继续加油！';
  if (filledStars >= 1) return '💪 还不错，再接再厉！';
  return '😅 再试一次吧！';
}

function getStarIcon(index: number): string {
  const starIndex = index;
  if (starIndex <= Math.floor(filledStars)) {
    return '★'; // 完整星
  }
  if (starIndex === Math.ceil(filledStars) && filledStars % 1 !== 0) {
    return '☆'; // 半星用空心星显示
  }
  return '☆'; // 空星
}

function handleNextLevel() {
  emit('nextLevel');
}

function handleRetry() {
  emit('retry');
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
/* ========== 遮罩层 ========== */
.floating-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

/* ========== 浮动窗口 ========== */
.floating-window {
  position: relative;
  width: 90%;
  max-width: 480px;
  background: rgba(20, 30, 28, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(184, 201, 167, 0.3);
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
  color: #f1f6ec;
  font-family: "Avenir Next", "Trebuchet MS", sans-serif;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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
  transition: color 0.2s;
  font-family: inherit;
  padding: 4px 8px;
}

.btn-close:hover {
  color: rgba(255, 255, 255, 0.6);
}

/* ========== 标题 ========== */
.floating-window h2 {
  margin: 0 0 4px 0;
  font-size: 28px;
  font-weight: 700;
  color: #d0df92;
  text-align: center;
}

.floating-window .subtitle {
  text-align: center;
  margin: 0 0 20px 0;
  color: #b8c9a7;
  font-size: 15px;
  line-height: 1.6;
}

/* ========== ⭐ 星星 ========== */
.stars-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 20px;
  padding: 12px 0;
}

.star {
  font-size: 48px;
  line-height: 1;
  transition: all 0.3s ease;
}

.star.filled {
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

.star.half {
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
  opacity: 0.7;
}

.star.empty {
  color: rgba(255, 255, 255, 0.15);
}

.star-score {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.3);
  margin-left: 12px;
  font-weight: 300;
}

/* ========== 统计数据 ========== */
.floating-window .stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.floating-window .stat-item {
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  padding: 10px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.floating-window .stat-item .label {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 2px;
}

.floating-window .stat-item .value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #f1f6ec;
}

/* ========== 按钮 ========== */
.floating-window .actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.floating-window .actions button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
  flex: 1;
}

/* 🟢 下一关按钮 - 高亮 */
.floating-window .btn-primary {
  background: linear-gradient(135deg, #d0df92, #b8d06a);
  color: #17201c;
  box-shadow: 0 4px 16px rgba(208, 223, 146, 0.25);
}

.floating-window .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(208, 223, 146, 0.35);
}

.floating-window .btn-primary:active {
  transform: translateY(0);
}

/* 🔄 重新玩按钮 - 次要 */
.floating-window .btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #b8c9a7;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.floating-window .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
}

/* ========== 响应式 ========== */
@media (max-width: 480px) {
  .floating-window {
    padding: 24px 16px;
  }

  .floating-window h2 {
    font-size: 22px;
  }

  .star {
    font-size: 36px;
  }

  .floating-window .stats {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .floating-window .stat-item .value {
    font-size: 16px;
  }

  .floating-window .actions {
    flex-direction: column;
  }

  .floating-window .actions button {
    padding: 12px;
    font-size: 14px;
  }
}
</style>