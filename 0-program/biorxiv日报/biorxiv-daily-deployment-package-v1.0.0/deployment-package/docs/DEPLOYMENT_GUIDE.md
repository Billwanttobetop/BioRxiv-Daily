# BioRxiv日报 - 完整部署指南

## 概述

本指南将帮助您在生产环境中完整部署BioRxiv日报项目，包括前端应用、后端服务、数据库配置和监控设置。

## 部署架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户浏览器     │────│   CDN/负载均衡   │────│   前端应用      │
│                 │    │   (Nginx)       │    │   (Vite Build)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Supabase      │
                       │   - Database    │
                       │   - Auth        │
                       │   - Edge Funcs  │
                       │   - Storage     │
                       └─────────────────┘
```

## 前置准备

### 系统要求

**开发环境**:
- Node.js 18+
- pnpm 8+
- Git
- VS Code (推荐)

**生产环境**:
- Ubuntu 20.04+ / CentOS 8+
- 2GB+ RAM
- 20GB+ 磁盘空间
- SSL证书

### 必需账号和服务

1. **Supabase账号**: [supabase.com](https://supabase.com)
2. **域名注册商**: 阿里云、腾讯云、GoDaddy等
3. **SSL证书**: Let's Encrypt 或商业证书
4. **VPS提供商**: 阿里云、腾讯云、AWS等

## 部署方案选择

### 方案1: 静态部署 (推荐入门)

**适用场景**: 个人项目、原型展示、小型团队

**优势**:
- 部署简单快速
- 成本低廉
- 自动SSL和CDN
- 全球加速

**平台选择**:
- **Vercel** (推荐): 最佳开发体验
- **Netlify**: 功能丰富
- **GitHub Pages**: 免费但功能有限

#### Vercel部署步骤

1. **准备代码**
   ```bash
   # 克隆项目
   git clone <your-repo-url>
   cd biorxiv-daily
   
   # 安装依赖
   pnpm install
   
   # 构建项目
   pnpm build
   ```

2. **连接Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用GitHub账号登录
   - 点击 "New Project"
   - 选择您的代码仓库

3. **配置构建设置**
   ```
   Framework Preset: Vite
   Build Command: pnpm build
   Output Directory: dist
   Install Command: pnpm install
   ```

4. **配置环境变量**
   在Vercel项目设置中添加:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. **部署**
   - 点击 "Deploy"
   - 等待构建完成
   - 访问生成的URL

### 方案2: VPS部署 (推荐生产)

**适用场景**: 中型项目、企业使用、需要自定义控制

**优势**:
- 完全控制环境
- 可定制配置
- 性能优化空间
- 数据隐私控制

#### VPS部署步骤

1. **服务器准备**

   **Ubuntu 20.04**:
   ```bash
   # 更新系统
   sudo apt update && sudo apt upgrade -y
   
   # 安装基础软件
   sudo apt install -y curl wget git nginx certbot python3-certbot-nginx
   
   # 安装Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 安装pnpm
   npm install -g pnpm
   
   # 安装PM2
   npm install -g pm2
   ```

2. **域名和SSL配置**

   **域名解析**:
   ```
   类型: A记录
   主机记录: @ (根域名) 和 www
   记录值: 您的服务器IP地址
   TTL: 600
   ```

   **SSL证书申请**:
   ```bash
   # 使用Let's Encrypt免费证书
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   
   # 自动续期
   sudo crontab -e
   # 添加以下行:
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

3. **Nginx配置**

   创建 `/etc/nginx/sites-available/biorxiv-daily`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com www.your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name your-domain.com www.your-domain.com;

       # SSL配置
       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
       
       # 安全头
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-XSS-Protection "1; mode=block" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header Referrer-Policy "no-referrer-when-downgrade" always;
       add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

       # Gzip压缩
       gzip on;
       gzip_vary on;
       gzip_min_length 1024;
       gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

       # 静态文件缓存
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }

       # SPA路由支持
       location / {
           try_files $uri $uri/ /index.html;
           add_header Cache-Control "no-cache, no-store, must-revalidate";
       }

       # API代理 (如果需要)
       location /api/ {
           proxy_pass https://your-project.supabase.co/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   启用站点:
   ```bash
   sudo ln -s /etc/nginx/sites-available/biorxiv-daily /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **应用部署**

   ```bash
   # 创建应用目录
   sudo mkdir -p /var/www/biorxiv-daily
   sudo chown $USER:$USER /var/www/biorxiv-daily
   
   # 克隆代码
   cd /var/www/biorxiv-daily
   git clone <your-repo-url> .
   
   # 安装依赖
   pnpm install
   
   # 配置环境变量
   cp .env.example .env
   # 编辑.env文件，填入配置信息
   
   # 构建应用
   pnpm build
   
   # 设置权限
   sudo chown -R www-data:www-data /var/www/biorxiv-daily
   sudo chmod -R 755 /var/www/biorxiv-daily
   ```

5. **PM2进程管理** (可选，用于SSR)
   ```bash
   # 创建PM2配置
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'biorxiv-daily',
       script: 'pnpm',
       args: 'start',
       cwd: '/var/www/biorxiv-daily',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       }
     }]
   }
   EOF
   
   # 启动应用
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

