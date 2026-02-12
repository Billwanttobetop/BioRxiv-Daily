<skill>
<name>
debug-guide
</name>
<description>
提供系统性的调试排查流程与建议，包含核心心法、SOP、前端/Node/后端排查清单及 Windows 常用命令。
</description>
<instructions>
当用户请求调试帮助、排查问题或询问如何 debug 时，请参考以下指南辅助用户：

## 项目专属排查指南 (BioRxiv Daily)

### 1. 统计标签更新异常 (Tag Statistics)

**症状**: 热门标签列表不更新、标签计数为 0、新论文无标签。

**排查清单**:
- **标签提取 (extract-tags)**:
  - 检查 DeepSeek API Key 配额与连通性。
  - **JSON 解析脆弱性**: AI 可能返回 Markdown 代码块（```json ... ```）或解释性文字，导致 `JSON.parse` 失败。检查 API 日志中的 `DeepSeek error` 或 `模型未返回标签`。
  - **归一化逻辑**: 检查 `extract-tags.ts` 中的硬编码正则映射，可能导致新领域的标签被错误归类或丢弃。
- **热门统计 (popular-tags)**:
  - **RPC 优先**: 确认 `get_global_popular_tags` RPC 函数是否存在且权限正确（`SECURITY DEFINER`）。
  - **Fallback 陷阱**: 如果 RPC 失败，代码回退到内存聚合，但有 `offset > 100000` 的硬熔断。如果 `paper_tags` 表超过 10 万行，统计将**完全不准确**（只统计旧数据）。
  - **解决方案**: 修复 RPC 权限；或优化 SQL 查询避免全表扫描；或增大 Fallback 的熔断阈值（慎用，易超时）。

### 2. PDF 获取与解析异常 (PDF Fetching)

**症状**: 全文分析为空、PDF 下载失败、解析内容乱码。

**排查清单**:
- **文本提取缺失 (Critical)**:
  - `download-and-parse-pdf` 函数中 `extractTextFromPage` 目前是**占位符** (`[第X页文本内容 - 需要集成专业PDF文本提取库]`)。
  - **修复**: 必须引入真实的 PDF 文本提取库（如 `pdf.js-extract`, `pdf-parse`）或调用外部 OCR 服务。`pdf-lib` 仅用于操作 PDF 结构，**不支持**提取文本。
- **反爬虫拦截 (403/429)**:
  - BioRxiv 可能拦截无 User-Agent 的请求。检查 `fetch` 的 Headers。
  - 建议：使用代理池或增加重试延迟；模拟真实浏览器 Headers。
- **超时 (Timeout)**:
  - Edge Function 执行时间有限（通常 10-60s）。大文件下载 + 解析极易超时。
  - 建议：改为异步架构（下载任务入队 -> 后台 Worker 处理 -> Webhook 回调）。

### 3. 数据库与 RPC 权限

- **RLS 策略**: 确保 `anon` 或 `service_role` 有权插入 `papers` 和 `paper_tags` 表。
- **RPC 安全**: 涉及跨 Schema 访问（如统计表）的函数，必须标记为 `SECURITY DEFINER` 并授予 `postgres` 或 `service_role` 权限。

---

建议将本文作为团队排查问题的共同基线：

- **复现与定位**：先复现、后定位。
- **修复方案**：明确根因；选择“消除根因”或“增加保护（重试/限流/隔离）”。
- **提交与部署**：Debug 修复后，**必须推送到远程仓库**。本地环境往往无法完全模拟 Edge Functions 或数据库权限的真实行为，必须通过 Git 推送触发 CI/CD 部署，在云端环境进行最终验证。
- **回归验证**：单测、集成测、端到端；补充监控告警与回滚预案。

