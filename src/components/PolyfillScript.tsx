import { POLYFILL_SCRIPT } from "@/lib/polyfills";

/**
 * 在 <head> 最前面注入运行时 polyfill。
 *
 * 必须是内联脚本且位于所有 bundle 之前：Next 的 chunk 以 defer/module 加载，
 * 而 head 里的内联脚本在解析阶段就会同步执行，因此能保证 polyfill 先就位。
 * 否则旧 WebView 会在框架代码里因为缺少 globalThis / Object.fromEntries 直接报错。
 */
export function PolyfillScript() {
  return <script dangerouslySetInnerHTML={{ __html: POLYFILL_SCRIPT }} />;
}
