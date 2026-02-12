# 🚀 部署和测试指南

## ✅ 已完成的工作

### 1. 代码修复
- ✅ **翻译速度优化**：DeepSeek 并行处理（20个/批，10并发）
- ✅ **全文分析修复**：文本长度从 18K 扩展到 45K-135K 字符
- ✅ **类型定义修复**：添加 `translation_status` 等缺失字段
- ✅ **代码已推送到 GitHub**：https://github.com/Billwanttobetop/BioRxiv-Daily

### 2. 新增文件
- `supabase/functions/translate-paper-fast/` - 百度翻译快速方案
- `supabase/functions/process-pdf-queue/` - PDF下载队列
- `supabase/functions/process-translation-queue-fast/` - 快速翻译队列
- `.env.example` - 环境变量示例

---

## 🔧 部署步骤

### 步骤 1: 部署前端到 Vercel（已完成 ✅）

网站已部署：
- **生产环境**: https://biorxiv-final.vercel.app
- **自定义域名**: biodayday.com（如果已配置）

**如需重新部署：**
```bash
# 进入项目目录
cd biorxiv-daily-deployment-package-v1.0.0/deployment-package/biorxiv-final

# 确保环境变量已配置在 Vercel Dashboard 中
# Project Settings > Environment Variables

# 部署到生产环境
vercel --prod
```

---

### 步骤 2: 部署 Supabase Edge Functions（⚠️ 必需）

**重要**：前端已部署，但 Edge Functions 需要单独部署到 Supabase。

#### 2.1 登录 Supabase
```bash
# 方法 1: 使用浏览器登录（推荐）
supabase login

# 方法 2: 使用 Access Token（非交互环境）
supabase login --token your-access-token
# Token 获取：https://supabase.com/dashboard/account/tokens
```

#### 2.2 初始化 Supabase 项目
```bash
# 链接到现有项目
supabase link --project-ref your-project-ref

# 项目 ref 在 Supabase Dashboard > Project Settings > General 中查看
# 格式如：scqsayezaiiqfwqbrsef
```

#### 2.3 部署 Edge Functions
```bash
# 部署所有函数（在项目根目录执行）
supabase functions deploy translate-paper
supabase functions deploy process-translation-queue
supabase functions deploy analyze-paper-deep
supabase functions deploy download-and-parse-pdf
supabase functions deploy fetch-biorxiv-papers

# 可选：部署快速翻译版本
supabase functions deploy translate-paper-fast
supabase functions deploy process-translation-queue-fast

# 部署PDF下载队列
supabase functions deploy process-pdf-queue
```

#### 2.4 执行数据库迁移
```bash
# 推送数据库架构
supabase db push

# 或手动执行特定迁移文件
supabase db execute --file supabase/migrations/20250212000000_create_pdf_download_queue.sql
```

---

### 步骤 3: 配置环境变量

#### Supabase Edge Functions 环境变量
在 **Supabase Dashboard > Settings > API** 中添加：

```bash
# 必需
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 可选：百度翻译（快速翻译）
BAIDU_APP_ID=your-baidu-app-id
BAIDU_SECRET_KEY=your-baidu-secret-key

# 可选：MiniMax
MINIMAX_API_KEY=your-minimax-key
MINIMAX_API_URL=https://api.minimax.chat/v1/text/chatcompletion
```

#### Vercel 环境变量
在 **Vercel Dashboard > Project Settings > Environment Variables** 中添加：

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# DeepSeek
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 管理员
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

---

### 步骤 4: 配置定时任务（Cron Jobs）

在 **Supabase Dashboard > Database > Cron Jobs** 中添加：

```sql
-- 每5分钟处理一次翻译队列（DeepSeek）
SELECT cron.schedule(
  'process-translation-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/process-translation-queue',
    headers:='{"Authorization": "Bearer your-anon-key", "Content-Type": "application/json"}'::jsonb
  )
  $$
);

-- 每10分钟处理一次PDF下载队列
SELECT cron.schedule(
  'process-pdf-queue',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/process-pdf-queue',
    headers:='{"Authorization": "Bearer your-anon-key", "Content-Type": "application/json"}'::jsonb
  )
  $$
);
```

