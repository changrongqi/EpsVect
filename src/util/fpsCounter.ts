/**
 * FPS 计数器
 * 统计 requestAnimationFrame 循环的帧率
 */
export function createFpsCounter(): { tick: () => number; reset: () => void } {
  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 60;

  function tick(): number {
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastTime;

    if (elapsed >= 500) {
      currentFps = Math.round((frameCount / elapsed) * 1000);
      frameCount = 0;
      lastTime = now;
    }

    return currentFps;
  }

  function reset(): void {
    frameCount = 0;
    lastTime = performance.now();
    currentFps = 0;
  }

  return { tick, reset };
}