### 方案3: Docker容器化部署

**适用场景**: 大型项目、微服务架构、容器化环境

#### Docker部署步骤

1. **创建Dockerfile**
   ```dockerfile
   # 多阶段构建
   FROM node:18-alpine AS builder
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm install -g pnpm && pnpm install
   
   COPY . .
   RUN pnpm build
   
   # 生产镜像
   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **创建docker-compose.yml**
   ```yaml
   version: '3.8'
   
   services:
     app:
       build: .
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/conf.d/default.conf
         - /etc/letsencrypt:/etc/letsencrypt:ro
       restart: unless-stopped
       environment:
         - NODE_ENV=production
   
     # 可选: 添加监控容器
     nginx-exporter:
       image: nginx/nginx-prometheus-exporter
       ports:
         - "9113:9113"
       command:
         - '-nginx.scrape-uri=http://app:80/nginx_status'
   ```

3. **部署命令**
   ```bash
   # 构建和启动
   docker-compose up -d --build
   
   # 查看日志
   docker-compose logs -f app
   
   # 停止服务
   docker-compose down
   ```

## 环境变量配置

### 开发环境 (.env.local)
```env
# Supabase配置
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# 开发模式
VITE_DEV_MODE=true
```

### 生产环境 (.env.production)
```env
# Supabase配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# 生产模式
VITE_DEV_MODE=false
VITE_API_BASE_URL=https://your-domain.com/api

# 性能监控
VITE_SENTRY_DSN=your-sentry-dsn
VITE_ANALYTICS_ID=your-analytics-id
```

## 数据库迁移

### 执行迁移脚本

1. **在Supabase控制台中**:
   - 进入 "SQL Editor"
   - 复制 `database/schema_complete.sql` 内容
   - 执行脚本

2. **验证迁移结果**:
   ```sql
   -- 检查表创建
   SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
   
   -- 检查函数创建
   SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';
   
   -- 检查RLS策略
   SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
   ```

### 初始数据导入

```sql
-- 导入示例数据 (可选)
INSERT INTO papers (title, authors, abstract, pdf_url, published_date, doi) VALUES
('Example Paper 1', ARRAY['Author A', 'Author B'], 'This is an abstract...', 'https://example.com/paper1.pdf', '2024-01-01', '10.1234/example.2024.1'),
('Example Paper 2', ARRAY['Author C'], 'Another abstract...', 'https://example.com/paper2.pdf', '2024-01-02', '10.1234/example.2024.2');

-- 创建测试用户 (通过Supabase Auth)
-- 在Supabase控制台的Authentication > Users中创建
```

## 监控和日志

### 应用监控

1. **错误监控 (Sentry)**
   ```bash
   # 安装Sentry
   pnpm add @sentry/react @sentry/tracing
   
   # 配置
   # 在main.tsx中添加Sentry初始化
   ```

2. **性能监控**
   - 使用Web Vitals监控
   - 配置自定义性能指标
   - 设置性能告警

### 服务器监控

1. **系统资源监控**
   ```bash
   # 安装htop和iotop
   sudo apt install htop iotop
   
   # 监控命令
   htop                    # CPU和内存
   iotop                   # 磁盘I/O
   netstat -tulpn          # 网络连接
   df -h                   # 磁盘使用
   free -h                 # 内存使用
   ```

2. **日志管理**
   ```bash
   # Nginx日志
   sudo tail -f /var/log/nginx/access.log
   sudo tail -f /var/log/nginx/error.log
   
   # 系统日志
   sudo journalctl -f
   ```

### 备份策略

1. **数据库备份**
   ```bash
   # Supabase自动备份 (推荐)
   # 在Supabase控制台中配置自动备份
   
   # 手动备份
   pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
   ```

2. **文件备份**
   ```bash
   # 备份上传的文件
   tar -czf files-backup-$(date +%Y%m%d).tar.gz /var/www/biorxiv-daily/uploads/
   
   # 备份配置文件
   tar -czf config-backup-$(date +%Y%m%d).tar.gz /etc/nginx/sites-available/ /var/www/biorxiv-daily/.env
   ```

## 性能优化

### 前端优化

1. **代码分割**
   ```typescript
   // 路由级别的代码分割
   const HomePage = lazy(() => import('./pages/HomePage'));
   const AdminPage = lazy(() => import('./pages/AdminPage'));
   ```

2. **图片优化**
   ```typescript
   // 使用WebP格式
   // 懒加载
   const LazyImage = ({ src, alt }) => (
     <img loading="lazy" src={src} alt={alt} />
   );
   ```

3. **缓存策略**
   ```typescript
   // Service Worker缓存
   // 在public/sw.js中配置
   ```

### 数据库优化

1. **索引优化**
   ```sql
   -- 确保关键字段有索引
   CREATE INDEX CONCURRENTLY idx_papers_published_date ON papers(published_date DESC);
   CREATE INDEX CONCURRENTLY idx_papers_search ON papers USING gin(to_tsvector('english', title || ' ' || abstract));
   ```

2. **查询优化**
   ```typescript
   // 使用select限定字段
   const { data } = await supabase
     .from('papers')
     .select('id, title, authors, published_date')
     .eq('id', paperId);
   ```

## 安全加固

### 应用安全

1. **CSP配置**
   ```nginx
   add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://your-project.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;";
   ```

2. **HTTPS强制**
   ```nginx
   # 在server配置中添加
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

