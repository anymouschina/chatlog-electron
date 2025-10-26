#!/bin/bash

# 构建所有平台的后端二进制文件
# 支持: Windows (x64), macOS (ARM64/Intel), Linux (x64)

set -e

echo "🔧 开始构建群聊总结大师后端二进制文件..."

# 创建bin目录
mkdir -p bin

# 构建函数
build_binary() {
    local os=$1
    local arch=$2
    local filename=$3

    echo "📦 构建 $os $arch 版本..."

    case $os in
        "windows")
            GOOS=windows GOARCH=$arch go build -o "bin/$filename.exe" ./cmd/chatlog
            ;;
        "darwin")
            GOOS=darwin GOARCH=$arch go build -o "bin/$filename" ./cmd/chatlog
            ;;
        "linux")
            GOOS=linux GOARCH=$arch go build -o "bin/$filename" ./cmd/chatlog
            ;;
    esac

    if [ $? -eq 0 ]; then
        echo "✅ $os $arch 构建成功: bin/$filename${os:+.$os}"
        chmod +x "bin/$filename${os:+.$os}"
    else
        echo "❌ $os $arch 构建失败"
        return 1
    fi
}

# 进入项目根目录
cd "$(dirname "$0")"

echo ""
echo "🏗️  开始构建..."

# 构建 Windows x64 版本
build_binary "windows" "amd64" "chatlog_windows_x64"

# 构建 macOS ARM64 版本
build_binary "darwin" "arm64" "chatlog_darwin_arm64"

# 构建 macOS Intel 版本
build_binary "darwin" "amd64" "chatlog_darwin_amd64"

# 构建 Linux x64 版本
build_binary "linux" "amd64" "chatlog_linux_x64"

echo ""
echo "✅ 所有平台二进制构建完成！"
echo ""
echo "📦 生成的文件："
ls -lh bin/
echo ""
echo "💡 现在可以使用相应的打包脚本构建完整的应用程序："
echo "   • macOS: ./packages/chatlog-desktop/package_macos_app.sh"
echo "   • Windows: ./packages/chatlog-desktop/build_windows_app.sh"
echo "   • 全平台: ./packages/chatlog-desktop/build_all_platforms.sh"