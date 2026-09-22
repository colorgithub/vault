/**
 * PostCSS 配置。
 *
 * 用对象形式（字符串键）而不是数组形式：Next.js 通过 postcss-load-config 加载，
 * 字符串键会被解析成模块名，这样 @tailwindcss/postcss 这类预设才能被正确实例化。
 * 数组形式传函数实例会报 "An unknown PostCSS plugin was provided"。
 *
 * 顺序很重要 —— Tailwind 先产出 CSS，然后依次降级：
 *   1. @layer         展开（Chromium < 99 会把整个块丢弃，最致命）
 *   2. oklch()/oklab  转 rgb（Chromium < 111 会让颜色声明整条失效）
 *   3. :where() -> :is()、dvh 回退、translate -> transform（本项目插件，CJS）
 *   4. :is() 展开为平铺选择器（:is 需要 Chromium 88+）
 *   5. 按 browserslist 补厂商前缀
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-cascade-layers": {},
    "@csstools/postcss-oklab-function": { preserve: false },
    "./postcss-android-webview.cjs": {},
    "@csstools/postcss-is-pseudo-class": { preserve: false },
    autoprefixer: {},
  },
};

export default config;
