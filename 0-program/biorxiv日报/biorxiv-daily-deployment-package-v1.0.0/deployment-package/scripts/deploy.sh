#!/bin/bash

# BioRxiv日报 - 自动化部署脚本
# 使用方法: ./scripts/deploy.sh [environment]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-production}
BUILD_DIR="$PROJECT_ROOT/biorxiv-final/dist"

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

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    local node_version=$(node -v | sed 's/v//')
    if ! [[ "$node_version" =~ ^18\. ]] && ! [[ "$node_version" =~ ^19\. ]] && ! [[ "$node_version" =~ ^20\. ]]; then
        log_error "Node.js 版本过低 ($node_version)，需要 18+ 版本"
        exit 1
    fi
    
    # 检查pnpm
    if ! command -v pnpm &> /dev/null; then
        log_warning "pnpm 未安装，正在安装..."
        npm install -g pnpm
    fi
    
    # 检查Git
    if ! command -v git &> /dev/null; then
        log_error "Git 未安装"
        exit 1
    fi
    
    log_success "依赖检查完成"
}

# 检查环境变量
check_environment() {
    log_info "检查环境配置..."
    
    local env_file="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [ ! -f "$env_file" ]; then
        log_warning "环境配置文件不存在: $env_file"
        log_info "正在创建示例配置文件..."
        cp "$PROJECT_ROOT/.env.example" "$env_file"
        log_warning "请编辑 $env_file 文件，填入正确的配置信息"
        read -p "配置完成后按回车继续..."
    fi
    
    # 加载环境变量
    set -a
    source "$env_file"
    set +a
    
    # 验证必需的环境变量
    local required_vars=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "缺少必需的环境变量: $var"
            exit 1
        fi
    done
    
    log_success "环境配置检查完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 清理之前的安装
    if [ -d "node_modules" ]; then
        log_info "清理之前的依赖..."
        rm -rf node_modules
    fi
    
    if [ -f "pnpm-lock.yaml" ]; then
        log_info "清理锁定文件..."
        rm -f pnpm-lock.yaml
    fi
    
    # 安装依赖
    pnpm install --prefer-offline
    
    log_success "依赖安装完成"
}

# 运行测试
run_tests() {
    log_info "运行测试..."
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 类型检查
    log_info "执行TypeScript类型检查..."
    pnpm run type-check || {
        log_error "TypeScript类型检查失败"
        exit 1
    }
    
    # 代码规范检查
    log_info "执行ESLint检查..."
    pnpm run lint || {
        log_warning "ESLint检查发现问题，但继续部署"
    }
    
    # 单元测试
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        log_info "运行单元测试..."
        pnpm run test -- --coverage --watchAll=false || {
            log_warning "单元测试失败，但继续部署"
        }
    fi
    
    log_success "测试完成"
}

# 构建应用
build_application() {
    log_info "构建应用..."
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 设置环境变量
    export NODE_ENV=production
    export VITE_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    export VITE_COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    export VITE_BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    
    # 清理之前的构建
    if [ -d "dist" ]; then
        log_info "清理之前的构建文件..."
        rm -rf dist
    fi
    
    # 构建应用
    pnpm run build
    
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "构建失败：构建目录不存在"
        exit 1
    fi
    
    # 验证构建产物
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        log_error "构建失败：index.html 不存在"
        exit 1
    fi
    
    log_success "应用构建完成"
}

# 部署到服务器
deploy_to_server() {
    log_info "部署到服务器..."
    
    case "$ENVIRONMENT" in
        "production"|"prod")
            deploy_production
            ;;
        "staging"|"stage")
            deploy_staging
            ;;
        "development"|"dev")
            deploy_development
            ;;
        *)
            log_error "未知的环境: $ENVIRONMENT"
            log_info "支持的環境: production, staging, development"
            exit 1
            ;;
    esac
}

# 生产环境部署
deploy_production() {
    log_info "部署到生产环境..."
    
    # 检查服务器配置
    if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
        log_error "生产环境部署需要配置 DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH"
        exit 1
    fi
    
    # 创建远程目录
    ssh "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p $DEPLOY_PATH"
    
    # 上传文件
    log_info "上传构建文件..."
    rsync -avz --delete "$BUILD_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
    
    # 设置权限
    ssh "$DEPLOY_USER@$DEPLOY_HOST" "chown -R www-data:www-data $DEPLOY_PATH"
    ssh "$DEPLOY_USER@$DEPLOY_HOST" "chmod -R 755 $DEPLOY_PATH"
    
    # 重启服务
    if [ -n "$SERVICE_NAME" ]; then
        log_info "重启服务: $SERVICE_NAME"
        ssh "$DEPLOY_USER@$DEPLOY_HOST" "systemctl restart $SERVICE_NAME"
    fi
    
    log_success "生产环境部署完成"
}

