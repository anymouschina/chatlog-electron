#!/bin/bash

# Windows 应用打包脚本 - 群聊总结大师
# 包含所有修复：自动dataKey获取、智能目录检测、版本适配

set -e

echo "🚀 开始打包群聊总结大师 Windows 应用..."

# 检查是否在Windows环境或交叉编译环境
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "✅ 检测到Windows环境"
    PLATFORM="windows"
else
    echo "⚠️  检测到非Windows环境，将进行交叉编译"
    echo "💡 提示：建议在Windows环境中运行此脚本以获得最佳结果"
    PLATFORM="cross-compile"
fi

# 进入应用目录
cd "$(dirname "$0")"

# 1. 构建前端应用
echo "📦 构建前端应用..."
yarn build

# 2. 构建Windows版本
echo "🪟 构建 Windows 应用..."
yarn electron-builder --win --publish=never

# 3. 检查构建结果
if [ -f "release/0.0.0/Chatlog-Windows-0.0.0-Setup.exe" ]; then
    echo "✅ Windows 安装包构建成功"
    echo "📍 位置: release/0.0.0/Chatlog-Windows-0.0.0-Setup.exe"
    echo "📏 大小: $(ls -lh release/0.0.0/Chatlog-Windows-*.exe | awk '{print $5}')"
elif [ -d "release/0.0.0/win-unpacked" ]; then
    echo "✅ Windows 应用构建成功（未打包）"
    echo "📍 位置: release/0.0.0/win-unpacked/"
else
    echo "❌ Windows 应用构建失败"
    echo "💡 请检查以下问题："
    echo "   1. 确保已安装 Node.js 和 npm/yarn"
    echo "   2. 确保有构建权限"
    echo "   3. 检查 electron-builder 配置"
    exit 1
fi

# 4. 显示结果
echo ""
echo "🎉 Windows 应用打包完成！"
echo ""
echo "✨ 功能特性:"
echo "   • 自动获取dataKey - 无需手动操作"
echo "   • 智能检测WeChat数据目录"
echo "   • 自动适配WeChat版本"
echo "   • 开箱即用 - 双击安装"
echo ""
echo "📋 使用说明:"
echo "   1. 下载 Chatlog-Windows-0.0.0-Setup.exe"
echo "   2. 双击运行安装程序"
echo "   3. 启动应用，自动检测WeChat数据"
echo "   4. 开始使用群聊总结功能"
echo ""
echo "🚀 Windows 用户可以开始使用了！"

# 如果在Windows环境中，询问是否立即测试
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo ""
    read -p "是否立即启动已安装的应用？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "release/0.0.0/win-unpacked/Chatlog.exe" ]; then
            echo "🚀 启动应用..."
            "release/0.0.0/win-unpacked/Chatlog.exe" &
            echo "✅ 应用已启动"
        else
            echo "💡 请先安装应用再测试"
        fi
    fi
fi