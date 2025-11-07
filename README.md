# BioRxiv 日报 · BioDayDay

每天精选 BioRxiv 论文，智能标签与分析，帮你快速获取高质量学术信息。

- 在线网站：biodayday.com
- 开源仓库：本仓库（欢迎 Star 与贡献）

## 亮点功能（前端）
- 论文浏览与检索：按关键词、标签快速定位，高效阅读。
- 智能标签与热门标签：结合分析数据与前端回退保障可用性。
- 收藏与个人页面：将喜欢的论文加入收藏并管理。
- 性能监控：已接入 Vercel Speed Insights 与 Vercel Analytics，持续优化体验。

## 自动部署（重要）
- 只要 GitHub 仓库更新（推送到 `main`），Vercel 会自动触发构建与部署。
- 生产站点域名：biodayday.com（部署完成后约数十秒即可生效）。
- 注意事项：请同步提交 `pnpm-lock.yaml`，以避免 CI 的 `frozen-lockfile` 安装失败。

## 快速开始（前端开发）
- 环境要求：Node.js 18+、pnpm 10+。
- 安装依赖：`pnpm install`
- 启动开发：`pnpm dev`，默认端口 `http://localhost:5173`
- 生产构建：`pnpm build`（产物输出到 `dist/`）

## 技术栈（前端）
- React 18、TypeScript、Vite 6、Tailwind CSS、shadcn/ui、Lucide 图标。
- 部署：Vercel 自动部署（GitHub → Vercel 自动同步）。

## Roadmap / TODO
- 评论功能：为每篇论文提供讨论与互动。
- 收藏合集功能：将收藏组织为自定义合集，分享与协作。
- 文献图片摘取功能：抽取文献中的关键图示，方便快速理解。
- 全文每段分析功能：段落级摘要与要点提炼，提升阅读效率。
- 目标能力：逐步做到“几乎可以在本站完整读完论文”的体验。

## 加群交流
- 欢迎加入我们的微信群，交流学术进展与产品建议。
- 我们会在此处放置微信群截图（示例占位）：
  - 请在仓库 `docs/` 目录中添加 `wechat-group.png` 后，README 将展示：
  -<img width="140" height="200" alt="image" src="https://github.com/user-attachments/assets/8f1b3877-2cb3-499d-9574-baeefae9912b" />

`

## 贡献指南（仅前端）
- 欢迎提交 Issue 与 PR：
  - Fork 仓库，创建特性分支。
  - 完成前端开发后运行 `pnpm build` 确认无误。
  - 提交 PR，并附上变更说明与截图（如涉及 UI）。
- 我们专注前端改进：交互体验、样式优化、组件设计、性能优化。

## 部署说明（补充）
- Vercel 项目已连接 GitHub 仓库，默认以 `main` 为生产分支。
- 若需设置自定义安装命令，可在 Vercel 项目 Settings 中调整为：
  - `pnpm install --no-frozen-lockfile`
- 非 Vercel 托管场景可将 `dist/` 同步至 Nginx，确保使用 SPA 路由回退（`try_files ... /index.html`）。

## 致谢
- 感谢开源社区与 BioRxiv 提供的宝贵资源，欢迎大家共建更好的科研信息获取平台。
