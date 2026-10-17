// LegalAgentApp —— 法律分析助手的 macOS 原生外壳
//
// 设计取舍：
//   · 用 SWIFT + WKWebView，而不是 Electron：Electron 要拖进 ~200MB 的 Chromium，
//     而 macOS 自带 WebKit，一个 .app 只有几百 KB。
//   · 法律逻辑不通过启动 Node 子进程来跑。App 不应该要求用户先装 Node 环境。
//     引擎在构建时被打包成 engine.generated.js（见 desktop/bundle-engine.mjs），
//     由 WKWebView 直接执行。
//   · 因此本文件只做三件事：开窗口、加载页面、在页面与引擎之间转发调用。
//
// 编译：见 build.sh

import Cocoa
import WebKit

// MARK: - 应用入口

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()

        // 窗口尺寸按"一半屏幕"取，避免在大屏上开成一小块
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let w = min(1180, screen.width * 0.86)
        let h = min(820, screen.height * 0.88)

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: w, height: h),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "法律分析助手"
        window.titlebarAppearsTransparent = false
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = false
        window.minSize = NSSize(width: 900, height: 620)
        window.center()

        // 记住上次的窗口大小与位置（第二次打开时直接是熟悉的样子）
        window.setFrameAutosaveName("LegalAgentMainWindow")

        let config = WKWebViewConfiguration()

        // 页面 → Swift 的通道。页面里用
        //   window.webkit.messageHandlers.engine.postMessage({id, op, ...})
        // 发请求；这里收到后转给引擎执行，再回调页面。
        // 用 .page world：与页面主脚本同一作用域，才能直接调用 window.LegalEngine。
        let handler = EngineMessageHandler()
        handler.webView = webView
        config.userContentController.addScriptMessageHandler(
            handler,
            contentWorld: .page,
            name: "engine"
        )

        // Swift → 页面：注入引擎代码（构建时生成的单文件 bundle）
        if let engineURL = Bundle.main.url(forResource: "engine.generated", withExtension: "js"),
           let engineCode = try? String(contentsOf: engineURL, encoding: .utf8) {
            config.userContentController.addUserScript(
                WKUserScript(source: engineCode, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            )
        } else {
            NSLog("[LegalAgentApp] 警告：未找到 engine.generated.js —— App 将无法执行分析")
        }

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground") // 让页面背景色透出来
        webView.navigationDelegate = self

        // 去掉右键菜单里的"重新载入"等开发项，保留"复制/粘贴"
        // （法律工作是阅读密集场景，能复制文本很重要）
        webView.allowsBackForwardNavigationGestures = false

        window.contentView = webView

        // 加载页面
        guard let pageURL = Bundle.main.url(forResource: "index", withExtension: "html") else {
            fatalError("找不到 index.html —— 构建产物不完整")
        }
        // 允许读取同目录下的资源
        webView.loadFileURL(pageURL, allowingReadAccessTo: pageURL.deletingLastPathComponent())

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // 关窗即退出（单窗口工具类 App 的常见行为）
        NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification,
            object: window,
            queue: .main
        ) { _ in
            NSApp.terminate(nil)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }


    // MARK: - 页面加载完成后的自检
    //
    // 时机很重要：userScript 在 atDocumentStart 注入，但注入 ≠ 页面已可执行；
    // 在 loadFileURL 之后立刻 evaluateJavaScript 会拿到 "window.LegalEngine 不存在"。
    // 实测踩过：日志里正是这个报错，很容易误判成"引擎没打进包里"。
    // 正确做法是等 WKNavigationDelegate 的 didFinish。
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("window.LegalEngine ? window.LegalEngine.hello() : null") { result, error in
            if let error = error {
                NSLog("[LegalAgentApp] 自检失败：引擎未加载 — \(error.localizedDescription)")
                return
            }
            guard let info = result as? [String: Any] else {
                NSLog("[LegalAgentApp] 自检失败：window.LegalEngine 不存在")
                return
            }
            NSLog("[LegalAgentApp] 引擎自检通过 modules=\(info["modules"] ?? "?") corpus=\(info["corpusSize"] ?? "?")")

            // 注意：evaluateJavaScript 的**最后一条表达式**若是 Promise，
            // 整个调用会被判为 "unsupported type" 而失败（即使前面的赋值已经执行）。
            // 所以末尾补一个 `0;` 把返回值钉成数字 —— 这是实测踩到的坑。
            let js = """
            (function(){
              window.__selfcheck = 'running';
              window.LegalEngine.ask('公司未披露重大担保是否构成虚假陈述？')
                .then(function(r){ window.__selfcheck = r.status + '|issues=' + r.issues.length; })
                .catch(function(e){ window.__selfcheck = 'ERR:' + ((e && e.message) || e); });
              return 0;
            })();
            """
            webView.evaluateJavaScript(js) { _, e2 in
                if let e2 = e2 {
                    NSLog("[LegalAgentApp] 端到端自检发起失败：\(e2.localizedDescription)")
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    webView.evaluateJavaScript("window.__selfcheck") { v, _ in
                        NSLog("[LegalAgentApp] 端到端自检结果 \(v ?? "nil")")
                    }
                }
            }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                    webView.evaluateJavaScript("window.__selfcheck") { v, _ in
                        NSLog("[LegalAgentApp] 端到端自检结果 \(v ?? "nil")")
                    }
                }
            }
        }
    }

    // MARK: 菜单

    /// 建一个最小但完整的菜单栏：去掉它，⌘C / ⌘V / ⌘A 都会失效。
    /// 对法律工具来说不能复制文本是致命的，所以这几项必须有。
    private func setupMenu() {
        let mainMenu = NSMenu()

        // App 菜单
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 法律分析助手", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // 编辑菜单：这几项决定了输入框能否正常复制粘贴
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "编辑")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // 视图菜单
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "视图")
        viewMenuItem.submenu = viewMenu
        viewMenu.addItem(withTitle: "放大", action: #selector(zoomIn), keyEquivalent: "=")
        viewMenu.addItem(withTitle: "缩小", action: #selector(zoomOut), keyEquivalent: "-")
        viewMenu.addItem(withTitle: "实际大小", action: #selector(zoomReset), keyEquivalent: "0")

        NSApp.mainMenu = mainMenu
    }

    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "法律分析助手"
        alert.informativeText = """
        四智能体法律检索工作流

        检索 → 分析 → 写作 → 质检，每一步都过门禁校验。
        所有条文来自本地语料库，不联网、不编造。

        产出为工作底稿，不构成法律意见。
        """
        alert.alertStyle = .informational
        alert.addButton(withTitle: "好")
        alert.runModal()
    }

    @objc private func zoomIn() { webView.pageZoom = min(2.0, webView.pageZoom + 0.1) }
    @objc private func zoomOut() { webView.pageZoom = max(0.6, webView.pageZoom - 0.1) }
    @objc private func zoomReset() { webView.pageZoom = 1.0 }
}