3. **敏感信息保护**
   ```bash
   # 设置文件权限
   chmod 600 /var/www/biorxiv-daily/.env
   chown www-data:www-data /var/www/biorxiv-daily/.env
   ```

### 数据库安全

1. **RLS策略验证**
   ```sql
   -- 检查所有表的RLS策略
   SELECT schemaname, tablename, policyname, cmd, roles
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

2. **API密钥轮换**
   - 定期更换Supabase API密钥
   - 使用环境变量存储敏感信息
   - 启用API访问日志

## 故障排除

### 常见问题

**1. 构建失败**
```bash
# 清理缓存
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 检查Node.js版本
node --version  # 应该 >= 18
```

**2. 部署后页面空白**
```bash
# 检查构建产物
ls -la dist/

# 检查Nginx配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

**3. Supabase连接失败**
```typescript
// 检查环境变量
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');

// 测试连接
const { data, error } = await supabase.from('papers').select('count').limit(1);
```

**4. 认证问题**
```typescript
// 检查用户状态
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);

// 检查会话
const { data: { session } } = await supabase.auth.getSession();
console.log('Current session:', session);
```

### 性能问题诊断

**1. 页面加载慢**
```bash
# 检查网络延迟
ping your-domain.com

# 检查DNS解析
nslookup your-domain.com

# 使用Chrome DevTools分析
# Network面板查看加载时间
# Performance面板分析性能瓶颈
```

**2. 数据库查询慢**
```sql
-- 启用慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- 分析查询计划
EXPLAIN ANALYZE SELECT * FROM papers WHERE published_date > '2024-01-01';
```

## 扩展和定制

### 添加新功能

1. **创建新页面**
   ```bash
   # 生成组件
   pnpm generate component NewFeature
   
   # 添加路由
   # 在App.tsx中添加新路由
   ```

2. **集成第三方服务**
   ```typescript
   // 添加新的API集成
   // 在services/目录下创建新的服务
   ```

### 定制UI主题

1. **修改主题颜色**
   ```css
   /* 在tailwind.config.js中 */
   module.exports = {
     theme: {
       extend: {
         colors: {
           primary: {
             50: '#eff6ff',
             500: '#3b82f6',
             900: '#1e3a8a',
           }
         }
       }
     }
   }
   ```

2. **添加暗色模式**
   ```typescript
   // 使用next-themes
   const { theme, setTheme } = useTheme();
   ```

## 维护和更新

### 定期维护任务

1. **每周任务**
   ```bash
   # 检查系统更新
   sudo apt update && sudo apt list --upgradable
   
   # 检查SSL证书有效期
   sudo certbot certificates
   
   # 清理日志文件
   sudo find /var/log -name "*.log" -mtime +30 -delete
   ```

2. **每月任务**
   ```bash
   # 更新依赖包
   pnpm update
   
   # 备份数据库
   pg_dump -h db.your-project.supabase.co -U postgres -d postgres > monthly-backup.sql
   
   # 检查磁盘使用
   df -h
   ```

### 版本更新流程

1. **开发环境测试**
   ```bash
   # 创建测试分支
   git checkout -b feature/new-feature
   
   # 本地测试
   pnpm dev
   
   # 运行测试
   pnpm test
   
   # 构建测试
   pnpm build
   ```

2. **生产环境部署**
   ```bash
   # 合并到主分支
   git checkout main
   git merge feature/new-feature
   
   # 部署到生产环境
   git push origin main
   
   # 在服务器上更新
   cd /var/www/biorxiv-daily
   git pull origin main
   pnpm install
   pnpm build
   
   # 重启服务
   sudo systemctl reload nginx
   ```

## 总结

本部署指南涵盖了BioRxiv日报项目的完整部署流程，从开发环境到生产环境的各种部署方案。选择适合您需求的部署方案，并按照指南逐步实施。

### 关键要点

1. **选择合适的部署方案**: 根据项目规模和需求选择
2. **重视安全配置**: SSL、CSP、RLS策略等
3. **建立监控体系**: 及时发现和解决问题
4. **制定备份策略**: 保护数据安全
5. **定期维护更新**: 保持系统稳定运行

如有问题，请参考故障排除章节或联系技术支持。

---

**下一步**: 查看 [Supabase设置指南](../supabase/SETUP_GUIDE.md) 配置后端服务
