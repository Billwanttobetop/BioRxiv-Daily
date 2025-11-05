# BioRxiv日报 - 环境变量配置

## 概述

环境变量是配置BioRxiv日报应用的关键方式，用于管理不同环境下的配置信息，如API密钥、数据库连接、第三方服务配置等。

## 环境变量文件

### 文件命名规范

- `.env.local` - 本地开发环境（不会被Git跟踪）
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env.example` - 环境变量模板（示例配置）

### 文件优先级

1. `.env.local` (最高优先级)
2. `.env.development`
3. `.env.production`
4. `.env` (通用配置)
5. `.env.example` (仅用于参考)

## 核心配置变量

### Supabase配置

```env
# Supabase项目URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase匿名密钥（公开密钥）
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase服务角色密钥（仅在服务端使用）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 数据库连接字符串（可选，用于服务端操作）
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
```

### 应用基础配置

```env
# 应用名称
VITE_APP_NAME=BioRxiv日报

# 应用版本
VITE_APP_VERSION=1.0.0

# 应用描述
VITE_APP_DESCRIPTION=学术论文聚合和分析平台

# 应用URL（用于邮件链接等）
VITE_APP_URL=http://localhost:5173

# 管理员邮箱
VITE_ADMIN_EMAIL=admin@biorxiv-daily.com
```

### 开发环境配置

```env
# 开发模式标识
VITE_DEV_MODE=true

# 开发服务器端口
VITE_DEV_PORT=5173

# 开发服务器主机
VITE_DEV_HOST=localhost

# 热重载
VITE_HMR_PORT=24678

# 调试模式
VITE_DEBUG=true
```

### 生产环境配置

```env
# 生产模式标识
VITE_DEV_MODE=false

# 生产环境URL
VITE_APP_URL=https://your-domain.com

# CDN URL（如果使用CDN）
VITE_CDN_URL=https://cdn.your-domain.com

# 静态资源版本
VITE_ASSET_VERSION=1.0.0

# 压缩模式
VITE_COMPRESSION=gzip
```

## 功能模块配置

### AI分析配置

```env
# OpenAI API配置
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_MODEL=gpt-3.5-turbo
VITE_OPENAI_MAX_TOKENS=2000
VITE_OPENAI_TEMPERATURE=0.7

# Anthropic Claude API配置
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_ANTHROPIC_MODEL=claude-3-sonnet-20240229
VITE_ANTHROPIC_MAX_TOKENS=2000

# AI分析配置
VITE_AI_BATCH_SIZE=10
VITE_AI_CONCURRENT_REQUESTS=3
VITE_AI_REQUEST_TIMEOUT=30000
VITE_AI_RETRY_ATTEMPTS=3
```

### 搜索配置

```env
# 搜索配置
VITE_SEARCH_ENABLED=true
VITE_SEARCH_MIN_LENGTH=2
VITE_SEARCH_MAX_RESULTS=100
VITE_SEARCH_DEBOUNCE_MS=300

# 全文搜索配置
VITE_FULLTEXT_SEARCH=true
VITE_SEARCH_INDEX_NAME=papers_search

# 搜索结果排序
VITE_SEARCH_SORT_BY=published_date
VITE_SEARCH_SORT_ORDER=desc
```

### 缓存配置

```env
# 缓存配置
VITE_CACHE_ENABLED=true
VITE_CACHE_TTL=3600
VITE_CACHE_MAX_SIZE=100

# Redis配置（如果使用）
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# 浏览器缓存
VITE_BROWSER_CACHE_TTL=86400
VITE_SERVICE_WORKER_CACHE=true
```

### 监控和分析配置

```env
# Sentry错误监控
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1

# Google Analytics
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
VITE_GA_DEBUG=false

# 自定义分析
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_ENDPOINT=https://analytics.your-domain.com
```

### 安全配置

```env
# JWT配置
VITE_JWT_SECRET=your-super-secret-jwt-key
VITE_JWT_EXPIRES_IN=7d

# 加密配置
VITE_ENCRYPTION_KEY=your-32-character-encryption-key
VITE_ENCRYPTION_IV=your-16-character-iv

# CORS配置
VITE_CORS_ORIGINS=http://localhost:5173,https://your-domain.com
VITE_CORS_CREDENTIALS=true

# 安全头配置
VITE_CSP_ENABLED=true
VITE_HSTS_ENABLED=true
```

### 邮件配置

```env
# SMTP配置
VITE_SMTP_HOST=smtp.gmail.com
VITE_SMTP_PORT=587
VITE_SMTP_USER=your-email@gmail.com
VITE_SMTP_PASS=your-app-password
VITE_SMTP_SECURE=false

