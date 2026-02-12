# 环境变量配置更新

## 新增配置

### 百度翻译 API（用于快速翻译标题和摘要）

为了提高翻译速度并降低成本，现在支持使用百度翻译API代替DeepSeek进行标题和摘要的翻译。

```bash
# 百度翻译 API 配置（必需）
BAIDU_APP_ID=你的百度翻译APP ID
BAIDU_SECRET_KEY=你的百度翻译密钥
```

**如何获取百度翻译API密钥：**
1. 访问 https://fanyi-api.baidu.com/
2. 注册并登录百度账号
3. 进入「管理控制台」→「开发者信息」
4. 申请「标准版」或「高级版」
5. 获取 APP ID 和密钥

**免费额度：**
- 标准版：每月 200 万字符免费
- 高级版：每月 1000 万字符免费

对于学术论文标题+摘要的翻译，200万字符/月可以翻译约 3-5 万篇论文，完全够用。

## 完整环境变量列表

### Supabase 配置（必需）
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 翻译 API 配置（二选一）

**方案1：百度翻译（推荐，速度快、成本低）**
```bash
BAIDU_APP_ID=your-app-id
BAIDU_SECRET_KEY=your-secret-key
```

**方案2：DeepSeek（质量更高但较慢）**
```bash
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
```

### 深度分析 API 配置（必需）
```bash
# DeepSeek（用于深度分析，必须使用）
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# MiniMax（可选，用于全文分析）
MINIMAX_API_KEY=your-minimax-key
MINIMAX_API_URL=https://api.minimax.chat/v1/text/chatcompletion
```

## 配置说明

### 翻译流程

1. **快速翻译（标题+摘要）**
   - 使用百度翻译 API
   - 速度：约 100-500ms/篇
   - 成本：免费（在额度内）
   - 质量：适合标题和摘要翻译

2. **深度分析（全文）**
   - 使用 DeepSeek API
   - 速度：约 5-30秒/篇（取决于全文长度）
   - 成本：按 token 计费
   - 质量：专业的学术分析

### 性能对比

| 翻译方式 | 速度 | 成本 | 适用场景 |
|---------|------|------|---------|
| 百度翻译 | 100-500ms | 免费 | 标题+摘要翻译 |
| DeepSeek | 2-5秒 | $0.14-0.28/M tokens | 深度分析 |

### 使用建议

- **默认配置**：使用百度翻译处理所有标题和摘要，速度快且免费
- **高质量需求**：可以为特定论文单独使用 DeepSeek 进行翻译
- **成本控制**：百度翻译每月 200 万字符免费额度足够处理常规更新

## 部署步骤

1. **配置环境变量**
   ```bash
   # 在 Supabase Dashboard → Settings → API 中添加环境变量
   # 或者在本地 .env 文件中配置
   ```

2. **部署 Edge Functions**
   ```bash
   # 部署新的快速翻译函数
   supabase functions deploy translate-paper-fast
   
   # 部署新的快速队列处理函数
   supabase functions deploy process-translation-queue-fast
   
   # 部署PDF队列处理函数
   supabase functions deploy process-pdf-queue
   
   # 部署更新后的论文获取函数
   supabase functions deploy fetch-biorxiv-papers
   ```

3. **执行数据库迁移**
   ```bash
   supabase db push
   # 或者手动执行 SQL 文件
   ```

4. **配置定时任务（Cron Jobs）**
   
   在 Supabase Dashboard → Database → Cron Jobs 中添加：
   
   ```sql
   -- 每5分钟处理一次翻译队列
   SELECT cron.schedule(
     'process-translation-queue',
     '*/5 * * * *',
     'SELECT net.http_get(''https://your-project.supabase.co/functions/v1/process-translation-queue-fast'')'
   );
   
   -- 每10分钟处理一次PDF下载队列
   SELECT cron.schedule(
     'process-pdf-queue',
     '*/10 * * * *',
     'SELECT net.http_get(''https://your-project.supabase.co/functions/v1/process-pdf-queue'')'
   );
   ```

## 故障排除

### 百度翻译返回错误

**错误 52001：未授权用户**
- 检查 APP ID 和密钥是否正确
- 确认百度翻译API已开通

**错误 54004：账户余额不足**
- 免费额度已用完
- 考虑升级到高级版或充值

**错误 58001：服务当前不可用**
- 百度翻译服务暂时不可用
- 系统会自动重试

### PDF 下载失败

**超时错误**
- PDF文件可能太大
- 网络连接不稳定
- 系统会自动重试（最多3次）

**404 错误**
- PDF链接可能已失效
- 检查 source_url 是否正确

## 监控和日志

### 查看队列状态

```sql
-- 查看待处理的翻译任务
SELECT COUNT(*) FROM translation_queue WHERE status = 'pending';

-- 查看待处理的PDF下载任务
SELECT COUNT(*) FROM pdf_download_queue WHERE status = 'pending';

-- 查看失败的任务
SELECT * FROM translation_queue WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10;
```

### 查看 Supabase Functions 日志

```bash
# 查看函数日志
supabase functions logs translate-paper-fast --tail
supabase functions logs process-translation-queue-fast --tail
supabase functions logs process-pdf-queue --tail
```
