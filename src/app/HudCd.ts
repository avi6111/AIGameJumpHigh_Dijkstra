// ============================================
// 文件: countdown-hud.ts (独立的倒计时HUD)
// ============================================
const COUNTDOWN_INTERVAL = 1.0; // 每秒更新一次
export interface HudCdState {
    totalSeconds: number;
    elapsedSeconds: number;
    remainingSeconds: number;
    isActive: boolean;
}

export interface HudCd {
    start(seconds: number): void;
    stop(): void;
    update(elapsed: number): void;
    getState(): HudCdState;
}

export function createCountDownHud(element:HTMLElement | null): HudCd {
    let totalSeconds = 0;
    let remainingSeconds = 0;
    //let intervalId: number | null = null;
    let isActive = false;
    let nextUpdateTime = 0;
    let lastDisplayText = '';
    const updateDisplay = (text: string) => {
        if (!element) return;
        if (text === lastDisplayText) return;
        element.textContent = text;
        lastDisplayText = text;
    };
    function formatTime(seconds: number): string {
        if (seconds <= 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    function start(seconds: number): void {
        totalSeconds = Math.max(0, seconds);
        remainingSeconds = totalSeconds;
        isActive = true;
        nextUpdateTime = 0;
        updateDisplay(`${formatTime(remainingSeconds)}`);
        
        // if (intervalId !== null) {
        //     clearInterval(intervalId);
        // }
        // intervalId = setInterval(() => {
        //     update(COUNTDOWN_INTERVAL);
        // }, COUNTDOWN_INTERVAL * 1000);
    }

    function stop(): void {
        isActive = false;
    }

    function update(elapsed: number): void {
        if (!isActive) return;
        if (elapsed < nextUpdateTime) return;
        
        remainingSeconds -= 1;
        nextUpdateTime = elapsed + COUNTDOWN_INTERVAL;
        
        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            isActive = false;
            updateDisplay("0:00");
            return;
        }
        
        updateDisplay(`${formatTime(remainingSeconds)}`);
    }

    function getState(): HudCdState {
        return {
            totalSeconds,
            elapsedSeconds: totalSeconds - remainingSeconds,
            remainingSeconds,
            isActive,
        };
    }

    return {
        start,
        stop,
        update,
        getState,
    };
}
// // 使用
// const countdownHud = createCountdownHud(document.getElementById('countdown'));
// countdownHud.start(60); // 60秒倒计时

// // 游戏循环中
// function gameLoop(elapsed) {
//   countdownHud.update(elapsed); // 每秒自动减1
// }