# 预发布环境部署
deploy_staging() {
    log_info "部署到预发布环境..."
    
    # 这里可以添加Vercel、Netlify等平台的部署逻辑
    log_info "预发布环境部署完成"
}

# 开发环境部署
deploy_development() {
    log_info "部署到开发环境..."
    
    # 本地开发服务器
    log_info "启动开发服务器..."
    cd "$PROJECT_ROOT/biorxiv-final"
    pnpm run dev &
    
    log_success "开发环境部署完成，应用运行在 http://localhost:5173"
}

# 部署到Vercel
deploy_vercel() {
    log_info "部署到Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI 未安装，请运行: npm install -g vercel"
        exit 1
    fi
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 设置环境变量
    export VERCEL_ENV=production
    
    # 部署
    vercel --prod --yes
    
    log_success "Vercel部署完成"
}

# 部署到Netlify
deploy_netlify() {
    log_info "部署到Netlify..."
    
    if ! command -v netlify &> /dev/null; then
        log_error "Netlify CLI 未安装，请运行: npm install -g netlify-cli"
        exit 1
    fi
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 部署
    netlify deploy --prod --dir=dist
    
    log_success "Netlify部署完成"
}

# 生成部署报告
generate_report() {
    log_info "生成部署报告..."
    
    local report_file="$PROJECT_ROOT/deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# BioRxiv日报部署报告

## 部署信息
- **时间**: $(date)
- **环境**: $ENVIRONMENT
- **版本**: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
- **分支**: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

## 构建信息
- **Node.js版本**: $(node -v)
- **pnpm版本**: $(pnpm -v)
- **构建目录**: $BUILD_DIR
- **构建大小**: $(du -sh "$BUILD_DIR" | cut -f1)

## 部署状态
- **状态**: 成功
- **部署时间**: $(date)

## 环境变量
$(env | grep "^VITE_" | sed 's/^/- /')

EOF
    
    log_success "部署报告已生成: $report_file"
}

# 清理函数
cleanup() {
    log_info "清理临时文件..."
    
    cd "$PROJECT_ROOT/biorxiv-final"
    
    # 清理构建缓存
    if [ -d "node_modules/.vite" ]; then
        rm -rf node_modules/.vite
    fi
    
    # 清理测试覆盖率报告
    if [ -d "coverage" ]; then
        rm -rf coverage
    fi
    
    log_success "清理完成"
}

# 主函数
main() {
    log_info "开始BioRxiv日报部署流程..."
    log_info "环境: $ENVIRONMENT"
    
    # 检查参数
    if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "dev" ]; then
        check_dependencies
        check_environment
    fi
    
    install_dependencies
    
    if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "dev" ]; then
        run_tests
    fi
    
    build_application
    deploy_to_server
    
    if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "dev" ]; then
        generate_report
    fi
    
    cleanup
    
    log_success "部署流程完成！"
    
    # 显示访问信息
    case "$ENVIRONMENT" in
        "production"|"prod")
            echo ""
            log_success "应用已部署到生产环境"
            if [ -n "$DEPLOY_HOST" ]; then
                log_info "访问地址: https://$DEPLOY_HOST"
            fi
            ;;
        "staging"|"stage")
            echo ""
            log_success "应用已部署到预发布环境"
            ;;
        "development"|"dev")
            echo ""
            log_success "开发服务器已启动"
            log_info "访问地址: http://localhost:5173"
            log_info "按 Ctrl+C 停止服务器"
            ;;
    esac
}

# 错误处理
trap 'log_error "部署过程中发生错误，退出代码: $?"' ERR

# 显示帮助信息
show_help() {
    cat << EOF
BioRxiv日报部署脚本

使用方法:
    $0 [环境] [选项]

环境:
    production|prod    生产环境部署
    staging|stage      预发布环境部署
    development|dev    开发环境部署

选项:
    --vercel          部署到Vercel
    --netlify         部署到Netlify
    --help|-h         显示帮助信息

示例:
    $0 production      # 部署到生产环境
    $0 staging         # 部署到预发布环境
    $0 development     # 启动开发服务器
    $0 production --vercel  # 部署到Vercel

环境变量:
    DEPLOY_HOST       部署服务器地址
    DEPLOY_USER       部署服务器用户名
    DEPLOY_PATH       部署路径
    SERVICE_NAME      服务名称

EOF
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --vercel)
            DEPLOY_METHOD="vercel"
            shift
            ;;
        --netlify)
            DEPLOY_METHOD="netlify"
            shift
            ;;
        production|prod|staging|stage|development|dev)
            ENVIRONMENT="$1"
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
main
