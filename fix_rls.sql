-- 修复 RLS 权限问题
-- 请在 Supabase SQL Editor 中运行此脚本

-- 1. 确保 RLS 已启用
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_tags ENABLE ROW LEVEL SECURITY;

-- 2. 清理旧策略 (避免重复报错)
DROP POLICY IF EXISTS "Public Read Papers" ON papers;
DROP POLICY IF EXISTS "Public Read Analysis" ON paper_analysis;
DROP POLICY IF EXISTS "Public Read Tags" ON tags;
DROP POLICY IF EXISTS "Public Read Paper Tags" ON paper_tags;

-- 3. 创建允许所有用户(包括匿名)读取的策略
CREATE POLICY "Public Read Papers" ON papers FOR SELECT USING (true);
CREATE POLICY "Public Read Analysis" ON paper_analysis FOR SELECT USING (true);
CREATE POLICY "Public Read Tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Public Read Paper Tags" ON paper_tags FOR SELECT USING (true);

-- 4. 允许 Service Role (Edge Functions) 进行所有操作
-- 通常 Service Role 会自动绕过 RLS，但为了保险起见，可以显式添加
-- (Supabase 默认 Service Role 是 bypass RLS 的，所以这一步通常是可选的，但为了明确意图)

-- 5. 检查最近的翻译结果 (调试用)
SELECT COUNT(*) as analysis_count FROM paper_analysis;
SELECT COUNT(*) as tags_count FROM tags;
