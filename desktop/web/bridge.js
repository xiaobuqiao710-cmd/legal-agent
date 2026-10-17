/**
 * 引擎桥（Engine Bridge）—— 桌面 App 与法律逻辑之间的唯一接缝
 *
 * 设计背景：
 * 桌面 App 用 Swift + WKWebView 做外壳，法律逻辑仍然是项目里的 JS 模块。
 * 问题是：.app 不能假设用户机器上装了 Node（双击就开的 App 不该要求用户先装开发环境）。
 *
 * 解决方案：**把引擎代码在构建时打进 App 包**，由 WKWebView 直接执行。
 * 具体做法是 `build.sh` 把 lib/、agents/、tools/ 三个目录的 .mjs 内容
 * 转成一个个可直接 eval 的函数，注入到页面的全局作用域里。
 *
 * 因此本文件必须在**浏览器/WebView 环境**下运行，而不是 Node 环境：
 *   · 不能用 import / require
 *   · 不能用 fs / path
 *   · 模块之间用显式的注入表连接
 *
 * 这个文件由 build.sh 用 rollup-free 的朴素拼接方式生成在 App 里；
 * 这里保存的是**逻辑本身**，不包含环境相关代码。
 */

/* eslint-disable */

// ---------------------------------------------------------------------------
// 与 Swift 的通信
// ---------------------------------------------------------------------------

/**
 * 页面 → Swift：请求执行一个操作
 * Swift → 页面：调用 window.__engineResult(id, ok, data)
 */
function swiftCall(payload) {
  return new Promise((resolve, reject) => {
    const id = 'r' + Math.random().toString(36).slice(2) + Date.now();
    (window.__pending = window.__pending || {})[id] = { resolve, reject };
    window.webkit.messageHandlers.engine.postMessage({ id, ...payload });
  });
}

window.__engineResult = function (id, ok, data) {
  const p = (window.__pending || {})[id];
  if (!p) return;
  delete window.__pending[id];
  if (ok) p.resolve(data);
  else p.reject(new Error(data));
};
