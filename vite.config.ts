import { defineConfig } from 'vite';

// GitHub Pages 部署在 https://changrongqi.github.io/EpsVect/ 子路径下，
// 构建时需要 base: '/EpsVect/' 让资源引用路径正确。
// 开发服务器仍用 '/' 保持 localhost:5173/ 直接访问。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/EpsVect/' : '/',
}));