// MARK: - 引擎消息处理
//
// 页面发来 {id, op, ...}，这里在 JS 上下文里调用 window.LegalEngine[op](...)，
// 拿到 Promise 结果后通过 window.__engineResult(id, ok, data) 回传。

final class EngineMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var webView: WKWebView?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard let body = message.body as? [String: Any],
              body["id"] is String,
              body["op"] is String else {
            replyHandler(nil, "请求格式不正确")
            return
        }

        // 把参数打包成 JS 调用
        let jsonData = try? JSONSerialization.data(withJSONObject: body, options: [])
        let jsonStr = jsonData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

        // 构造调用：window.LegalEngine[op](payload).then(ok).catch(err)
        // 结果统一通过 __engineResult 回传给页面的 Promise
        let js = """
        (function(){
          var payload = \(jsonStr);
          var op = payload.op;
          var id = payload.id;
          try {
            var fn = window.LegalEngine && window.LegalEngine[op];
            if (typeof fn !== 'function') {
              window.__engineResult(id, false, '未知操作: ' + op);
              return;
            }
            var arg;
            if (op === 'ask') arg = payload.question;
            else if (op === 'check') arg = payload.text;
            else arg = undefined;
            Promise.resolve(fn.call(window.LegalEngine, arg))
              .then(function(r){
                window.__engineResult(id, true, r);
              })
              .catch(function(e){
                window.__engineResult(id, false, (e && e.message) || String(e));
              });
          } catch (e) {
            window.__engineResult(id, false, (e && e.message) || String(e));
          }
        })();
        """

        webView?.evaluateJavaScript(js) { _, error in
            if let error = error {
                NSLog("[LegalAgentApp] 引擎调用失败：\(error.localizedDescription)")
            }
        }

        // 这里立刻回一个 ack —— 真正的结果走 __engineResult
        replyHandler(["ok": true], nil)
    }
}

// MARK: - 启动

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
