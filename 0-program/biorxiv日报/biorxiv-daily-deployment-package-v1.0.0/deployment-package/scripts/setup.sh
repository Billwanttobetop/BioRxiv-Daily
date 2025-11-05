#!/bin/bash

# BioRxiv日报 - 环境设置脚本
# 自动配置开发环境和生产环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查操作系统
check_os() {
    log_info "检查操作系统..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log_success "检测到Linux系统"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log_success "检测到macOS系统"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        log_success "检测到Windows系统"
    else
        log_warning "未识别的操作系统: $OSTYPE"
        OS="unknown"
    fi
}

# 检查必要软件
check_software() {
    log_info "检查必要软件..."
    
    local missing_software=()
    
    # 检查Git
    if ! command -v git &> /dev/null; then
        missing_software+=("git")
    fi
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        missing_software+=("node")
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        missing_software+=("npm")
    fi
    
    if [ ${#missing_software[@]} -gt 0 ]; then
        log_warning "缺少以下软件: ${missing_software[*]}"
        log_info "请先安装这些软件，然后重新运行此脚本"
        
        echo ""
        log_info "安装指南:"
        echo "  macOS: brew install git node"
        echo "  Ubuntu/Debian: sudo apt install git nodejs npm"
        echo "  CentOS/RHEL: sudo yum install git nodejs npm"
        echo "  Windows: 下载并安装Git和Node.js"
        
        exit 1
    fi
    
    log_success "必要软件检查完成"
}

# 安装Node.js (如果需要)
install_nodejs() {
    log_info "检查Node.js版本..."
    
    local node_version=$(node -v | sed 's/v//')
    local required_version="18.0.0"
    
    if ! node -v &> /dev/null; then
        log_warning "Node.js未安装"
        return 1
    fi
    
    # 检查版本是否满足要求
    if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]; then
        log_success "Node.js版本满足要求: $node_version"
        return 0
    else
        log_warning "Node.js版本过低: $node_version (需要 >= $required_version)"
        
        echo ""
        log_info "Node.js安装选项:"
        echo "  1. 使用nvm管理版本 (推荐)"
        echo "  2. 从官网下载安装: https://nodejs.org/"
        echo "  3. 使用包管理器安装"
        
        read -p "请选择安装方式 (1-3): " choice
        
        case $choice in
            1)
                install_nvm
                ;;
            2)
                log_info "请访问 https://nodejs.org/ 下载并安装Node.js"
                exit 1
                ;;
            3)
                install_nodejs_package_manager
                ;;
            *)
                log_error "无效选择"
                exit 1
                ;;
        esac
    fi
}

# 安装nvm
install_nvm() {
    log_info "安装nvm..."
    
    if [ -d "$HOME/.nvm" ]; then
        log_warning "nvm已安装"
        return 0
    fi
    
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    
    # 加载nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    # 安装Node.js LTS版本
    nvm install --lts
    nvm use --lts
    nvm alias default node
    
    log_success "nvm安装完成"
}

# 使用包管理器安装Node.js
install_nodejs_package_manager() {
    log_info "使用包管理器安装Node.js..."
    
    case $OS in
        "linux")
            if command -v apt &> /dev/null; then
                # Ubuntu/Debian
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command -v yum &> /dev/null; then
                # CentOS/RHEL
                curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
                sudo yum install -y nodejs
            elif command -v pacman &> /dev/null; then
                # Arch Linux
                sudo pacman -S nodejs npm
            else
                log_error "不支持的Linux发行版"
                exit 1
            fi
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install node
            else
                log_error "请先安装Homebrew或从官网下载安装Node.js"
                exit 1
            fi
            ;;
        *)
            log_error "请从官网下载安装Node.js: https://nodejs.org/"
            exit 1
            ;;
    esac
    
    log_success "Node.js安装完成"
}

# 安装pnpm
install_pnpm() {
    log_info "检查pnpm..."
    
    if command -v pnpm &> /dev/null; then
        local pnpm_version=$(pnpm -v)
        log_success "pnpm已安装: $pnpm_version"
        return 0
    fi
    
    log_info "安装pnpm..."
    
    # 使用npm安装pnpm
    npm install -g pnpm
    
    # 验证安装
    if command -v pnpm &> /dev/null; then
        log_success "pnpm安装成功"
    else
        log_error "pnpm安装失败"
        exit 1
    fi
}

