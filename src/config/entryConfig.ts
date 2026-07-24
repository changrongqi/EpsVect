import type { ViewName } from '../ui/viewSwitcher';

export interface EntryConfig {
  id: string;
  theta: number;
  phi: number;
  label: string;
  dataView: ViewName;
}

const DEG = Math.PI / 180;

export const ENTRY_CONFIGS: EntryConfig[] = [
  { id: 'algo-test',       theta:   0 * DEG, phi: 50 * DEG, label: '算法演示', dataView: 'algo-test' },
  { id: 'about',           theta:  72 * DEG, phi: 50 * DEG, label: '关于项目', dataView: 'about' },
  { id: 'settings',        theta: 144 * DEG, phi: 50 * DEG, label: '参数设置', dataView: 'settings' },
  { id: 'source-code',     theta: 216 * DEG, phi: 50 * DEG, label: '源代码',   dataView: 'source-code' },
  { id: 'math-derivation', theta: 288 * DEG, phi: 50 * DEG, label: '数学推导', dataView: 'math-derivation' },
];
