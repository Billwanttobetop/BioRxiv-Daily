-- 最终版数据库修复脚本 (幂等执行，不会报错)
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. 清理重复标签 (保留最早的一个)
DO $$
DECLARE
    r RECORD;
    keep_id UUID;
BEGIN
    FOR r IN SELECT name FROM tags GROUP BY name HAVING COUNT(*) > 1 LOOP
        SELECT id INTO keep_id FROM tags WHERE name = r.name ORDER BY created_at ASC LIMIT 1;
        
        UPDATE paper_tags 
        SET tag_id = keep_id 
        WHERE tag_id IN (SELECT id FROM tags WHERE name = r.name AND id != keep_id)
        AND NOT EXISTS (SELECT 1 FROM paper_tags pt2 WHERE pt2.paper_id = paper_tags.paper_id AND pt2.tag_id = keep_id);
        
        DELETE FROM tags WHERE name = r.name AND id != keep_id;
    END LOOP;
END $$;

-- 2. 清理重复的关联记录
DELETE FROM paper_tags a USING paper_tags b
WHERE a.id > b.id AND a.paper_id = b.paper_id AND a.tag_id = b.tag_id;

-- 3. 安全添加约束 (先删后加，或者检查是否存在)
DO $$
BEGIN
    -- Tags name unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_name_key') THEN
        ALTER TABLE tags ADD CONSTRAINT tags_name_key UNIQUE (name);
    END IF;

    -- Paper Tags relation unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paper_tags_paper_tag_key') THEN
        ALTER TABLE paper_tags ADD CONSTRAINT paper_tags_paper_tag_key UNIQUE (paper_id, tag_id);
    END IF;
END $$;

COMMIT;

-- 4. 验证约束
SELECT conname, conrelid::regclass FROM pg_constraint WHERE conname IN ('tags_name_key', 'paper_tags_paper_tag_key');