# 创建环境配置文件
create_env_files() {
    log_info "创建环境配置文件..."
    
    # 创建.env.example
    cat > "$PROJECT_ROOT/.env.example" << 'EOF'
# BioRxiv日报 - 环境变量配置示例
# 复制此文件为 .env.local (开发) 或 .env.production (生产)

# =============================================
# Supabase配置
# =============================================
# 获取地址: https://supabase.com/dashboard/project/[your-project]/settings/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# =============================================
# 应用配置
# =============================================
VITE_APP_NAME=BioRxiv日报
VITE_APP_URL=http://localhost:5173
VITE_ADMIN_EMAIL=admin@biorxiv-daily.com

# =============================================
# 开发配置
# =============================================
VITE_DEV_MODE=true
VITE_DEBUG=true

# =============================================
# AI分析配置 (可选)
# =============================================
# OpenAI配置
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_OPENAI_MODEL=gpt-3.5-turbo

# Anthropic配置
VITE_ANTHROPIC_API_KEY=your-anthropic-api-key
VITE_ANTHROPIC_MODEL=claude-3-sonnet-20240229

# =============================================
# 监控配置 (可选)
# =============================================
# Sentry错误监控
VITE_SENTRY_DSN=your-sentry-dsn

# Google Analytics
VITE_GA_TRACKING_ID=G-XXXXXXXXXX

# =============================================
# 部署配置
# =============================================
# 生产环境URL
VITE_APP_URL=https://your-domain.com

# CDN URL (如果使用)
VITE_CDN_URL=https://cdn.your-domain.com
EOF

    # 创建.env.local (开发环境)
    cat > "$PROJECT_ROOT/.env.local" << 'EOF'
# 开发环境配置
# 此文件不会被Git跟踪

# Supabase配置 (开发环境)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# 应用配置
VITE_APP_NAME=BioRxiv日报 (开发版)
VITE_APP_URL=http://localhost:5173
VITE_ADMIN_EMAIL=admin@localhost

# 开发配置
VITE_DEV_MODE=true
VITE_DEBUG=true

# 模拟API延迟
VITE_MOCK_API_DELAY=500

# 热重载
VITE_HMR_PORT=24678
EOF

    # 创建.env.production (生产环境)
    cat > "$PROJECT_ROOT/.env.production" << 'EOF'
# 生产环境配置
# 此文件不会被Git跟踪

# Supabase配置 (生产环境)
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# 应用配置
VITE_APP_NAME=BioRxiv日报
VITE_APP_URL=https://your-domain.com
VITE_ADMIN_EMAIL=admin@biorxiv-daily.com

# 生产配置
VITE_DEV_MODE=false
VITE_DEBUG=false

# 性能优化
VITE_COMPRESSION=gzip
VITE_MINIFY_JS=true
VITE_MINIFY_CSS=true

# 监控
VITE_SENTRY_DSN=your-production-sentry-dsn
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
EOF

    log_success "环境配置文件创建完成"
}

# 安装项目依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    if [ -f "package.json" ]; then
        pnpm install
        
        if [ $? -eq 0 ]; then
            log_success "依赖安装完成"
        else
            log_error "依赖安装失败"
            exit 1
        fi
    else
        log_error "package.json文件不存在"
        exit 1
    fi
}

# 设置Git配置
setup_git() {
    log_info "设置Git配置..."
    
    # 检查是否在Git仓库中
    if [ ! -d ".git" ]; then
        log_info "初始化Git仓库..."
        git init
        
        # 创建.gitignore
        cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
EOF

        log_success "Git仓库初始化完成"
    fi
    
    # 配置Git (如果未配置)
    if [ -z "$(git config user.name)" ]; then
        read -p "请输入您的姓名: " git_name
        git config user.name "$git_name"
    fi
    
    if [ -z "$(git config user.email)" ]; then
        read -p "请输入您的邮箱: " git_email
        git config user.email "$git_email"
    fi
    
    log_success "Git配置完成"
}

