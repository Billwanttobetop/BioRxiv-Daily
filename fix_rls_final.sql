-- 修复权限问题的最终版脚本
-- 会先删除旧策略再创建新策略，避免报错

-- 1. 标签表权限
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Tags" ON tags;
DROP POLICY IF EXISTS "Allow public read access" ON tags;
CREATE POLICY "Public Read Tags" ON tags FOR SELECT USING (true);

-- 2. 标签关联表权限
ALTER TABLE paper_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Paper Tags" ON paper_tags;
DROP POLICY IF EXISTS "Allow public read access" ON paper_tags;
CREATE POLICY "Public Read Paper Tags" ON paper_tags FOR SELECT USING (true);

-- 3. 论文分析表权限
ALTER TABLE paper_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Analysis" ON paper_analysis;
DROP POLICY IF EXISTS "Allow public read access" ON paper_analysis;
CREATE POLICY "Public Read Analysis" ON paper_analysis FOR SELECT USING (true);

-- 4. 论文主表权限
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Papers" ON papers;
DROP POLICY IF EXISTS "Allow public read access" ON papers;
CREATE POLICY "Public Read Papers" ON papers FOR SELECT USING (true);
