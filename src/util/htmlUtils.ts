/**
 * HTML 文本处理工具
 * 提供转义和高亮渲染的公共方法，供 narrativeRenderer / settingsRenderer 复用
 */

/** HTML 特殊字符转义，防止配置内容含 < & 等被解析为标签 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 渲染段落文本：先转义，再对关键词加 <mark> 高亮。
 *
 * 实现要点（修复旧版 bug）：
 * 1. 先对原文做 escapeHtml，避免配置内容含 < 被当作标签
 * 2. 关键词匹配基于转义后的文本，用占位符法避免标记字符串本身被后续关键词匹配
 * 3. 替换字符串用函数形式，避免 $ 模式（$& $\` $'）被错误展开
 *
 * @param text 原始段落文本
 * @param keywords 需要高亮的关键词列表
 */
export function renderParagraphWithHighlights(text: string, keywords: string[]): string {
  let result = escapeHtml(text);
  if (keywords.length === 0) return result;

  // 占位符法：每个关键词替换为唯一占位符，最后统一替换为 <mark>
  // 避免已插入的 <mark> 标签字符串被后续关键词正则匹配到
  const placeholders: string[] = [];
  for (const kw of keywords) {
    if (!kw) continue;
    const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escapedKw, 'g');
    const placeholder = `\u0000HL${placeholders.length}\u0000`;
    // 用函数形式替换，kw 中的 $ 不会被当作特殊模式
    result = result.replace(re, () => placeholder);
    placeholders.push(kw);
  }

  // 占位符替换为 <mark>（关键词本身也需转义，防止含 < 等字符）
  for (let i = 0; i < placeholders.length; i++) {
    const placeholder = `\u0000HL${i}\u0000`;
    const escapedKw = escapeHtml(placeholders[i]);
    result = result.split(placeholder).join(`<mark class="narrative-keyword">${escapedKw}</mark>`);
  }

  return result;
}