# 邮件模板配置
VITE_EMAIL_FROM=noreply@biorxiv-daily.com
VITE_EMAIL_FROM_NAME=BioRxiv日报

# 邮件验证配置
VITE_EMAIL_VERIFICATION_REQUIRED=true
VITE_EMAIL_VERIFICATION_URL=http://localhost:5173/auth/verify
```

### 文件上传配置

```env
# 文件上传配置
VITE_UPLOAD_ENABLED=true
VITE_UPLOAD_MAX_SIZE=10485760
VITE_UPLOAD_ALLOWED_TYPES=pdf,doc,docx,txt

# Supabase存储配置
VITE_SUPABASE_STORAGE_BUCKET=papers
VITE_SUPABASE_STORAGE_PUBLIC=true

# 图片处理配置
VITE_IMAGE_MAX_WIDTH=1920
VITE_IMAGE_MAX_HEIGHT=1080
VITE_IMAGE_QUALITY=85
VITE_IMAGE_FORMAT=webp
```

### 性能配置

```env
# 性能监控
VITE_PERFORMANCE_MONITORING=true
VITE_WEB_VITALS_REPORTING_ENDPOINT=https://vitals.your-domain.com

# 代码分割配置
VITE_CODE_SPLITTING=true
VITE_LAZY_LOADING=true
VITE_PREFETCH_ENABLED=true

# 资源优化
VITE_MINIFY_JS=true
VITE_MINIFY_CSS=true
VITE_TREE_SHAKING=true
```

### 第三方服务配置

```env
# BioRxiv API配置
VITE_BIORXIV_API_URL=https://api.biorxiv.org
VITE_BIORXIV_API_KEY=your-biorxiv-api-key
VITE_BIORXIV_UPDATE_INTERVAL=3600000

# CrossRef API配置
VITE_CROSSREF_API_URL=https://api.crossref.org
VITE_CROSSREF_API_KEY=your-crossref-api-key

# DOI解析配置
VITE_DOI_RESOLVER=https://doi.org
VITE_DOI_CACHE_TTL=86400
```

## 数据库配置

### 连接配置

```env
# 数据库连接池配置
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000

# 查询配置
DB_QUERY_TIMEOUT=30000
DB_QUERY_RETRIES=3
DB_QUERY_RETRY_DELAY=1000

# 事务配置
DB_TRANSACTION_TIMEOUT=30000
DB_TRANSACTION_RETRIES=3
```

### 迁移配置

```env
# 数据库迁移配置
DB_MIGRATION_PATH=./migrations
DB_MIGRATION_TABLE=schema_migrations
DB_MIGRATION_LOCK_TABLE=migration_locks

# 备份配置
DB_BACKUP_ENABLED=true
DB_BACKUP_INTERVAL=86400
DB_BACKUP_RETENTION=30
DB_BACKUP_S3_BUCKET=your-backup-bucket
```

## 部署配置

### Docker配置

```env
# Docker配置
DOCKER_REGISTRY=your-registry.com
DOCKER_IMAGE_TAG=latest
DOCKER_BUILD_CONTEXT=.
DOCKER_DOCKERFILE_PATH=Dockerfile

# 容器配置
CONTAINER_PORT=3000
CONTAINER_MEMORY_LIMIT=512m
CONTAINER_CPU_LIMIT=0.5
```

### CI/CD配置

```env
# GitHub Actions配置
GITHUB_TOKEN=your-github-token
GITHUB_REPOSITORY=your-username/biorxiv-daily
GITHUB_REF=refs/heads/main

# 部署配置
DEPLOY_ENVIRONMENT=production
DEPLOY_TARGET=vercel
DEPLOY_BRANCH=main

# 质量检查配置
ESLINT_ENABLED=true
PRETTIER_ENABLED=true
TYPESCRIPT_CHECK=true
UNIT_TESTS_ENABLED=true
E2E_TESTS_ENABLED=true
```

### 负载均衡配置

```env
# 负载均衡配置
LB_ALGORITHM=round-robin
LB_HEALTH_CHECK_PATH=/health
LB_HEALTH_CHECK_INTERVAL=30000
LB_HEALTH_CHECK_TIMEOUT=5000
LB_HEALTH_CHECK_RETRIES=3

