#!/bin/bash
# build.sh —— 把 legal-agent 打包成 macOS 桌面 App
#
# 产物：dist/法律分析助手.app
#
# 构建流程：
#   1. 用 bundle-engine.mjs 把 JS 引擎打成一个可注入 WebView 的单文件
#   2. 把 index.html + 引擎 bundle 拷进 Resources
#   3. 生成 Info.plist
#   4. swiftc 编译外壳，放进 MacOS/
#   5. 生成本地自签名证书并签名（否则 WebView 的某些能力会被系统限制）
#
# 为什么不要求用户装 Node：App 是自包含的，引擎代码随包分发。

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DIST="$HERE/dist"
APP_NAME="法律分析助手"
APP="$DIST/$APP_NAME.app"

echo "==> 清理旧产物"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "==> 打包 JS 引擎"
node "$HERE/bundle-engine.mjs" "$HERE/web/engine.generated.js"

echo "==> 拷贝网页资源"
cp "$HERE/web/index.html" "$APP/Contents/Resources/index.html"
cp "$HERE/web/engine.generated.js" "$APP/Contents/Resources/engine.generated.js"

echo "==> 生成 Info.plist"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.xiaobuqiao.legalagent</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>LegalAgent</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>MIT License · xiaobuqiao710-cmd</string>
    <!-- 只支持深浅色，不强制外观，跟随系统 -->
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
</dict>
</plist>
PLIST

echo "==> 编译 Swift 外壳"
swiftc -O "$HERE/app/main.swift" -o "$APP/Contents/MacOS/LegalAgent"

echo "==> 签名（本地自签名）"
codesign --force --deep --sign - "$APP" 2>/dev/null || echo "   （签名跳过，不影响本机运行）"

echo "==> 验证产物"
SIZE=$(du -sh "$APP" | cut -f1)
echo "   路径：$APP"
echo "   大小：$SIZE"
echo ""
echo "   引擎模块：$(grep -c "^\s*\*/ \[" "$APP/Contents/Resources/engine.generated.js" 2>/dev/null || echo '—')"
echo ""
echo "完成。双击打开："
echo "   open \"$APP\""
