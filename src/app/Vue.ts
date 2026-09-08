// ============================================
// settlement.ts - 更简洁的版本
// ============================================
import { createApp, type App as VueApp } from 'vue';
//import SettlementPage from './SettlementPage.vue';
//import VSet2 from './VSet2.vue'
//import VResult from './VResultOverlay.vue'
import VResult from './VResultWinX.vue'
import type { HudCdState } from './HudCd';

let app: VueApp | null = null;
let mountEl: HTMLElement | null = null;
let isShowing = false;

export function showSettlement(options?: {
    countdownState?: HudCdState;
    onRestart?: () => void;
    onClose?: () => void;
    onNextLevel?: () => void;
}) {
    // ✅ 防止重复显示
    if (isShowing) {
        console.warn('⚠️ 结算页面已显示');
        return;
    }
    //style.css 默认隐藏，很大问题。。。
// #vue-settlement-mount
// {
//   position: fixed;
//   top: 50%;
//   left: 50%;
//   transform: translate(-50%, -50%);
//   z-index: 1000;  /* 高于 #root 和所有元素 */
//   width: 90%;
//   max-width: 500px;
//   background: rgba(20, 30, 28, 0.95);
//   backdrop-filter: blur(12px);
//   border: 1px solid rgba(184, 201, 167, 0.3);
//   border-radius: 16px;
//   padding: 32px 28px;
//   box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
//   color: #f1f6ec;
//   font-family: "Avenir Next", "Trebuchet MS", sans-serif;
//   display: none;  /* 默认隐藏 */
//   pointer-events: auto;
// }
    
// 星星显示规则
// stars 值	显示
// 3	★ ★ ★
// 2.5	★ ★ ☆

    const mainElement = document.getElementById('main') || document.getElementById('root');

    mountEl = document.createElement('div');
    mountEl.id = 'vue-settlement-mount';
    //document.body.appendChild(mountEl);
    mainElement?.parentNode?.insertBefore(mountEl, mainElement);

    app = createApp(VResult, {
        countdownState: options?.countdownState,
        onRestart: () => {
            hideSettlement();
            options?.onRestart?.();
        },
        onClose: () => {
            hideSettlement();
            options?.onClose?.();
        },
        onNextLevel:()=>{
            console.log('➡️ 下一关');
            //app?.resetPlayer?.();
            options?.onNextLevel?.();
        }
        
    });

    app.mount(mountEl);
    isShowing = true;
}

export function hideSettlement() {
    if (app) {
        app.unmount();
        app = null;
    }
    if (mountEl && mountEl.parentNode) {
        mountEl.parentNode.removeChild(mountEl);
        mountEl = null;
    }
    isShowing = false;
}

export function isSettlementShowing() {
    return isShowing;
}

// // ============ 🎯 键盘监听 ============
// document.addEventListener('keydown', (e) => {
//     // 按 T 键显示结算页面
//     if (e.key === 't' || e.key === 'T') {
//         // 如果已经显示，先关闭再打开（或直接忽略）
//         if (isSettlementShowing()) {
//             hideSettlement();
//         } else {
//             showSettlement({
//                 onRestart: () => {
//                     console.log('🔄 重新开始');
//                     // 这里写重新开始的逻辑
//                 },
//                 onClose: () => {
//                     console.log('✕ 关闭结算页面');
//                 }
//             });
//         }
//     }
// });

// console.log('🎮 按 T 键显示/关闭结算页面');