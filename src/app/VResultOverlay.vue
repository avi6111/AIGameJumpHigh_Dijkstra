<template>
  <div class="result-overlay">
    <!-- 中间的大字提示 -->
    <div class="center-message">
      <h1 class="main-text" :style="{ color: titleColor }">{{ title }}</h1>
    </div>

    <!-- 右侧的成绩面板 -->
    <div class="score-panel">
      <div class="panel-item">
        <span class="label">{{ stepLabel }}</span>
        <div class="progress-bar-bg">
          <div 
            class="progress-bar-fill" 
            :style="{ width: stepPercent + '%', backgroundColor: stepColor }"
          ></div>
        </div>
      </div>

      <div class="panel-item">
        <span class="label">{{ scoreLabel }}</span>
        <div class="progress-bar-bg">
          <div 
            class="progress-bar-fill" 
            :style="{ width: scorePercent + '%', backgroundColor: scoreColor }"
          ></div>
        </div>
      </div>

      <div class="panel-item time-item">
        <span class="label">{{ timeLabel }}</span>
        <span class="value">{{ timeValue }}</span>
      </div>

      <!-- 星级评价 -->
      <div class="stars-container">
        <span v-for="n in 3" :key="n" class="star" :class="{ active: n <= starCount }">
          ★
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
// 定义传入的参数（Props）
const props = defineProps({
  // 中间大字内容
  title: { type: String, default: '通关成功' },
  // 大字颜色
  titleColor: { type: String, default: '#ffffff' },
  
  // 第一步数据
  stepLabel: { type: String, default: '步数' },
  stepPercent: { type: Number, default: 80 }, // 进度条百分比 0-100
  stepColor: { type: String, default: '#3b82f6' }, // 蓝色
  
  // 第二步数据
  scoreLabel: { type: String, default: '分数' },
  scorePercent: { type: Number, default: 60 },
  scoreColor: { type: String, default: '#f59e0b' }, // 黄色
  
  // 时间数据
  timeLabel: { type: String, default: '剩余时间' },
  timeValue: { type: String, default: '00:45' },
  
  // 星星数量 (1-3)
  starCount: { type: Number, default: 3 }
});
</script>

<style scoped>
/* 整体容器：悬浮在 Three.js Canvas 之上 */
.result-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 让鼠标事件穿透到下方的 3D 场景 */
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center;     /* 垂直居中 */
  font-family: 'Arial', sans-serif;
}

/* --- 中间大字样式 --- */
.center-message {
  position: absolute;
  z-index: 10;
}

.main-text {
  font-size: 5rem;
  font-weight: 900;
  margin: 0;
  letter-spacing: 5px;
  /* 添加文字阴影增加立体感 */
  text-shadow: 2px 2px 10px rgba(0, 0, 0, 0.5);
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* --- 右侧成绩面板样式 --- */
.score-panel {
  position: absolute;
  right: 50px;
  top: 50%;
  transform: translateY(-50%);
  width: 280px;
  background-color: rgba(45, 48, 56, 0.85); /* 深灰色半透明背景 */
  backdrop-filter: blur(10px); /* 毛玻璃效果 */
  border-radius: 16px;
  padding: 25px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  pointer-events: auto; /* 恢复面板的鼠标交互（如果需要点击） */
}

.panel-item {
  margin-bottom: 20px;
}

.label {
  display: block;
  color: #a0a5b0;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

/* 进度条槽 */
.progress-bar-bg {
  width: 100%;
  height: 12px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

/* 进度条填充 */
.progress-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 1s ease-out; /* 进度条动画 */
}

/* 时间行特殊处理 */
.time-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}
.time-item .value {
  color: #fff;
  font-weight: bold;
  font-size: 1.1rem;
}

/* 星星样式 */
.stars-container {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.star {
  font-size: 2.5rem;
  color: #444; /* 未点亮颜色 */
  transition: color 0.3s;
}

.star.active {
  color: #fbbf24; /* 金色 */
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.6);
}

/* 简单的弹出动画 */
@keyframes popIn {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>