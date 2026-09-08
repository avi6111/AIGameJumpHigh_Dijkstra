import * as THREE from 'three';
import { Pane } from 'tweakpane';//npm install lil-gui --legacy-peer-deps

export class AudioInspector {
  private listener: THREE.AudioListener;
  private sound: THREE.Audio;
  private audioLoader: THREE.AudioLoader;
  private pane: Pane;
  private storageKey = 'three-audio-inspector-state';
  
  // 状态对象
  private state: { 
    fileName: string | null; 
    isPlaying: boolean; 
    volume: number; 
    fileData: string | null; 
    statusText: string; 
  } = { 
    fileName: null, 
    isPlaying: false, 
    volume: 0.5, 
    fileData: null,
    statusText: '⏸ 已暂停' 
  };

  constructor(camera: THREE.Camera) {
    // 1. 初始化 Three.js 音频系统
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.audioLoader = new THREE.AudioLoader();
    this.sound = new THREE.Audio(this.listener);

    // 2. 恢复上次保存的状态
    this.restoreState();

    // 3. 创建 Tweakpane 面板
    this.pane = new Pane({ title: '🎵 音乐模块 Inspector' });
    
    // 添加按钮
    this.pane.addButton({ title: '▶ 播放1' }).on('click', () => this.playAudio());
    this.pane.addButton({ title: '⏸ 暂停' }).on('click', () => this.pauseAudio());
    this.pane.addButton({ title: '📂 导入本地 BGM' }).on('click', () => this.loadLocalBGM());
    
    // 添加音量滑块
    this.pane.addBinding(this.state, 'volume', { 
      label: '音量', 
      min: 0, 
      max: 1, 
      step: 0.01 
    }).on('change', (ev:any) => {
      this.sound.setVolume(ev.value);
      this.saveState();
    });

    // this.pane.addBinding(this.state, 'statusText', { 
    // label: '状态', 
    // readonly: true 
    // });
    // 4. 注入自定义 CSS 动画（折叠时显示旋转图标）
    this.injectCustomStyles();
  }

  // 播放逻辑
  private playAudio() {
    if (this.sound.buffer && !this.sound.isPlaying) {
      this.sound.play();
      this.state.isPlaying = true;  
      this.state.statusText = '  播放中...';
      this.saveState();
    }
  }

  // 暂停逻辑
  private pauseAudio() {
    if (this.sound.isPlaying) {
      this.sound.pause();
      this.state.isPlaying = false;
      this.state.statusText = '⏸ 已暂停';
      this.saveState();
    }
  }

  // 导入本地文件
  private loadLocalBGM() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (this.sound.isPlaying) this.sound.stop();

      const url = URL.createObjectURL(file);
      this.audioLoader.load(url, (buffer) => {
        this.sound.setBuffer(buffer);
        this.sound.setLoop(true);
        this.sound.setVolume(this.state.volume);
        this.sound.play();
        
        this.state.fileName = file.name;
        this.state.isPlaying = true;
        
        // 将文件转为 Base64 存入 localStorage
        this.fileToBase64(file).then(base64 => {
          this.state.fileData = base64;
          this.saveState();
        });

        URL.revokeObjectURL(url);
      });
    };
    input.click();
  }

  // 更新状态并持久化
  private saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    this.updateIconVisibility(); // 状态改变时更新图标
  }

  // 从 localStorage 恢复状态
  private restoreState() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
        
        if (this.state.fileData) {
          this.audioLoader.load(this.state.fileData, (buffer) => {
            this.sound.setBuffer(buffer);
            this.sound.setLoop(true);
            this.sound.setVolume(this.state.volume);
            if (this.state.isPlaying) {
              setTimeout(() => this.sound.play(), 100);
            }
            this.updateIconVisibility();
          });
        }
      } catch (e) {
        console.warn('Failed to restore audio state', e);
      }
    }
  }

  // 文件转 Base64
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }

    // 注入 CSS 实现折叠时的旋转动画
  private injectCustomStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      /* 1. 默认隐藏旋转图标 */
      .tp-rotating-icon { 
        display: none !important; 
        margin-left: 8px; 
        /*filter: hue-rotate(180deg) saturate(2); (实测是绿色不是蓝色) 强制将 Emoji 染成蓝色 */
        /* 240deg 负责把黄色转到蓝色，saturate 负责让蓝色更纯正   （更加亮色，绿色了）  */
            filter: hue-rotate(240deg) saturate(3) brightness(1.2); 
      }
      /* 确保每个子元素不会溢出或隐藏 */
.tp-rotv_b > * {
    flex-shrink: 0;         /* 不被压缩 */
    /* 或者用 flex: 0 0 auto; */
}
    /* 让容器使用 flex 布局，三个元素都在一行显示 */
.tp-rotv_b {
    display: flex;
    align-items: center;     /* 垂直居中 */
    gap: 10px;              /* 元素间距 */
    /* 如果容器宽度不够，允许换行 */
    flex-wrap: wrap;
}
      /* 调整插入在按钮内的图标样式 */
    .tp-rotv_b .tp-rotating-icon {
    font-size: 14px;        /* 调整图标大小 */
    margin-left: 6px;       /* 调整与按钮文字的间距 */
    vertical-align: middle; /* 确保垂直居中对齐 */
    pointer-events: none;   /* 防止鼠标点击到图标上导致按钮事件失效 */
    }
      /* 2. 核心修复：当 Tweakpane 处于折叠状态 ([expanded=false]) 且音频正在播放 (.playing) 时 
      .tp-rotv_t //测试旋转整个title, OK !!!*/
      .tp-rotating-icon.playing
      {
        display: inline-block !important;
        animation: spin-audio 1s linear infinite !important;
      }

      @keyframes spin-audio {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // 将图标插入到 Tweakpane 标题中
    const titleEl = this.pane.element.querySelector('.tp-rotv_b');
    if (titleEl) {
      const icon = document.createElement('span');
      icon.className = 'tp-rotating-icon';
      icon.textContent = '🎵';
      titleEl.appendChild(icon);
    }else
    {
        console.log("titleEl 不存在")
    }
  }

  // 更新图标可见性
  private updateIconVisibility() {
    const icon = this.pane.element.querySelector('.tp-rotating-icon');
    if (icon) {
      if (this.state.isPlaying) {
        icon.classList.add('playing');
        this.state.statusText = '🎵 播放中...';
      } else {
        icon.classList.remove('playing');
         this.state.statusText = '⏸ 已暂停';
      }
      //this.pane.refresh(); 
    }

  }

  // 销毁方法
  public dispose() {
    if (this.sound.isPlaying) this.sound.stop();
    this.pane.dispose();
  }
}