---

## 🧪 测试指南

### 测试 1: 基础功能
1. 访问 https://biorxiv-final.vercel.app
2. 检查论文列表是否正常加载
3. 点击论文查看详情页
4. 测试搜索功能

### 测试 2: 翻译功能
1. 在管理员后台（/console）登录
2. 点击"批量翻译"按钮
3. 观察翻译速度（优化后应明显加快）
4. 检查翻译结果是否正确显示

**预期结果：**
- 翻译速度：从原来的几分钟缩短到几秒钟
- 并发处理：同时处理 10 篇论文

### 测试 3: 全文分析
1. 打开任意论文详情页
2. 点击"AI深度分析"按钮
3. 等待分析完成
4. 检查结果是否基于全文（而非仅摘要）

**验证方法：**
- 查看分析内容是否包含方法、实验、结果等章节
- 检查分析深度（应有详细的方法描述和实验设计）

### 测试 4: PDF 下载
1. 查看数据库中的 `pdf_download_queue` 表
2. 确认新论文自动添加PDF下载任务
3. 检查 `paper_fulltext` 表是否有全文内容

```sql
-- 检查PDF下载队列状态
SELECT status, COUNT(*) FROM pdf_download_queue GROUP BY status;

-- 检查已下载的论文全文
SELECT paper_id, word_count, page_count FROM paper_fulltext LIMIT 5;
```

---

## 📊 性能对比

| 功能 | 优化前 | 优化后 | 提升 |
|-----|--------|--------|------|
| 翻译批处理 | 5个/批 | 20个/批 | 4倍 |
| 并发请求 | 无限制 | 10个并发 | 更稳定 |
| 分析文本长度 | 18K字符 | 45K-135K字符 | 2.5-7.5倍 |
| API超时保护 | 无 | 30秒 | 防止挂起 |

---

## 🔍 故障排除

### 问题 1: 翻译队列不处理
**检查：**
```sql
-- 查看待处理任务
SELECT COUNT(*) FROM translation_queue WHERE status = 'pending';

-- 查看失败任务
SELECT * FROM translation_queue WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 5;
```

**解决：**
1. 检查 Edge Functions 是否已部署
2. 检查 Cron Jobs 是否配置正确
3. 查看 Supabase Functions 日志

### 问题 2: 全文分析仍然是摘要
**检查：**
```sql
-- 检查是否有全文内容
SELECT paper_id, LENGTH(full_text) as length FROM paper_fulltext WHERE paper_id = 'your-paper-id';
```

**解决：**
1. 确保 `download-and-parse-pdf` 函数已部署
2. 检查 PDF 下载队列是否正常运行
3. 手动触发PDF下载测试

### 问题 3: Vercel 构建失败
**常见原因：**
- 类型错误：检查 `database.types.ts` 是否包含所有字段
- 缺少依赖：运行 `pnpm install`

**解决：**
```bash
# 本地测试构建
cd biorxiv-final
pnpm install
pnpm run build
```

---

## 📝 更新日志

### v1.1.0 (2025-02-12)
- ✨ 优化翻译速度：DeepSeek 并行处理
- ✨ 修复全文分析：扩展文本长度到 135K 字符
- ✨ 新增PDF下载队列：自动获取论文全文
- ✨ 添加 API 超时保护：30秒超时
- 🔧 修复类型定义：添加缺失的数据库字段
- 📝 添加环境变量示例文件

---

## 🔗 重要链接

- **GitHub**: https://github.com/Billwanttobetop/BioRxiv-Daily
- **Vercel 部署**: https://vercel.com/bill-projects/biorxiv-final
- **Supabase Dashboard**: https://supabase.com/dashboard/project/your-project-ref
- **生产环境**: https://biorxiv-final.vercel.app

---

## ⚡ 快速开始（已部署的情况下）

如果所有部署都已完成，直接访问：
👉 **https://biorxiv-final.vercel.app**

开始测试翻译和全文分析功能！
