-- BioRxiv日报完整数据库架构
-- 导出时间: 2025-11-04
-- 项目: BioRxiv日报 - 批量AI分析版

-- =============================================
-- 1. 启用必要的扩展
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 2. 核心业务表
-- =============================================

-- 论文主表
CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    authors TEXT[],
    abstract TEXT,
    pdf_url TEXT NOT NULL,
    published_date DATE NOT NULL,
    doi TEXT,
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 论文分析表
CREATE TABLE IF NOT EXISTS paper_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL,
    title_cn TEXT,
    main_institutions TEXT[],
    abstract_cn TEXT,
    insights TEXT,
    solutions TEXT,
    limitations TEXT,
    prospects TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户资料表
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    paper_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户集合表
CREATE TABLE IF NOT EXISTS user_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 集合论文关联表
CREATE TABLE IF NOT EXISTS collection_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL,
    paper_id UUID NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 论文标签关联表
CREATE TABLE IF NOT EXISTS paper_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. 管理功能表
-- =============================================

-- 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    username TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 站点设置表
CREATE TABLE IF NOT EXISTS site_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API配置表
CREATE TABLE IF NOT EXISTS api_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL,
    config_value TEXT NOT NULL,
    base_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. 监控和日志表
-- =============================================

-- API使用日志表
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    function_name TEXT NOT NULL,
    endpoint TEXT,
    method TEXT DEFAULT 'POST',
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    tokens_used INTEGER DEFAULT 0,
    cost_usd NUMERIC DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB,
    source TEXT,
    user_id UUID,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户活动日志表
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 速率限制表
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    api_name TEXT NOT NULL,
    limit_per_day INTEGER DEFAULT 100,
    limit_per_hour INTEGER DEFAULT 20,
    current_day_count INTEGER DEFAULT 0,
    current_hour_count INTEGER DEFAULT 0,
    last_reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. 索引创建
-- =============================================

-- 论文表索引
CREATE INDEX IF NOT EXISTS idx_papers_published_date ON papers(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_title ON papers USING gin(to_tsvector('english', title));

-- 论文分析表索引
CREATE INDEX IF NOT EXISTS idx_paper_analysis_paper_id ON paper_analysis(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_analysis_analyzed_at ON paper_analysis(analyzed_at DESC);

-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_paper_id ON user_favorites(paper_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_papers_collection_id ON collection_papers(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_papers_paper_id ON collection_papers(paper_id);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_paper_tags_paper_id ON paper_tags(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_tags_tag_id ON paper_tags(tag_id);

-- 管理员索引
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- 日志索引
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);

-- 速率限制索引
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_api_name ON rate_limits(api_name);

-- =============================================
-- 6. 触发器和函数
-- =============================================

-- 站点设置更新时间戳函数
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 站点设置更新时间戳触发器
DROP TRIGGER IF EXISTS update_site_settings_timestamp ON site_settings;
CREATE TRIGGER update_site_settings_timestamp
    BEFORE UPDATE ON site_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_site_settings_updated_at();

-- =============================================
-- 7. 默认数据插入
-- =============================================

-- 插入默认站点设置
INSERT INTO site_settings (setting_key, setting_value, description) VALUES
    ('copyright', '© 2025 BioRxiv日报. 保留所有权利。', '版权声明'),
    ('contact_email', 'contact@biorxiv-daily.com', '联系邮箱'),
    ('contact_phone', '+86 138-1234-5678', '联系电话'),
    ('social_twitter', 'https://twitter.com/biorxiv', 'Twitter 链接'),
    ('social_github', 'https://github.com/biorxiv', 'GitHub 链接'),
    ('address', '中国北京市海淀区中关村科技园', '公司地址')
ON CONFLICT (setting_key) DO NOTHING;

-- 插入默认API配置
INSERT INTO api_configs (config_key, config_value, base_url, is_active) VALUES
    ('openai_api_key', '', 'https://api.openai.com/v1', true),
    ('anthropic_api_key', '', 'https://api.anthropic.com/v1', true),
    ('biorxiv_base_url', 'https://api.biorxiv.org', 'https://api.biorxiv.org', true)
ON CONFLICT (config_key) DO NOTHING;

-- =============================================
-- 8. 行级安全策略 (RLS)
-- =============================================

-- 启用所有表的RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- 管理员用户策略
CREATE POLICY "Admin users full access for service role" ON admin_users
    FOR ALL
    USING (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

-- API配置策略
CREATE POLICY "Allow public read access" ON api_configs
    FOR SELECT
    USING (true);

CREATE POLICY "Allow service role manage access" ON api_configs
    FOR ALL
    USING (auth.role() = 'service_role'::text);

-- API使用日志策略
CREATE POLICY "API logs insert for service role" ON api_usage_logs
    FOR INSERT
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

CREATE POLICY "API logs read for service role" ON api_usage_logs
    FOR SELECT
    USING (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

-- 速率限制策略
CREATE POLICY "Rate limits full access for service role" ON rate_limits
    FOR ALL
    USING (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

-- 站点设置策略
CREATE POLICY "公开读取站点设置" ON site_settings
    FOR SELECT
    USING (true);

CREATE POLICY "管理员可以更新站点设置" ON site_settings
    FOR UPDATE
    USING (auth.role() = 'authenticated'::text);

-- 系统日志策略
CREATE POLICY "System logs insert for service role" ON system_logs
    FOR INSERT
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

CREATE POLICY "System logs read for service role" ON system_logs
    FOR SELECT
    USING (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

-- 用户活动策略
CREATE POLICY "User activities insert for service role" ON user_activities
    FOR INSERT
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

CREATE POLICY "User activities read for service role" ON user_activities
    FOR SELECT
    USING (auth.role() = ANY (ARRAY['anon'::text, 'service_role'::text]));

-- =============================================
-- 9. 辅助函数
-- =============================================

-- 获取未翻译论文的函数
CREATE OR REPLACE FUNCTION get_untranslated_papers(limit_count integer DEFAULT 50)
RETURNS TABLE (
    id uuid,
    title text,
    authors text[],
    abstract text,
    pdf_url text,
    published_date date,
    doi text,
    source_url text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.authors,
        p.abstract,
        p.pdf_url,
        p.published_date,
        p.doi,
        p.source_url,
        p.created_at,
        p.updated_at
    FROM papers p
    LEFT JOIN paper_analysis pa ON p.id = pa.paper_id
    WHERE 
        -- Paper has no analysis record OR analysis has no translations
        pa.id IS NULL 
        OR (pa.title_cn IS NULL AND pa.abstract_cn IS NULL)
        -- Only process papers that are not too recent (avoid processing papers from today)
        AND p.published_date < CURRENT_DATE
    ORDER BY p.published_date DESC
    LIMIT limit_count;
END;
$$;

-- =============================================
-- 架构创建完成
-- =============================================
