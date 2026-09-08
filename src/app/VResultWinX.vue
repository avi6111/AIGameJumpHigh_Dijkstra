<!-- src/components/StarSettlement.vue -->
<template>
  <div class="floating-overlay" @click.self="handleClose">
    <div class="floating-window">
      <!-- 关闭按钮 -->
      <button class="btn-close" @click="handleClose">✕</button>

      <!-- 关卡号 - 新增 -->
      <div class="level-badge level-animate">
        <span class="level-label">第</span>
        <span class="level-number">{{ level }}</span>
        <span class="level-label">关</span>
      </div>

      <!-- 标题 -->
      <h2 class="title-animate">{{ getLevelMessage() }}</h2>
      <p class="subtitle subtitle-animate">🎯 关卡结算</p>

      <!-- ⭐ 星星 -->
      <div class="stars-container">
        <span
          v-for="i in 3"
          :key="i"
          class="star"
          :class="{
            filled: i <= filledStars,
            half: i === Math.ceil(filledStars) && filledStars % 1 !== 0,
            empty: i > Math.ceil(filledStars),
            'star-animate': true,
            'star-delay-1': i === 1,
            'star-delay-2': i === 2,
            'star-delay-3': i === 3
          }"
          :style="{ animationDelay: (i - 1) * 0.3 + 's' }"
        >
          {{ getStarIcon(i) }}
        </span>
        <span class="star-score score-animate">{{ filledStars.toFixed(1) }} / 3</span>
      </div>

      <!-- 数据统计 -->
      <div class="stats">
        <div class="stat-item stat-animate" style="animation-delay: 0.6s">
          <span class="label">步数</span>
          <span class="value">{{ steps }}</span>
        </div>
        <div class="stat-item stat-animate" style="animation-delay: 0.8s">
          <span class="label">得分</span>
          <span class="value">{{ score }}</span>
        </div>
        <div class="stat-item stat-animate" style="animation-delay: 1.0s">
          <span class="label">用时</span>
          <span class="value">{{ time }}</span>
        </div>
      </div>

      <!-- 按钮 -->
      <div class="actions">
        <button class="btn-primary btn-animate" style="animation-delay: 1.2s" @click="handleNextLevel">
          🚀 下一关
        </button>
        <button class="btn-secondary btn-animate" style="animation-delay: 1.4s" @click="handleRetry">
          🔄 重新玩
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { HudCdState } from './HudCd';

function getStar(ratio:number): number {
  // 限制输入 0‑1
  const r = Math.max(0, Math.min(1, ratio));
  // 6个等级，0.5起步，步长0.5
  // 算出索引 0~5
  const index = Math.min(Math.floor(r * 6), 5);
  const star = 0.5 + index * 0.5;
  return star;
}
// ============ Props ============
const props = defineProps<{
  countdownState?: HudCdState;
  level?: number;        // 🆕 当前关卡号
  stars?: number;
  steps?: number;
  score?: number;
  time?: string;
}>();

// ============ 默认值 ============
let calStar = 0.5;
if(props.countdownState?.totalSeconds)
{
  const total = props.countdownState.totalSeconds
  const elapsed = props.countdownState.elapsedSeconds
  const ratio = total === 0 ? 0 : elapsed / total;
  calStar = getStar(1-ratio);
}
 
const level = props.level ?? 1;
const filledStars = props.stars ?? calStar;
const steps = props.steps ?? 128;
const score = props.score ?? 256;
const time = props.time ?? formatCountdown(props.countdownState);

