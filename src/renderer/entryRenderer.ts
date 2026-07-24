/**
 * 入口渲染器
 * 负责 3D 球面鱼眼投影计算和入口文字渲染
 * 摄像机在球心仰望天穹，入口文字散布在天穹内壁上
 */

export interface EntryRenderData {
  id: string;
  label: string;
  theta: number;
  phi: number;
  tendency: number;
}

interface ProjectedEntry extends EntryRenderData {
  screenX: number;
  screenY: number;
  alpha: number;
  scale: number;
  driftTheta: number;
  driftPhi: number;
}

const FISHEYE_F = 0.55;
const HIGHLIGHT_MIN = 0.1;

function fishEyeProject(
  theta: number, phi: number,
  cx: number, cy: number, f: number,
): { screenX: number; screenY: number; alpha: number; scale: number } {
  const dx = Math.cos(phi) * Math.sin(theta);
  const dy = Math.sin(phi);
  const dz = Math.cos(phi) * Math.cos(theta);

  const alpha = Math.acos(Math.max(-1, Math.min(1, dy)));
  const r = f * alpha;
  const screenDir = alpha > 0.001 ? Math.atan2(dz, dx) : 0;
  const scale = Math.cos(alpha * 0.55);

  return {
    screenX: cx + r * Math.cos(screenDir),
    screenY: cy - r * Math.sin(screenDir),
    alpha,
    scale,
  };
}

export function projectEntries(entries: EntryRenderData[]): ProjectedEntry[] {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const f = Math.min(window.innerWidth, window.innerHeight) * FISHEYE_F;
  const t = performance.now() / 1000;

  return entries.map((entry) => {
    const driftAmp = 0.04;
    const driftFreq = 0.35 + entry.theta * 0.1;
    const driftTheta = entry.theta + driftAmp * Math.sin(t * driftFreq + entry.phi * 2);
    const driftPhi = entry.phi + driftAmp * 0.6 * Math.sin(t * driftFreq * 1.4 + entry.theta);

    const proj = fishEyeProject(driftTheta, driftPhi, cx, cy, f);
    return {
      ...entry,
      ...proj,
      driftTheta,
      driftPhi,
    };
  });
}

export function getHighlightedEntry(entries: ProjectedEntry[]): string | null {
  if (entries.length === 0) return null;
  let best: ProjectedEntry | null = null;
  for (const entry of entries) {
    if (entry.tendency > HIGHLIGHT_MIN) {
      if (!best || entry.tendency > best.tendency) {
        best = entry;
      }
    }
  }
  return best ? best.id : null;
}

export function renderEntries(ctx: CanvasRenderingContext2D, entries: ProjectedEntry[]): void {
  const sorted = [...entries].sort((a, b) => a.alpha - b.alpha);
  for (const entry of sorted) {
    drawEntryText(ctx, entry);
  }
}

function drawEntryText(ctx: CanvasRenderingContext2D, entry: ProjectedEntry): void {
  const { label, tendency, driftTheta, driftPhi, scale } = entry;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const f = Math.min(window.innerWidth, window.innerHeight) * FISHEYE_F;
  const t = performance.now() / 1000;

  const chars = [...label];
  const n = chars.length;
  const charSpan = 0.06;

  const highlightStrength = tendency > HIGHLIGHT_MIN
    ? (tendency - HIGHLIGHT_MIN) / (1 - HIGHLIGHT_MIN)
    : 0;
  const depthAlpha = 0.5 + 0.5 * scale;
  const baseFontSize = Math.max(14, 22 * scale);

  const charData: { sx: number; sy: number; rot: number }[] = [];
  for (let i = 0; i < n; i++) {
    const thetaOff = (i - (n - 1) / 2) * charSpan;
    const p = fishEyeProject(driftTheta + thetaOff, driftPhi, cx, cy, f);
    charData.push({ sx: p.screenX, sy: p.screenY, rot: 0 });
  }

  for (let i = 0; i < n; i++) {
    if (i < n - 1) {
      charData[i].rot = Math.atan2(charData[i + 1].sy - charData[i].sy, charData[i + 1].sx - charData[i].sx);
    } else if (i > 0) {
      charData[i].rot = charData[i - 1].rot;
    }
  }

  const flowAmp = 2.5;
  const flowFreq = 1.6;
  const flowPhase = 0.7;
  const rotAmp = 0.06;

  for (let i = 0; i < n; i++) {
    const { sx, sy, rot } = charData[i];

    const flowY = flowAmp * Math.sin(t * flowFreq + i * flowPhase + driftTheta * 2.5);
    const flowRot = rotAmp * Math.sin(t * flowFreq * 1.3 + i * flowPhase * 1.1 + driftTheta * 2);

    const charX = sx;
    const charY = sy + flowY;
    const charRot = rot + flowRot;

    ctx.save();
    ctx.translate(charX, charY);
    ctx.rotate(charRot);

    if (highlightStrength > 0.05) {
      ctx.shadowColor = `rgba(140, 200, 255, ${highlightStrength * 0.8})`;
      ctx.shadowBlur = 6 + highlightStrength * 16;
    }

    const fontSize = baseFontSize * (1 + tendency * 0.2);
    ctx.font = `300 ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textAlpha = (0.7 + highlightStrength * 0.3) * depthAlpha;
    ctx.fillStyle = `rgba(210, 230, 255, ${textAlpha})`;
    ctx.fillText(chars[i], 0, 0);

    ctx.restore();
  }
}
