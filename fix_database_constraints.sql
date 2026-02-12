-- 数据库修复脚本：清理重复标签并添加唯一约束
-- 请在 Supabase SQL Editor 中运行

BEGIN;

-- 1. 清理 tags 表中的重复项
-- 逻辑：对于重名的标签，保留最早创建的那个，将其他重复标签的引用全部合并到保留的标签上，然后删除重复项。
DO $$
DECLARE
    r RECORD;
    keep_id UUID;
BEGIN
    FOR r IN SELECT name FROM tags GROUP BY name HAVING COUNT(*) > 1 LOOP
        -- 选出一个要保留的 ID (创建时间最早的)
        SELECT id INTO keep_id FROM tags WHERE name = r.name ORDER BY created_at ASC LIMIT 1;
        
        -- 将关联表 paper_tags 中的旧 tag_id 替换为 keep_id
        -- (如果有冲突，即同一篇论文同时关联了保留标签和重复标签，则忽略更新，稍后由去重逻辑处理)
        UPDATE paper_tags 
        SET tag_id = keep_id 
        WHERE tag_id IN (SELECT id FROM tags WHERE name = r.name AND id != keep_id)
        AND NOT EXISTS (
            SELECT 1 FROM paper_tags pt2 
            WHERE pt2.paper_id = paper_tags.paper_id AND pt2.tag_id = keep_id
        );
        
        -- 删除那些已经被合并的重复标签
        DELETE FROM tags WHERE name = r.name AND id != keep_id;
    END LOOP;
END $$;

-- 2. 清理 paper_tags 表中的重复关联
-- (保留最早的关联，删除重复的)
DELETE FROM paper_tags a USING paper_tags b
WHERE a.id > b.id 
AND a.paper_id = b.paper_id 
AND a.tag_id = b.tag_id;

-- 3. 添加唯一约束 (核心修复)
-- 这步成功后，代码里的 upsert 才能正常工作
ALTER TABLE tags ADD CONSTRAINT tags_name_key UNIQUE (name);
ALTER TABLE paper_tags ADD CONSTRAINT paper_tags_paper_tag_key UNIQUE (paper_id, tag_id);

COMMIT;

-- 4. 验证约束是否添加成功
SELECT 
    conname as constraint_name, 
    contype as constraint_type 
FROM pg_constraint 
WHERE conrelid = 'tags'::regclass OR conrelid = 'paper_tags'::regclass;
