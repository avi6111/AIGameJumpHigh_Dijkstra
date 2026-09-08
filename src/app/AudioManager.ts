import * as THREE from 'three';
import { GUI } from 'lil-gui';//npm install lil-gui --legacy-peer-deps
//I:\2026Unity\换龙骑战歌F盘\【完整-Unity3d】龙骑战歌\ProjectDevelopment\资源管理\Resources\sound\music
// 1. 基础场景初始化（省略部分常规代码）
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. 初始化 Three.js 音频系统
const listener = new THREE.AudioListener();
camera.add(listener); // 监听器必须绑定到相机上

const audioLoader = new THREE.AudioLoader();
const sound = new THREE.Audio(listener);
scene.add(sound); // 将音频对象添加到场景中

// 音频状态控制对象（供 GUI 调用）
const audioControls = {
  isPlaying: false,
  volume: 0.5,
  play: () => {
    if (sound.buffer && !sound.isPlaying) {
      sound.play();
      audioControls.isPlaying = true;
    }
  },
  pause: () => {
    if (sound.isPlaying) {
      sound.pause();
      audioControls.isPlaying = false;
    }
  },
  // 导入本地 BGM 的核心逻辑
  loadLocalBGM: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // 暂停当前正在播放的音乐
      if (sound.isPlaying) sound.stop();

      // 使用 FileReader 读取本地文件为 Blob URL
      const url = URL.createObjectURL(file);
      
      // 使用 AudioLoader 加载
      audioLoader.load(url, (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true); // 设置为循环播放
        sound.setVolume(audioControls.volume);
        sound.play();
        audioControls.isPlaying = true;
        
        // 释放 Blob URL 内存
        URL.revokeObjectURL(url);
      });
    };
    input.click();
  }
};

// 3. 创建 Inspector 面板 (lil-gui)
const gui = new GUI({ title: '🎵 音乐模块 Inspector' });
const audioFolder = gui.addFolder('BGM Controls');

audioFolder.add(audioControls, 'play').name('▶ 播放');
audioFolder.add(audioControls, 'pause').name('⏸ 暂停');
audioFolder.add(audioControls, 'volume', 0, 1, 0.01).name('音量').onChange((val:any) => {
  sound.setVolume(val);
});
audioFolder.add(audioControls, 'loadLocalBGM').name('📂 导入本地 BGM');

// // 4. 渲染循环
// function animate() {
//   requestAnimationFrame(animate);
//   renderer.render(scene, camera);
// }
// animate();