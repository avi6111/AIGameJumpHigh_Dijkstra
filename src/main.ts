console.log('main 文件')
console.time('main 流程');
import "./style.css";
import { createApp } from "./app/App";
import { installConsoleWarningFilter } from "./utils/ConsoleWarningFilter";

import { 
    showMissLevelCfg,
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
console.timeLog('main 流程','Main Start()');
async function initGame(cb?: () => void) {
  // 提前把模块加载到内存里；配置缺失时弹出「关卡配置缺失」提示
  const ok = await preloadLevelLayout();
  console.timeLog('main 流程','s2');
  if (!ok) showMissLevelCfg();

  cb?.();
}
initGame(()=>{
    console.timeLog('main 流程','s3');
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
    console.timeLog('main 流程','s4');
    document.addEventListener('keydown', (e) => {
        if (e.key === 't' || e.key === 'T') {
        
            if (isSettlementShowing()) {
                hideSettlement();
            } else {
                //const countdownState: HudCdState = app.getCountdownState();
                // showSettlement({
                //     countdownState,
                //     onRestart: () => console.log('重新开始'),
                //     onClose: () => console.log('关闭'),
                //     onNextLevel: () => {
                //         hideSettlement();
                //         app.resetPlayer();
                //     }
                // });
                
            }

            showMissLevelCfg()
        }
    });
    console.timeEnd('main 流程');
});
console.timeLog('main 流程','s1');