#!/bin/bash

# 全平台打包脚本 - 群聊总结大师
# 支持 macOS、Windows、Linux 的自动打包

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 图标定义
ROCKET="🚀"
CHECK="✅"
WARNING="⚠️"
ERROR="❌"
INFO="💡"
GEAR="⚙️"

echo -e "${CYAN}${ROCKET} 开始打包群聊总结大师 - 全平台版本${NC}"

# 进入应用目录
cd "$(dirname "$0")"

# 显示构建选项
echo -e "\n${YELLOW}${GEAR} 请选择要构建的平台：${NC}"
echo "1) macOS (ARM64)"
echo "2) Windows (x64)"
echo "3) Linux (x64)"
echo "4) 全部平台"

read -p "请输入选项 (1-4): " -n 1 -r
echo
choice=$REPLY

# 构建函数
build_macos() {
    echo -e "${BLUE}🍎 开始构建 macOS 应用...${NC}"

    # 1. 构建前端应用
    echo "📦 构建前端应用..."
    yarn build

    # 2. 复制后端二进制
    echo "🔧 复制 macOS 后端二进制文件..."
    if [ -f "../../bin/chatlog_darwin_arm64" ]; then
        cp ../../bin/chatlog_darwin_arm64 release/0.0.0/mac-arm64/Chatlog.app/Contents/Resources/chatlog
        echo "${CHECK} 已复制 ARM64 后端二进制"
    elif [ -f "../../bin/chatlog" ]; then
        cp ../../bin/chatlog release/0.0.0/mac-arm64/Chatlog.app/Contents/Resources/chatlog
        echo "${CHECK} 已复制后端二进制"
    else
        echo -e "${ERROR} 未找到 macOS 后端二进制文件${NC}"
        echo "${INFO} 请确保已运行: cd ../../ && go build -o bin/chatlog_darwin_arm64 ./cmd/chatlog"
        return 1
    fi

    # 确保二进制文件有执行权限
    chmod +x release/0.0.0/mac-arm64/Chatlog.app/Contents/Resources/chatlog

    # 3. 创建最终DMG包
    echo "📀 创建 macOS DMG包..."
    yarn electron-builder --mac --publish=never

    # 4. 显示结果
    if [ -f "release/0.0.0/Chatlog-Mac-0.0.0-Installer.dmg" ]; then
        echo -e "${GREEN}${CHECK} macOS 应用打包成功！${NC}"
        echo "📍 位置: release/0.0.0/Chatlog-Mac-0.0.0-Installer.dmg"
        echo "📏 大小: $(ls -lh release/0.0.0/*.dmg | awk '{print $5}')"
    else
        echo -e "${ERROR} macOS 应用打包失败${NC}"
        return 1
    fi
}

build_windows() {
    echo -e "${BLUE}🪟 开始构建 Windows 应用...${NC}"

    # 检查环境
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "${CHECK} 检测到 Windows 环境"
    else
        echo -e "${YELLOW}⚠️ 检测到非Windows环境，将进行交叉编译${NC}"
        echo "${INFO} 建议在 Windows 环境中运行以获得最佳结果"
    fi

    # 1. 构建前端应用
    echo "📦 构建前端应用..."
    yarn build

    # 2. 构建Windows版本
    echo "🪟 构建 Windows 安装包..."
    yarn electron-builder --win --publish=never

    # 3. 检查构建结果
    if [ -f "release/0.0.0/Chatlog-Windows-0.0.0-Setup.exe" ]; then
        echo -e "${GREEN}${CHECK} Windows 应用打包成功！${NC}"
        echo "📍 位置: release/0.0.0/Chatlog-Windows-0.0.0-Setup.exe"
        echo "📏 大小: $(ls -lh release/0.0.0/Chatlog-Windows-*.exe | awk '{print $5}')"
    elif [ -d "release/0.0.0/win-unpacked" ]; then
        echo -e "${GREEN}${CHECK} Windows 应用构建成功（未打包）${NC}"
        echo "📍 位置: release/0.0.0/win-unpacked/"
    else
        echo -e "${ERROR} Windows 应用构建失败${NC}"
        return 1
    fi
}

build_linux() {
    echo -e "${BLUE}🐧 开始构建 Linux 应用...${NC}"

    # 1. 构建前端应用
    echo "📦 构建前端应用..."
    yarn build

    # 2. 构建Linux版本
    echo "🐧 构建 Linux AppImage..."
    yarn electron-builder --linux --publish=never

    # 3. 检查构建结果
    if [ -f "release/0.0.0/Chatlog-Linux-0.0.0.AppImage" ]; then
        echo -e "${GREEN}${CHECK} Linux 应用打包成功！${NC}"
        echo "📍 位置: release/0.0.0/Chatlog-Linux-0.0.0.AppImage"
        echo "📏 大小: $(ls -lh release/0.0.0/*.AppImage | awk '{print $5}')"
    else
        echo -e "${ERROR} Linux 应用构建失败${NC}"
        return 1
    fi
}

# 显示功能特性
show_features() {
    echo -e "\n${PURPLE}✨ 功能特性：${NC}"
    echo "   • 自动获取dataKey - 无需手动操作"
    echo "   • 智能检测WeChat数据目录"
    echo "   • 自动适配WeChat版本"
    echo "   • 跨平台支持 - macOS/Windows/Linux"
    echo "   • 开箱即用 - 一键安装"
}

# 根据选择执行构建
case $choice in
    1)
        build_macos
        show_features
        ;;
    2)
        build_windows
        show_features
        ;;
    3)
        build_linux
        show_features
        ;;
    4)
        echo -e "${CYAN}🌍 开始构建全平台应用...${NC}"

        # 构建所有平台
        build_result=0
        build_macos || build_result=1
        build_windows || build_result=1
        build_linux || build_result=1

        if [ $build_result -eq 0 ]; then
            show_features
            echo -e "\n${GREEN}${ROCKET} 全平台构建完成！${NC}"
            echo ""
            echo "📦 生成的文件："
            ls -lh release/0.0.0/ | grep -E "\.(dmg|exe|AppImage)$"
        else
            echo -e "\n${ERROR}❌ 部分平台构建失败，请检查错误信息${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${ERROR}❌ 无效选项：$choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}🎉 打包完成！${NC}"
echo -e "${CYAN}🚀 现在可以分发给用户使用了！${NC}"