-- 请在 Supabase 的 SQL Editor 中运行此脚本，以创建高性能的热门标签统计函数
-- Run this script in Supabase SQL Editor to create the high-performance popular tags function

CREATE OR REPLACE FUNCTION get_global_popular_tags(limit_count INT DEFAULT 20)
RETURNS TABLE (
  name TEXT,
  count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.name,
    COUNT(pt.tag_id) as count
  FROM paper_tags pt
  JOIN tags t ON pt.tag_id = t.id
  GROUP BY t.name
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$;
