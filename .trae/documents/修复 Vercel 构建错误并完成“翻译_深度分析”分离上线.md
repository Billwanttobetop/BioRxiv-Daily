## 问题定位
- 构建失败由两个原因触发：
  1) `src/components/PaperDeepAnalysis.tsx` 引用了不存在的 `@/components/ui/*` 组件（card/button/badge/scroll-area）。
  2) 代码查询 `paper_deep_analysis` 表，但 `src/lib/database.types.ts` 未包含该表类型，导致 Supabase 泛型报错（TS2769/TS2589）。

## 修复方案
### 1) 补齐 UI 组件
- 在 `src/components/ui/` 下新增四个轻量组件（仅封装样式，零依赖）：
  - `card.tsx`：导出 `Card`, `CardHeader`, `CardTitle`, `CardContent`，使用 Tailwind 类实现基本结构。
  - `button.tsx`：导出 `Button`，支持 `variant=default|outline`、`size=sm|md`。
  - `badge.tsx`：导出 `Badge`，支持 `variant=default|secondary|outline`。
  - `scroll-area.tsx`：导出 `ScrollArea`（内部为 div，添加滚动与边框样式）。
- 保持 `@/components/ui/*` 导入路径不变，无需调整 `PaperDeepAnalysis.tsx`。

### 2) 扩充 Supabase 类型
- 在 `src/lib/database.types.ts` 增加 `public.Tables.paper_deep_analysis`：
  - `Row` 包含：`id`, `paper_id`, `motivation`, `insights: string[]`, `methods: Json`, `experiments: Json`, `results: Json`, `technical_novelty_score: number`, `practical_impact_score: number`, `theoretical_contribution_score: number`, `confidence_score: number`, `analysis_status: 'completed'|'pending'`, `analyzed_at: string`。
  - `Insert`/`Update` 与 `Row` 对应（字段均可选）。
- 这样 `.from('paper_deep_analysis')` 将通过类型检查；`checkDeepAnalysis()` 返回的 `data` 可直接赋值为 `DeepAnalysis`（如字段为 JSON，则在组件内做轻微转换）。
- 兼容返回结构：若行内存在 `data` JSON 整体包裹，则在 `checkDeepAnalysis()` 中检测并取 `data.data` 作为 `DeepAnalysis`。

### 3) 构建与验证
- 本地执行：`pnpm install` → `pnpm run build`，确保 TypeScript 通过、Vite 构建产物生成。
- 推送到 GitHub `main`，等待 Vercel 自动构建（通常 30–60 秒）。
- 线上验证：
  - 首页卡片按钮文案已为 `翻译标题摘要`，点击仅做标题/摘要翻译与标签提取。
  - 顶部“获取最新论文”后，新论文自动排队翻译，中文标题/摘要逐步出现。
  - 详情展开后点击“开始AI深度分析”，仅在点击时执行全文深度解读并展示分节。

## 备选与风控
- 若你不希望在仓库新增 UI 组件文件：可改写 `PaperDeepAnalysis.tsx` 为纯 HTML+Tailwind，不依赖 `@/components/ui/*`；但会改动组件较多。
- 若后端的 `paper_deep_analysis` 真实结构与上述类型不完全一致：
  - 我会在组件内做容错映射（例如 `methods`/`experiments`/`results` 为 `Json` 时解析到 `DeepAnalysis`），避免运行时崩溃。

## 改动文件清单
- 新增：
  - `src/components/ui/card.tsx`
  - `src/components/ui/button.tsx`
  - `src/components/ui/badge.tsx`
  - `src/components/ui/scroll-area.tsx`
- 修改：
  - `src/lib/database.types.ts` 增加 `paper_deep_analysis` 类型块
  - 如需容错：微调 `src/components/PaperDeepAnalysis.tsx` 的 `checkDeepAnalysis()` 读取逻辑

请确认以上方案；确认后我将按此实现、构建并推送触发 Vercel 部署，再在网站上逐项验收。