# 创建开发脚本
create_scripts() {
    log_info "创建开发脚本..."
    
    # 创建package.json scripts (如果不存在)
    if [ -f "biorxiv-final/package.json" ]; then
        cd "$PROJECT_ROOT/biorxiv-final"
        
        # 检查是否已有脚本
        if ! grep -q '"dev"' package.json; then
            log_info "添加开发脚本到package.json..."
            
            # 备份原文件
            cp package.json package.json.backup
            
            # 使用jq添加脚本 (如果可用)
            if command -v jq &> /dev/null; then
                jq '.scripts.dev = "vite"' package.json > temp.json && mv temp.json package.json
                jq '.scripts.build = "tsc -b && vite build"' package.json > temp.json && mv temp.json package.json
                jq '.scripts.preview = "vite preview"' package.json > temp.json && mv temp.json package.json
                jq '.scripts.lint = "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"' package.json > temp.json && mv temp.json package.json
                jq '.scripts.type-check = "tsc --noEmit"' package.json > temp.json && mv temp.json package.json
            else
                log_warning "jq未安装，请手动添加脚本到package.json"
            fi
            
            log_success "开发脚本添加完成"
        fi
    fi
    
    # 创建便捷脚本
    mkdir -p "$PROJECT_ROOT/scripts"
    
    # 开发启动脚本
    cat > "$PROJECT_ROOT/scripts/dev.sh" << 'EOF'
#!/bin/bash
# 开发环境启动脚本

cd "$(dirname "$0")/../biorxiv-final"
pnpm dev
EOF

    # 构建脚本
    cat > "$PROJECT_ROOT/scripts/build.sh" << 'EOF'
#!/bin/bash
# 构建脚本

set -e

echo "开始构建BioRxiv日报..."

cd "$(dirname "$0")/../biorxiv-final"

# 安装依赖
echo "安装依赖..."
pnpm install

# 类型检查
echo "执行类型检查..."
pnpm run type-check

# 代码规范检查
echo "执行代码规范检查..."
pnpm run lint

# 构建应用
echo "构建应用..."
pnpm run build

echo "构建完成！"
echo "构建文件位于: $(pwd)/dist"
EOF

    # 测试脚本
    cat > "$PROJECT_ROOT/scripts/test.sh" << 'EOF'
#!/bin/bash
# 测试脚本

set -e

echo "开始运行测试..."

cd "$(dirname "$0")/../biorxiv-final"

# 安装依赖
echo "安装依赖..."
pnpm install

# 类型检查
echo "执行类型检查..."
pnpm run type-check

# 代码规范检查
echo "执行代码规范检查..."
pnpm run lint

# 运行单元测试
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    echo "运行单元测试..."
    pnpm run test --coverage --watchAll=false
else
    echo "未找到测试配置"
fi

echo "测试完成！"
EOF

    # 给脚本添加执行权限
    chmod +x "$PROJECT_ROOT/scripts"/*.sh
    
    log_success "开发脚本创建完成"
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 检查必要文件
    local required_files=(
        "package.json"
        "vite.config.ts"
        "tsconfig.json"
        "tailwind.config.js"
        "src/main.tsx"
        "src/App.tsx"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "缺少必要文件: $file"
            return 1
        fi
    done
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules目录不存在，请运行: pnpm install"
        return 1
    fi
    
    # 检查TypeScript配置
    if ! npx tsc --noEmit &> /dev/null; then
        log_warning "TypeScript类型检查失败"
        return 1
    fi
    
    log_success "安装验证完成"
}

# 显示后续步骤
show_next_steps() {
    echo ""
    echo "=============================================="
    echo "🎉 BioRxiv日报环境设置完成！"
    echo "=============================================="
    echo ""
    echo "接下来的步骤："
    echo ""
    echo "1. 配置Supabase:"
    echo "   - 访问 https://supabase.com"
    echo "   - 创建新项目"
    echo "   - 获取项目URL和API密钥"
    echo "   - 编辑 .env.local 文件"
    echo ""
    echo "2. 设置数据库:"
    echo "   - 在Supabase控制台中执行 database/schema_complete.sql"
    echo "   - 或参考 supabase/SETUP_GUIDE.md"
    echo ""
    echo "3. 启动开发服务器:"
    echo "   pnpm dev"
    echo "   或"
    echo "   ./scripts/dev.sh"
    echo ""
    echo "4. 访问应用:"
    echo "   - 前端: http://localhost:5173"
    echo "   - 管理后台: http://localhost:5173/admin"
    echo ""
    echo "5. 查看文档:"
    echo "   - README.md - 项目概述"
    echo "   - docs/DEPLOYMENT_GUIDE.md - 部署指南"
    echo "   - docs/DEVELOPMENT_GUIDE.md - 开发指南"
    echo ""
    echo "常用命令："
    echo "  pnpm dev          - 启动开发服务器"
    echo "  pnpm build        - 构建生产版本"
    echo "  pnpm preview      - 预览构建结果"
    echo "  pnpm lint         - 代码规范检查"
    echo "  pnpm type-check   - TypeScript类型检查"
    echo ""
    echo "脚本："
    echo "  ./scripts/dev.sh      - 启动开发服务器"
    echo "  ./scripts/build.sh    - 构建应用"
    echo "  ./scripts/test.sh     - 运行测试"
    echo "  ./scripts/deploy.sh   - 部署应用"
    echo ""
    echo "=============================================="
}

# 主函数
main() {
    log_info "开始BioRxiv日报环境设置..."
    
    # 检查是否在正确的目录
    if [ ! -f "$PROJECT_ROOT/README.md" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    check_os
    check_software
    
    # 安装Node.js (如果需要)
    if ! install_nodejs; then
        log_error "Node.js安装失败"
        exit 1
    fi
    
    install_pnpm
    create_env_files
    install_dependencies
    setup_git
    create_scripts
    
    # 验证安装
    if verify_installation; then
        log_success "环境设置完成！"
        show_next_steps
    else
        log_warning "环境设置部分完成，请检查上述错误"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
BioRxiv日报环境设置脚本

用法:
    $0 [选项]

选项:
    --help, -h          显示帮助信息
    --skip-deps         跳过依赖安装
    --no-git            跳过Git配置
    --verify-only       仅验证安装

示例:
    $0                  # 完整设置
    $0 --skip-deps      # 跳过依赖安装
    $0 --verify-only    # 仅验证安装

EOF
}

# 解析命令行参数
SKIP_DEPS=false
SKIP_GIT=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --no-git)
            SKIP_GIT=true
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 执行主函数
if [ "$VERIFY_ONLY" = true ]; then
    log_info "验证安装..."
    verify_installation
else
    main
fi
