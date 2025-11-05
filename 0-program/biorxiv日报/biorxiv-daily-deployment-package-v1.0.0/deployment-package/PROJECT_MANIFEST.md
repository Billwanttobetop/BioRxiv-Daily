# BioRxiv日报 - 项目文件清单

## 部署包信息
- **项目名称**: BioRxiv日报 - 批量AI分析版
- **版本**: v1.0.0
- **创建时间**: 2025-11-04
- **包大小**: 约 50MB (压缩后)

## 文件结构

### 📁 根目录文件
- `README.md` - 项目概述和快速开始指南
- `LICENSE` - 开源许可证
- `Dockerfile` - Docker容器构建文件
- `.env.example` - 环境变量配置模板

### 📁 文档目录 (`docs/`)
- `DEPLOYMENT_GUIDE.md` - 完整部署指南
- `DEVELOPMENT_GUIDE.md` - 开发环境搭建指南
- `ENVIRONMENT_VARIABLES.md` - 环境变量配置说明
- `API_DOCUMENTATION.md` - API接口文档
- `PROJECT_STRUCTURE.md` - 项目架构说明
- `COMPONENT_GUIDE.md` - 组件开发规范
- `STYLING_GUIDE.md` - 样式开发指南

### 📁 前端源码 (`biorxiv-final/`)
- `src/` - 源代码目录
  - `components/` - React组件
  - `pages/` - 页面组件
  - `hooks/` - 自定义Hooks
  - `contexts/` - React Context
  - `lib/` - 工具库和配置
  - `types/` - TypeScript类型定义
- `public/` - 静态资源
- `package.json` - 项目依赖配置
- `vite.config.ts` - Vite构建配置
- `tailwind.config.js` - Tailwind CSS配置
- `tsconfig.json` - TypeScript配置
- `eslint.config.js` - ESLint配置

### 📁 Supabase配置 (`supabase/`)
- `functions/` - Edge Functions
  - `create-admin-user/` - 管理员用户创建函数
- `migrations/` - 数据库迁移文件
  - `1762139503_create_site_settings_table.sql`
  - `1762140000_create_get_untranslated_papers_function.sql`
- `SETUP_GUIDE.md` - Supabase设置指南

### 📁 数据库脚本 (`database/`)
- `schema_complete.sql` - 完整数据库架构

### 📁 部署脚本 (`scripts/`)
- `deploy.sh` - 自动化部署脚本
- `setup.sh` - 环境设置脚本

### 📁 配置文件 (`config/`)
- `nginx.conf` - Nginx服务器配置
- `docker-compose.yml` - Docker Compose配置
- `pm2.config.js` - PM2进程管理配置

## 核心功能模块

### 1. 用户认证系统
- ✅ 邮箱注册/登录
- ✅ 密码重置
- ✅ 用户资料管理
- ✅ 管理员权限控制

### 2. 论文管理系统
- ✅ 论文数据存储和检索
- ✅ 全文搜索功能
- ✅ 标签分类系统
- ✅ 收藏和集合管理

### 3. AI分析功能
- ✅ 批量论文翻译
- ✅ 智能摘要生成
- ✅ 关键信息提取
- ✅ 分析结果存储

### 4. 管理后台
- ✅ 站点设置管理
- ✅ 用户管理
- ✅ API配置管理
- ✅ 系统监控和日志

### 5. 响应式界面
- ✅ 现代化UI设计
- ✅ 移动端适配
- ✅ 暗色模式支持
- ✅ 无障碍访问

## 技术栈

### 前端技术
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Radix UI
- **样式**: Tailwind CSS
- **路由**: React Router DOM
- **状态管理**: React Context + Hooks

### 后端技术
- **数据库**: PostgreSQL (Supabase)
- **认证**: Supabase Auth
- **API**: Supabase Edge Functions
- **存储**: Supabase Storage
- **实时功能**: Supabase Realtime

### 部署技术
- **容器化**: Docker + Docker Compose
- **Web服务器**: Nginx
- **进程管理**: PM2
- **监控**: Prometheus + Grafana
- **缓存**: Redis

## 部署选项

### 1. 静态部署 (推荐)
- **平台**: Vercel, Netlify, GitHub Pages
- **优势**: 简单快速, 低成本, 自动SSL
- **适用**: 个人项目, 原型展示

### 2. VPS部署
- **平台**: 阿里云, 腾讯云, AWS
- **优势**: 完全控制, 可定制配置
- **适用**: 中型项目, 企业使用

### 3. 容器化部署
- **平台**: Docker + Kubernetes
- **优势**: 可扩展, 微服务架构
- **适用**: 大型项目, 企业级

## 快速开始

### 1. 环境准备
```bash
# 检查系统要求
Node.js 18+
pnpm 8+
Git
```

### 2. 一键设置
```bash
# 运行环境设置脚本
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 3. 配置Supabase
```bash
# 编辑环境变量文件
cp .env.example .env.local
# 填入您的Supabase配置信息
```

### 4. 启动开发
```bash
# 启动开发服务器
cd biorxiv-final
pnpm dev
```

### 5. 访问应用
- 前端: http://localhost:5173
- 管理后台: http://localhost:5173/admin

## 部署到生产

### 使用部署脚本
```bash
# 生产环境部署
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# Vercel部署
./scripts/deploy.sh production --vercel

# Docker部署
docker-compose -f config/docker-compose.yml up -d
```

### 手动部署
```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production

# 3. 构建应用
pnpm build

# 4. 部署到服务器
# 复制 dist/ 目录到Web服务器
```

## 监控和维护

### 健康检查
- 应用状态: `/health`
- API状态: `/api/health`
- 数据库连接状态

### 日志管理
- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`
- 访问日志: `logs/access.log`

### 性能监控
- 响应时间监控
- 内存使用监控
- 数据库查询性能
- 用户访问统计

### 备份策略
- 数据库自动备份
- 文件上传备份
- 配置文件备份
- 代码版本控制

## 安全特性

### 应用安全
- JWT token认证
- 密码加密存储
- SQL注入防护
- XSS攻击防护

### 传输安全
- HTTPS强制
- SSL/TLS加密
- 安全头配置
- CORS策略

### 数据安全
- 行级安全策略 (RLS)
- API访问控制
- 敏感信息加密
- 审计日志记录

## 支持和联系

### 文档资源
- [项目文档](docs/)
- [API文档](docs/API_DOCUMENTATION.md)
- [部署指南](docs/DEPLOYMENT_GUIDE.md)
- [开发指南](docs/DEVELOPMENT_GUIDE.md)

### 技术支持
- 问题反馈: GitHub Issues
- 技术讨论: GitHub Discussions
- 邮件联系: contact@biorxiv-daily.com

### 社区贡献
- 欢迎提交Issue和Pull Request
- 代码规范: ESLint + Prettier
- 测试要求: 单元测试 + 集成测试

---

**最后更新**: 2025-11-04
**维护团队**: BioRxiv日报开发团队
**许可证**: MIT License
