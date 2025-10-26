#!/bin/bash

# 一键打包脚本 - 群聊总结大师 macOS 应用
# 包含所有修复：自动dataKey获取、智能目录检测、版本适配

set -e

echo "🚀 开始打包群聊总结大师 macOS 应用..."

# 进入应用目录
cd "$(dirname "$0")"

# 1. 构建前端应用
echo "📦 构建前端应用..."
yarn build

# 2. 复制工作的后端二进制文件
echo "🔧 复制后端二进制文件..."
if [ -f "../../bin/chatlog_darwin_arm64" ]; then
    cp ../../bin/chatlog_darwin_arm64 release/0.0.0/mac-arm64/Chatlog.app/Contents/Resources/chatlog
    echo "✅ 已复制 ARM64 后端二进制"
elif [ -f "../../bin/chatlog" ]; then
    cp ../../bin/chatlog release/0.0.0/mac-arm64/Chatlog.app/Contents/Resources/chatlog
    echo "✅ 已复制后端二进制"
else
    echo "❌ 未找到后端二进制文件"
    exit 1
fi

# 确保二进制文件有执行权限
chmod +x release/0.0.0/mac-arm64/Chatlog.app/Contents/Resources/chatlog

# 3. 创建最终DMG包
echo "📀 创建最终DMG包..."
yarn electron-builder --mac --publish=never

# 4. 显示结果
echo ""
echo "🎉 打包完成！"
echo "📍 位置: release/0.0.0/Chatlog-Mac-0.0.0-Installer.dmg"
echo "📏 大小: $(ls -lh release/0.0.0/*.dmg | awk '{print $5}')"
echo ""
echo "✨ 功能特性:"
echo "   • 自动获取dataKey - 无需手动操作"
echo "   • 智能检测WeChat数据目录"
echo "   • 自动适配WeChat版本"
echo "   • 开箱即用 - 双击即用"
echo ""
echo "🚀 现在可以分发给用户使用了！"