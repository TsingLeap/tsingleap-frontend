// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // 让 expect / describe 等自动可用
    environment: 'jsdom', // 使用浏览器-like 的环境
    setupFiles: './vitest.setup.js', // 自定义 setup 逻辑
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});