export interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  depth: 0 | 1 | 2;
}

const STAR_COLORS = [
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#aaccff',
  '#aaccff',
  '#ffe8d0',
  '#ffeedd',
  '#ddeeff',
  '#e8f0ff',
  '#fff4e0',
  '#ffcc80',
  '#ff88aa',
  '#88ffcc',
];

const VIRTUAL_MARGIN = 250;

export function createStar(w: number, h: number): Star {
  const rand = Math.random();
  const depth: 0 | 1 | 2 = rand < 0.5 ? 0 : rand < 0.85 ? 1 : 2;

  let radius: number;
  let baseAlpha: number;
  if (depth === 0) {
    radius = 0.4 + Math.random() * 0.6;
    baseAlpha = 0.3 + Math.random() * 0.4;
  } else if (depth === 1) {
    radius = 1.0 + Math.random() * 0.9;
    baseAlpha = 0.5 + Math.random() * 0.4;
  } else {
    radius = 1.8 + Math.random() * 1.5;
    baseAlpha = 0.8 + Math.random() * 0.2;
  }

  return {
    x: -VIRTUAL_MARGIN + Math.random() * (w + VIRTUAL_MARGIN * 2),
    y: -VIRTUAL_MARGIN + Math.random() * (h + VIRTUAL_MARGIN * 2),
    radius,
    baseAlpha,
    twinkleSpeed: 0.5 + Math.random() * 3.0,
    twinklePhase: Math.random() * Math.PI * 2,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    depth,
  };
}

export function createStars(count: number, w: number, h: number): Star[] {
  const stars: Star[] = new Array(count);
  for (let i = 0; i < count; i++) {
    stars[i] = createStar(w, h);
  }
  return stars;
}

export const STAR_COUNT = 350;
export const STAR_COUNT_HOME = 250;
