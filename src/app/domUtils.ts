/**
 * DOM 工具函数
 * 职责单一：提供带明确错误信息的元素获取，替代裸 `as`/`!` 断言
 */

/** getElementById 的安全版本，元素缺失时抛出包含 id 的明确错误 */
export function getElementByIdOrThrow<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`[EpsVect] 初始化失败：未找到必需的 DOM 元素 #${id}`);
  }
  return el as T;
}

/** querySelector 的安全版本，元素缺失时抛出包含 selector 的明确错误 */
export function querySelectorOrThrow<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(`[EpsVect] 初始化失败：未找到元素 "${selector}"`);
  }
  return el;
}
