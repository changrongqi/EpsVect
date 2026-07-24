import { getDomRefs } from './app/domRefs';
import { bootstrapApp } from './app/bootstrap';
import type { AppContext } from './app/appContext';

let app: AppContext | null = null;

/** 移动端检测：本作品基于鼠标动向预测，移动端无意义，直接拦截 */
function isMobileDevice(): boolean {
  const ua = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return ua.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
}

function main(): void {
  // 移动端拦截：显示提示页，不启动应用
  if (isMobileDevice()) {
    const blocker = document.getElementById('mobile-blocker');
    if (blocker) blocker.classList.add('show');
    document.body.classList.add('mobile-blocked');
    return;
  }

  const refs = getDomRefs();
  app = bootstrapApp(refs);
}

main();

// HMR：卸载旧应用后再启动新的，避免 RAF/监听器泄漏累积
const hot = (import.meta as unknown as { hot?: { dispose: (cb: () => void) => void; accept: () => void } }).hot;
if (hot) {
  hot.dispose(() => {
    app?.destroy();
    app = null;
  });
  hot.accept();
}
