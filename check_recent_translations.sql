-- 查看最近翻译成功的 10 篇论文及其标签
-- Run this in Supabase SQL Editor

SELECT 
  p.id,
  -- 检查翻译结果
  pa.title_cn as "中文标题",
  CASE 
    WHEN pa.abstract_cn IS NOT NULL THEN '已翻译 (长度: ' || length(pa.abstract_cn) || ')' 
    ELSE '未翻译' 
  END as "摘要状态",
  pa.translation_status as "状态",
  pa.analyzed_at as "分析时间",
  -- 检查标签 (将多行标签合并为一行显示)
  COALESCE(
    (
      SELECT string_agg(t.name, ', ')
      FROM paper_tags pt
      JOIN tags t ON pt.tag_id = t.id
      WHERE pt.paper_id = p.id
    ),
    '⚠️ 无标签'
  ) as "生成的标签"
FROM paper_analysis pa
JOIN papers p ON p.id = pa.paper_id
ORDER BY pa.analyzed_at DESC
LIMIT 20;