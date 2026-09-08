import "./style.css";
import { createApp } from "./app/App";
import { installConsoleWarningFilter } from "./utils/ConsoleWarningFilter";

import { 
    showSettlement, 
    hideSettlement, 
    isSettlementShowing,
    //toggleSettlement,
    //setSettlementCallbacks 
} from './app/Vue';
import type { HudCdState } from "./app/HudCd";
import { preloadLevelLayout } from "./app/Level";

// ============================================
// 获取标题元素并控制显示
// ============================================
const SHOW_GITHUB = false;   // true = 显示，false = 隐藏
const titleElement = document.getElementsByClassName('title');
if (titleElement) {
    if (SHOW_GITHUB) {
        titleElement[0].classList.remove('hidden');
    } else {
        titleElement[0].classList.add('hidden');
    }
}
const uninstallConsoleWarningFilter = installConsoleWarningFilter();

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const statusElement = document.querySelector<HTMLElement>("[data-status]");
const vrmDropOverlay = document.querySelector<HTMLElement>("[data-vrm-drop-overlay]");

if (!canvas) throw new Error("Missing #scene canvas.");

async function initGame(cb?: () => void) {
  // 提前把模块加载到内存里
  await preloadLevelLayout(); 

  cb?.();
}
initGame(()=>{

    //#region 原来的 MainApp 启动
    //改成异步了
    const app = createApp({ canvas:canvas!, statusElement, vrmDropOverlay,dom:document});
    app.start();

    const hot = (
    import.meta as ImportMeta & {
        hot?: { dispose(callback: () => void): void };
    }
    ).hot;
    hot?.dispose(() => {
    app.dispose();
    uninstallConsoleWarningFilter();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 't' || e.key === 'T') {
        
            if (isSettlementShowing()) {
                hideSettlement();
            } else {
                const countdownState: HudCdState = app.getCountdownState();
                showSettlement({
                    countdownState,
                    onRestart: () => console.log('重新开始'),
                    onClose: () => console.log('关闭'),
                    onNextLevel: () => {
                        hideSettlement();
                        app.resetPlayer();
                    }
                });
            }
        }
    });
});