# 会话配置
SESSION_STORE=redis
SESSION_SECRET=your-session-secret
SESSION_TIMEOUT=3600
SESSION_SECURE=true
```

## 环境变量使用示例

### 在代码中使用

```typescript
// 使用环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const appName = import.meta.env.VITE_APP_NAME || 'BioRxiv日报';

// 类型安全的配置
interface AppConfig {
  supabaseUrl: string;
  supabaseKey: string;
  appName: string;
  devMode: boolean;
}

const config: AppConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  appName: import.meta.env.VITE_APP_NAME || 'BioRxiv日报',
  devMode: import.meta.env.VITE_DEV_MODE === 'true',
};

// 验证必需的环境变量
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

requiredEnvVars.forEach(envVar => {
  if (!import.meta.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

### 在构建脚本中使用

```bash
#!/bin/bash
# 构建脚本

# 设置环境变量
export NODE_ENV=production
export VITE_APP_VERSION=$(git rev-parse --short HEAD)
export VITE_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 构建应用
pnpm build

# 部署到不同环境
if [ "$DEPLOY_ENV" = "production" ]; then
  echo "Deploying to production..."
  # 生产部署逻辑
elif [ "$DEPLOY_ENV" = "staging" ]; then
  echo "Deploying to staging..."
  # 预发布部署逻辑
fi
```

### 条件配置

```typescript
// 根据环境使用不同配置
const getApiConfig = () => {
  if (import.meta.env.DEV) {
    return {
      baseURL: 'http://localhost:3000/api',
      timeout: 10000,
      debug: true,
    };
  }

  return {
    baseURL: 'https://api.your-domain.com',
    timeout: 5000,
    debug: false,
  };
};
```

## 环境变量管理最佳实践

### 1. 安全原则

```env
# ❌ 不要在客户端暴露敏感信息
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ 使用客户端安全的配置
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 类型安全

```typescript
// 定义环境变量类型
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_DEV_MODE: string;
  readonly VITE_DEBUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 3. 验证配置

```typescript
// 环境变量验证
const validateEnvVars = () => {
  const errors: string[] = [];

  if (!import.meta.env.VITE_SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is required');
  }

  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
};

// 在应用启动时验证
validateEnvVars();
```

### 4. 文档化

```env
# .env.example
# =============================================
# BioRxiv日报 - 环境变量配置示例
# =============================================

# Supabase配置
# 获取地址: https://supabase.com/dashboard/project/[your-project]/settings/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 应用配置
VITE_APP_NAME=BioRxiv日报
VITE_APP_URL=http://localhost:5173

# 开发配置
VITE_DEV_MODE=true
VITE_DEBUG=true

# AI分析配置（可选）
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_ANTHROPIC_API_KEY=your-anthropic-api-key

# 监控配置（可选）
VITE_SENTRY_DSN=your-sentry-dsn
VITE_GA_TRACKING_ID=your-ga-tracking-id
```

### 5. 环境切换

```bash
# 开发环境
cp .env.example .env.local
cp .env.example .env.development

# 生产环境
cp .env.example .env.production

# 加载特定环境
export $(cat .env.production | xargs)
```

## 故障排除

### 常见问题

**1. 环境变量未生效**
```bash
# 检查文件是否存在
ls -la .env*

# 检查文件权限
chmod 644 .env.local

# 重启开发服务器
pnpm dev
```

**2. 类型错误**
```typescript
// 确保类型定义存在
/// <reference types="vite/client" />

// 在vite-env.d.ts中声明
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**3. 构建时变量丢失**
```typescript
// 确保变量以VITE_开头
// ❌ 错误: MY_API_KEY=...
// ✅ 正确: VITE_MY_API_KEY=...

// 检查构建日志
pnpm build --debug
```

**4. 生产环境配置错误**
```bash
# 检查生产环境变量
cat .env.production

# 验证构建产物中的变量
grep -r "VITE_" dist/
```

## 总结

环境变量是管理应用配置的重要工具，遵循最佳实践可以确保应用的安全性和可维护性。

### 关键要点

1. **安全第一**: 敏感信息只在服务端使用
2. **类型安全**: 使用TypeScript类型定义
3. **验证配置**: 启动时验证必需变量
4. **文档化**: 提供清晰的配置说明
5. **环境隔离**: 不同环境使用不同配置

### 进一步参考

- [Vite环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase环境配置](https://supabase.com/docs/guides/cli/managing-environments)
- [12-Factor App配置](https://12factor.net/config)

---

**下一步**: 查看 [API文档](./API_DOCUMENTATION.md) 了解后端接口
