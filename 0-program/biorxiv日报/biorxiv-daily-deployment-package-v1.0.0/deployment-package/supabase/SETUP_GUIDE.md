# BioRxiv日报 - Supabase 设置指南

## 概述

本指南将帮助您在Supabase上设置BioRxiv日报项目的完整后端环境，包括数据库、认证、Edge Functions和存储配置。

## 前置要求

1. **Supabase账号**: 在 [supabase.com](https://supabase.com) 注册账号
2. **项目创建**: 在Supabase控制台创建新项目
3. **项目URL和密钥**: 记录项目的URL和API密钥

## 步骤1: 创建Supabase项目

### 1.1 创建新项目
1. 登录 [Supabase控制台](https://supabase.com/dashboard)
2. 点击 "New Project"
3. 选择组织（Organization）
4. 填写项目信息：
   - **Name**: `biorxiv-daily` (或您喜欢的名称)
   - **Database Password**: 设置强密码（请记录此密码）
   - **Region**: 选择离您最近的区域
5. 点击 "Create new project"

### 1.2 获取项目配置信息
项目创建完成后，在项目设置中获取以下信息：

```
项目URL: https://your-project-id.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 步骤2: 数据库设置

### 2.1 执行数据库架构
1. 在Supabase控制台中，进入 "SQL Editor"
2. 创建新的查询
3. 复制并执行 `database/schema_complete.sql` 文件中的所有内容
4. 确认所有表和函数创建成功

### 2.2 验证数据库结构
在SQL Editor中运行以下查询验证：

```sql
-- 检查所有表是否创建成功
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 检查函数是否创建成功
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- 检查RLS策略是否创建成功
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

期望结果：
- 12个表被创建
- 1个函数被创建
- 12个RLS策略被创建

## 步骤3: 认证设置

### 3.1 配置认证设置
1. 进入 "Authentication" > "Settings"
2. 配置以下设置：

**Site URL**:
```
http://localhost:5173 (开发环境)
https://your-domain.com (生产环境)
```

**Additional Redirect URLs**:
```
http://localhost:5173/**
https://your-domain.com/**
```

### 3.2 配置邮件模板（可选）
1. 进入 "Authentication" > "Email Templates"
2. 自定义以下模板：
   - **Confirm signup**: 确认注册邮件
   - **Reset password**: 重置密码邮件
   - **Magic Link**: 魔法链接邮件

### 3.3 启用邮箱确认
1. 在 "Authentication" > "Settings" 中
2. 启用 "Enable email confirmations"
3. 配置SMTP设置（如果需要自定义邮件服务）

## 步骤4: Edge Functions部署

### 4.1 安装Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Windows (使用 Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 或使用 npm
npm install -g supabase
```

### 4.2 登录Supabase CLI
```bash
supabase login
```

### 4.3 链接项目
```bash
# 在项目根目录执行
supabase link --project-ref your-project-id
```

### 4.4 部署Edge Functions
```bash
# 部署所有函数
supabase functions deploy create-admin-user

# 验证部署
supabase functions list
```

### 4.5 配置环境变量
在Supabase控制台中，进入 "Edge Functions" > "Settings" > "Environment Variables"，添加：

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project-id.supabase.co
```

## 步骤5: 存储设置（如果需要）

### 5.1 创建存储桶
如果您的应用需要文件上传功能：

1. 进入 "Storage"
2. 创建以下存储桶：
   - `avatars`: 用户头像
   - `papers`: 论文文件
   - `thumbnails`: 缩略图

### 5.2 配置存储策略
为每个存储桶创建以下RLS策略：

```sql
-- 头像存储策略
CREATE POLICY "Avatar public read" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text])
    );

-- 论文存储策略
CREATE POLICY "Papers public read" ON storage.objects
    FOR SELECT USING (bucket_id = 'papers');

CREATE POLICY "Papers upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'papers' AND 
        auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text])
    );
```

## 步骤6: 前端配置

### 6.1 更新环境变量
在前端项目中，创建 `.env.local` 文件：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 6.2 更新Supabase客户端配置
在 `src/lib/supabase.ts` 中更新配置：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://your-project-id.supabase.co";
const supabaseAnonKey = "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 步骤7: 测试和验证

### 7.1 测试数据库连接
在SQL Editor中运行测试查询：

```sql
-- 测试基本查询
SELECT COUNT(*) as total_papers FROM papers;
SELECT COUNT(*) as total_users FROM profiles;
SELECT * FROM site_settings LIMIT 5;
```

### 7.2 测试Edge Function
使用Supabase控制台的Edge Functions测试功能，发送POST请求到 `create-admin-user` 端点：

```json
{
  "email": "admin@example.com",
  "password": "secure-password",
  "role": "admin"
}
```

### 7.3 测试认证功能
1. 在前端应用中测试注册/登录功能
2. 验证用户资料创建
3. 测试管理员权限

## 步骤8: 生产环境优化

### 8.1 数据库备份
1. 在 "Settings" > "Database" 中
2. 启用自动备份
3. 配置备份保留策略

### 8.2 监控设置
1. 进入 "Logs" 页面监控应用日志
2. 配置告警通知
3. 设置性能监控

### 8.3 安全配置
1. 在 "Settings" > "API" 中
2. 配置CORS设置
3. 限制API访问频率
4. 启用SSL/TLS

## 故障排除

### 常见问题

**1. RLS策略错误**
```
错误: "new row violates row-level security policy"
解决: 检查RLS策略是否正确配置，确保包含 'anon' 和 'service_role' 角色
```

**2. Edge Function部署失败**
```
错误: Function deployment failed
解决: 检查Supabase CLI是否正确登录，项目是否正确链接
```

**3. 认证问题**
```
错误: Invalid JWT token
解决: 检查anon key是否正确，token是否过期
```

**4. 数据库连接失败**
```
错误: Connection refused
解决: 检查项目URL是否正确，网络连接是否正常
```

### 获取帮助

- **官方文档**: [supabase.com/docs](https://supabase.com/docs)
- **社区支持**: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
- **实时支持**: Supabase控制台中的聊天功能

## 下一步

完成Supabase设置后，您可以：

1. 部署前端应用
2. 配置自定义域名
3. 设置CDN加速
4. 配置监控和告警
5. 进行性能优化

---

**注意**: 请妥善保管您的API密钥和数据库密码，不要在代码中硬编码敏感信息。
