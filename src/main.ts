import { getDomRefs } from './app/domRefs';
import { bootstrapApp } from './app/bootstrap';
import type { AppContext } from './app/appContext';

let app: AppContext | null = null;

function main(): void {
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