function formatCountdown(state?: HudCdState): string {
  if (!state) return '0:00';
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = Math.floor(state.elapsedSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============ 动画状态 ============
const isMounted = ref(false);

// ============ 事件 ============
const emit = defineEmits<{
  (e: 'nextLevel'): void;
  (e: 'retry'): void;
  (e: 'close'): void;
}>();

// ============ 方法 ============
function getLevelMessage(): string {
  if (filledStars >= 3) return '🌟 完美通关！';
  if (filledStars >= 2.5) return '⭐ 太棒了！';
  if (filledStars >= 2) return '💪 表现不错！';
  if (filledStars >= 1.5) return '👏 继续加油！';
  if (filledStars >= 1) return '📖 再接再厉！';
  return '😅 再试一次吧！';
}

function getStarIcon(index: number): string {
  const starIndex = index;
  if (starIndex <= Math.floor(filledStars)) {
    return '★';
  }
  if (starIndex === Math.ceil(filledStars) && filledStars % 1 !== 0) {
    return '★';
  }
  return '☆';
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

// ============ 生命周期 ============
onMounted(() => {
  isMounted.value = true;
});
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
  animation: overlayFadeIn 0.3s ease;
}

@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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
  animation: windowPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes windowPopIn {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(30px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
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
  transition: color 0.2s, transform 0.2s;
  font-family: inherit;
  padding: 4px 8px;
}

.btn-close:hover {
  color: rgba(255, 255, 255, 0.6);
  transform: rotate(90deg);
}

/* ==========================================
   🏷️ 关卡号徽章 - 新增
   ========================================== */
.level-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(208, 223, 146, 0.12);
  border: 1px solid rgba(208, 223, 146, 0.2);
  border-radius: 20px;
  padding: 4px 16px;
  margin: 0 auto 12px;
  width: fit-content;
  font-size: 14px;
  color: #b8c9a7;
  letter-spacing: 1px;
}

.level-badge .level-number {
  font-size: 22px;
  font-weight: 700;
  color: #d0df92;
  padding: 0 2px;
}

.level-animate {
  animation: levelBadgeIn 0.5s ease forwards;
  opacity: 0;
  transform: scale(0.8);
}

@keyframes levelBadgeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ==========================================
   🎬 标题入场动画
   ========================================== */
.title-animate {
  margin: 0 0 4px 0;
  font-size: 28px;
  font-weight: 700;
  color: #d0df92;
  text-align: center;
  animation: titleSlideUp 0.5s ease 0.1s forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes titleSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.subtitle-animate {
  text-align: center;
  margin: 0 0 20px 0;
  color: #b8c9a7;
  font-size: 15px;
  line-height: 1.6;
  animation: subtitleFadeIn 0.5s ease 0.25s forwards;
  opacity: 0;
}

@keyframes subtitleFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==========================================
   ⭐ 星星逐个点亮动画
   ========================================== */
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
  opacity: 0;
  transform: scale(0) rotate(-30deg);
}

.star-animate {
  animation: starPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.star-delay-1 {
  animation-delay: 0.2s;
}
.star-delay-2 {
  animation-delay: 0.5s;
}
.star-delay-3 {
  animation-delay: 0.8s;
}

@keyframes starPopIn {
  0% {
    opacity: 0;
    transform: scale(0) rotate(-30deg);
  }
  60% {
    transform: scale(1.3) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.star.filled {
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
  animation: starPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
    starPulse 2s ease-in-out 0.8s infinite;
}

@keyframes starPulse {
  0%,
  100% {
    transform: scale(1);
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
  }
  50% {
    transform: scale(1.08);
    text-shadow: 0 0 40px rgba(255, 215, 0, 0.7), 0 0 80px rgba(255, 215, 0, 0.3);
  }
}

.star.empty {
  color: rgba(255, 255, 255, 0.15);
  animation-name: starPopIn;
  animation-duration: 0.4s;
  animation-fill-mode: forwards;
}

.star-score {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.3);
  margin-left: 12px;
  font-weight: 300;
}

.score-animate {
  animation: scoreFadeIn 0.6s ease 1.2s forwards;
  opacity: 0;
}

@keyframes scoreFadeIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ==========================================
   📊 数据统计
   ========================================== */
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

.stat-animate {
  animation: statSlideUp 0.5s ease forwards;
  opacity: 0;
  transform: translateY(15px);
}

@keyframes statSlideUp {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

/* ==========================================
   🔘 按钮
   ========================================== */
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

.btn-animate {
  animation: btnFadeIn 0.5s ease forwards;
  opacity: 0;
  transform: translateY(15px) scale(0.95);
}

@keyframes btnFadeIn {
  from {
    opacity: 0;
    transform: translateY(15px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.floating-window .btn-primary {
  background: linear-gradient(135deg, #d0df92, #b8d06a);
  color: #17201c;
  box-shadow: 0 4px 16px rgba(208, 223, 146, 0.25);
  position: relative;
  overflow: hidden;
}

.floating-window .btn-primary::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transform: translateX(-100%) rotate(45deg);
  transition: transform 0.6s;
}

.floating-window .btn-primary:hover::after {
  transform: translateX(100%) rotate(45deg);
}

.floating-window .btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 28px rgba(208, 223, 146, 0.4);
}

.floating-window .btn-primary:active {
  transform: translateY(0) scale(0.98);
}

.floating-window .btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #b8c9a7;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.floating-window .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px) scale(1.02);
}

.floating-window .btn-secondary:active {
  transform: translateY(0) scale(0.98);
}

/* ==========================================
   🎉 额外效果：星星掉落庆祝
   ========================================== */
.floating-window::before {
  content: '✨✨✨';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
  letter-spacing: 20px;
  opacity: 0;
  animation: sparkleRain 1s ease 0.3s forwards;
  pointer-events: none;
}

@keyframes sparkleRain {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.5);
  }
  to {
    opacity: 0.6;
    transform: translateX(-50%) translateY(10px) scale(1);
  }
}

/* ==========================================
   📱 响应式
   ========================================== */
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

  .level-badge {
    font-size: 12px;
    padding: 3px 12px;
  }

  .level-badge .level-number {
    font-size: 18px;
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