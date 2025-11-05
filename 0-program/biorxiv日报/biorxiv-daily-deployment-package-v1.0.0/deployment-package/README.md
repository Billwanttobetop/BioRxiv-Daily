# BioRxiv日报 - 完整部署包

## 项目简介

BioRxiv日报是一个基于React + TypeScript + Supabase的现代化学术论文聚合和分析平台。该项目提供了论文浏览、收藏、AI分析、用户管理等完整功能。

### 核心功能

- 📚 **论文聚合**: 自动从BioRxiv获取最新论文
- 🔍 **智能搜索**: 支持标题、作者、摘要全文搜索
- 🤖 **AI分析**: 批量AI翻译和分析论文内容
- ⭐ **收藏管理**: 用户可收藏和管理感兴趣的论文
- 👥 **用户系统**: 完整的用户注册、登录、资料管理
- 📊 **管理后台**: 管理员可管理站点设置、用户、API配置
- 📱 **响应式设计**: 完美适配桌面端和移动端

### 技术栈

- **前端**: React 18 + TypeScript + Vite
- **UI组件**: Radix UI + Tailwind CSS
- **路由**: React Router DOM
- **状态管理**: React Context + Hooks
- **后端**: Supabase (数据库 + 认证 + Edge Functions)
- **构建工具**: Vite + pnpm
- **代码质量**: ESLint + TypeScript

## 快速开始

### 前置要求

- Node.js 18+ 
- pnpm 8+
- Supabase账号
- Git

### 一键部署

1. **克隆项目**
   ```bash
   git clone <your-repo-url>
   cd biorxiv-daily
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local 文件，填入您的Supabase配置
   ```

4. **设置Supabase**
   - 按照 [supabase/SETUP_GUIDE.md](./supabase/SETUP_GUIDE.md) 指南设置数据库
   - 执行 `database/schema_complete.sql` 创建数据库结构
   - 部署Edge Functions

5. **启动开发服务器**
   ```bash
   pnpm dev
   ```

6. **访问应用**
   - 前端: http://localhost:5173
   - 管理后台: http://localhost:5173/admin

## 详细文档

### 📖 部署指南

- **[完整部署指南](./docs/DEPLOYMENT_GUIDE.md)** - 生产环境部署详细步骤
- **[Supabase设置指南](./supabase/SETUP_GUIDE.md)** - 后端服务配置教程
- **[本地开发指南](./docs/DEVELOPMENT_GUIDE.md)** - 开发环境搭建和调试

### 🔧 配置说明

- **[环境变量配置](./docs/ENVIRONMENT_VARIABLES.md)** - 所有配置项详细说明
- **[数据库架构](./database/schema_complete.sql)** - 完整数据库结构
- **[API文档](./docs/API_DOCUMENTATION.md)** - 后端API接口说明

### 🛠️ 开发指南

- **[项目结构](./docs/PROJECT_STRUCTURE.md)** - 代码组织和架构说明
- **[组件开发](./docs/COMPONENT_GUIDE.md)** - React组件开发规范
- **[样式指南](./docs/STYLING_GUIDE.md)** - Tailwind CSS使用规范

## 项目结构

```
deployment-package/
├── README.md                    # 项目说明文档
├── docs/                        # 文档目录
│   ├── DEPLOYMENT_GUIDE.md     # 部署指南
│   ├── DEVELOPMENT_GUIDE.md    # 开发指南
│   ├── ENVIRONMENT_VARIABLES.md # 环境变量说明
│   ├── API_DOCUMENTATION.md    # API文档
│   ├── PROJECT_STRUCTURE.md    # 项目结构
│   ├── COMPONENT_GUIDE.md      # 组件开发指南
│   └── STYLING_GUIDE.md        # 样式指南
├── biorxiv-final/              # 前端源码
│   ├── src/                    # 源代码
│   ├── public/                 # 静态资源
│   ├── package.json            # 依赖配置
│   └── ...                     # 其他配置文件
├── supabase/                   # Supabase配置
│   ├── functions/              # Edge Functions
│   └── migrations/             # 数据库迁移
├── database/                   # 数据库相关
│   └── schema_complete.sql     # 完整数据库架构
├── scripts/                    # 部署脚本
│   ├── deploy.sh              # 部署脚本
│   └── setup.sh               # 环境设置脚本
└── config/                     # 配置文件
    ├── nginx.conf              # Nginx配置
    ├── docker-compose.yml      # Docker配置
    └── pm2.config.js           # PM2进程管理配置
```

## 主要功能模块

### 1. 用户认证系统
- 邮箱注册/登录
- 密码重置
- 用户资料管理
- 管理员权限控制

### 2. 论文管理系统
- 论文数据存储和检索
- 全文搜索功能
- 标签分类系统
- 收藏和集合管理

### 3. AI分析功能
- 批量论文翻译
- 智能摘要生成
- 关键信息提取
- 分析结果存储

### 4. 管理后台
- 站点设置管理
- 用户管理
- API配置管理
- 系统监控和日志

### 5. 响应式界面
- 现代化UI设计
- 移动端适配
- 暗色模式支持
- 无障碍访问

## 部署选项

### 选项1: 静态部署 (推荐)
- 适合: 个人项目、小型团队
- 平台: Vercel、Netlify、GitHub Pages
- 成本: 免费 - 低成本

### 选项2: VPS部署
- 适合: 中型项目、企业使用
- 平台: 阿里云、腾讯云、AWS
- 成本: 中等成本

### 选项3: 容器化部署
- 适合: 大型项目、微服务架构
- 平台: Docker + Kubernetes
- 成本: 高成本，高可扩展性

## 性能优化

- **代码分割**: React.lazy() 实现路由级别的代码分割
- **图片优化**: WebP格式、懒加载、响应式图片
- **缓存策略**: 浏览器缓存、CDN缓存、数据库查询缓存
- **数据库优化**: 索引优化、查询优化、连接池配置
- **CDN加速**: 静态资源CDN分发

## 安全特性

- **认证安全**: JWT token、密码加密、会话管理
- **数据安全**: RLS策略、SQL注入防护、XSS防护
- **API安全**: 速率限制、请求验证、错误处理
- **传输安全**: HTTPS强制、SSL/TLS加密

## 监控和运维

- **应用监控**: 性能指标、错误追踪、用户行为分析
- **日志管理**: 结构化日志、日志聚合、告警通知
- **备份策略**: 数据库备份、文件备份、配置备份
- **灾备方案**: 故障转移、数据恢复、服务降级

## 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建Pull Request

### 代码规范
- 使用TypeScript严格模式
- 遵循ESLint规则
- 编写单元测试
- 完善文档注释

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- **项目主页**: https://github.com/your-username/biorxiv-daily
- **问题反馈**: https://github.com/your-username/biorxiv-daily/issues
- **邮箱联系**: contact@biorxiv-daily.com

## 更新日志

### v1.0.0 (2025-11-04)
- ✨ 初始版本发布
- 📚 完整的论文聚合功能
- 🤖 AI批量分析功能
- 👥 用户认证和管理系统
- 📊 管理后台界面
- 📱 响应式设计
- 🔒 完整的安全策略

---

**开始使用**: 按照 [部署指南](./docs/DEPLOYMENT_GUIDE.md) 开始部署您的BioRxiv日报平台！
