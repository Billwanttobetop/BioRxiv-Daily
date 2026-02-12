# Supabase Edge Function 部署指南

## 问题概述

我们已经创建了缺失的 `fetch-biorxiv-papers` Edge Function，但当前环境无法直接部署到Supabase。以下是手动部署步骤。

## 部署步骤

### 1. 安装 Supabase CLI

在本地开发环境中安装Supabase CLI：

```bash
# macOS
brew install supabase/tap/supabase

# Windows (使用Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
sudo apt install -y supabase
```

### 2. 登录 Supabase

```bash
supabase login
```

### 3. 初始化项目（如果还没有）

```bash
supabase init
```

### 4. 链接到您的项目

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

### 5. 部署 Edge Function

```bash
# 部署 fetch-biorxiv-papers 函数
supabase functions deploy fetch-biorxiv-papers

# 同时部署其他函数
supabase functions deploy get-visit-stats
supabase functions deploy log-visit
```

## 环境变量配置

确保在Supabase项目中设置以下环境变量：

- `SUPABASE_URL`: 您的Supabase项目URL
- `SUPABASE_SERVICE_ROLE_KEY`: 服务角色密钥（用于Edge Function）

## 验证部署

部署完成后，可以通过以下方式测试：

1. 在Supabase Dashboard中查看Edge Functions
2. 使用前端界面测试获取论文功能
3. 检查函数日志确认运行状态

## 函数功能说明

`fetch-biorxiv-papers` 函数会：

1. 从 `https://connect.biorxiv.org/biorxiv_xml.php?subject=all` 获取最新RSS feed
2. 解析RDF/XML格式的论文数据
3. 提取DOI、标题、作者、摘要等信息
4. 检查数据库中是否已存在该论文（基于DOI去重）
5. 将新论文插入到数据库中

## 故障排除

如果部署遇到问题：

1. 检查网络连接和Supabase服务状态
2. 验证环境变量是否正确设置
3. 查看Edge Function日志获取详细错误信息
4. 确保数据库表结构正确（papers表存在且字段匹配）

## GitHub Actions 自动部署

项目已配置GitHub Actions工作流（`.github/workflows/deploy-supabase.yml`），当推送到main分支时会自动部署Edge Functions。确保在GitHub仓库设置中添加以下密钥：

- `SUPABASE_ACCESS_TOKEN`: Supabase访问令牌
- `SUPABASE_PROJECT_ID`: 您的Supabase项目ID