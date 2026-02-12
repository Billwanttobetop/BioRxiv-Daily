-- 分层AI分析系统数据库结构更新
-- 支持自动翻译和深度分析的分离

-- 1. 更新paper_analysis表，添加基础翻译字段
ALTER TABLE paper_analysis 
ADD COLUMN IF NOT EXISTS title_en TEXT,
ADD COLUMN IF NOT EXISTS abstract_en TEXT,
ADD COLUMN IF NOT EXISTS translation_model TEXT,
ADD COLUMN IF NOT EXISTS translation_cost FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS translation_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP WITH TIME ZONE;

-- 2. 创建深度分析表（用户触发，高成本）
CREATE TABLE IF NOT EXISTS paper_deep_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    analysis_model TEXT NOT NULL,
    analysis_cost FLOAT DEFAULT 0,
    analysis_status VARCHAR(20) DEFAULT 'pending',
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 结构化分析内容（用户要求的格式）
    motivation TEXT,                    -- 研究动机
    insights JSONB,                     -- 洞见（数组格式）
    methods JSONB,                      -- 方法概述
    experiments JSONB,                  -- 实验设计
    results JSONB,                      -- 实验结果
    
    -- 额外分析维度
    technical_novelty_score FLOAT,    -- 技术新颖性评分
    practical_impact_score FLOAT,       -- 实际影响评分
    theoretical_contribution_score FLOAT, -- 理论贡献评分
    confidence_score FLOAT,             -- 分析置信度
    
    -- 处理信息
    processing_time INTEGER,            -- 处理时间（秒）
    token_count INTEGER,                -- 消耗的token数量
    error_message TEXT                  -- 错误信息（如果失败）
);

-- 3. 创建翻译队列表（用于自动翻译的排队）
CREATE TABLE IF NOT EXISTS translation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1,         -- 优先级（1-10，数字越大优先级越高）
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 4. 创建深度分析队列表（用于用户触发的分析排队）
CREATE TABLE IF NOT EXISTS deep_analysis_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- 哪个用户触发的分析
    priority INTEGER DEFAULT 5,             -- 用户触发的优先级较高
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 5. 创建分析任务统计表
CREATE TABLE IF NOT EXISTS analysis_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_type VARCHAR(20) NOT NULL,   -- 'translation' 或 'deep_analysis'
    paper_id UUID REFERENCES papers(id),
    user_id UUID REFERENCES auth.users(id),
    model_used TEXT,
    token_consumed INTEGER,
    cost_usd FLOAT,
    processing_time INTEGER,
    status VARCHAR(20),
    error_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建API密钥管理表（支持多个AI提供商）
CREATE TABLE IF NOT EXISTS ai_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,        -- 'deepseek', 'openai', 等
    key_name VARCHAR(100) NOT NULL,       -- 密钥名称
    api_key TEXT NOT NULL,                  -- 加密的API密钥
    base_url TEXT,                        -- API基础URL
    model_name TEXT,                      -- 使用的模型名称
    max_tokens INTEGER,                   -- 最大token限制
    cost_per_1k_input FLOAT,             -- 每1k输入token成本（美元）
    cost_per_1k_output FLOAT,            -- 每1k输出token成本（美元）
    daily_quota INTEGER,                  -- 每日配额
    monthly_quota INTEGER,                -- 每月配额
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,            -- 优先级（数字越大优先级越高）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_paper_analysis_translation_status ON paper_analysis(translation_status);
CREATE INDEX IF NOT EXISTS idx_paper_analysis_translated_at ON paper_analysis(translated_at);
CREATE INDEX IF NOT EXISTS idx_paper_deep_analysis_status ON paper_deep_analysis(analysis_status);
CREATE INDEX IF NOT EXISTS idx_paper_deep_analysis_paper_id ON paper_deep_analysis(paper_id);
CREATE INDEX IF NOT EXISTS idx_translation_queue_status_priority ON translation_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_deep_analysis_queue_status_priority ON deep_analysis_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_statistics_created_at ON analysis_statistics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_provider_priority ON ai_api_keys(provider, priority DESC);

-- 8. 添加RLS（Row Level Security）策略
ALTER TABLE paper_deep_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE deep_analysis_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;

-- 翻译队列：所有用户都可以创建翻译任务
CREATE POLICY "任何人都可以创建翻译任务" ON translation_queue
    FOR INSERT WITH CHECK (true);

CREATE POLICY "用户可以查看翻译任务状态" ON translation_queue
    FOR SELECT USING (true);

-- 深度分析队列：认证用户可以创建分析任务
CREATE POLICY "认证用户可以创建深度分析任务" ON deep_analysis_queue
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "用户可以查看自己的分析任务" ON deep_analysis_queue
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- 分析统计：用户可以查看统计信息
CREATE POLICY "用户可以查看分析统计" ON analysis_statistics
    FOR SELECT USING (true);

-- API密钥管理：只有管理员可以管理API密钥
CREATE POLICY "只有管理员可以管理API密钥" ON ai_api_keys
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 9. 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表添加updated_at触发器
CREATE TRIGGER update_paper_deep_analysis_updated_at BEFORE UPDATE ON paper_deep_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translation_queue_updated_at BEFORE UPDATE ON translation_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deep_analysis_queue_updated_at BEFORE UPDATE ON deep_analysis_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_api_keys_updated_at BEFORE UPDATE ON ai_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. 创建统计视图
CREATE OR REPLACE VIEW analysis_cost_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    analysis_type,
    COUNT(*) as task_count,
    SUM(token_consumed) as total_tokens,
    SUM(cost_usd) as total_cost_usd,
    AVG(processing_time) as avg_processing_time,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM analysis_statistics
GROUP BY DATE_TRUNC('day', created_at), analysis_type
ORDER BY date DESC;

-- 11. 插入默认的DeepSeek API配置
-- 11. 更新AI相关配置（使用现有的site_settings表结构）
INSERT INTO site_settings (setting_key, setting_value, description) VALUES 
('deepseek_api_key', '', 'DeepSeek API密钥，用于论文翻译和深度分析'),
('deepseek_api_url', 'https://api.deepseek.com/v1', 'DeepSeek API基础URL'),
('translation_batch_size', '5', '翻译队列批处理大小'),
('analysis_cost_per_token', '0.00000014', '每token分析成本（美元）');

-- 12. 创建分析队列处理函数
CREATE OR REPLACE FUNCTION process_analysis_queues()
RETURNS void AS $$
DECLARE
    batch_size int := 10;
    processed_count int := 0;
BEGIN
    -- 处理翻译队列（优先级高的先处理）
    UPDATE translation_queue 
    SET status = 'processing', processed_at = NOW()
    WHERE id IN (
        SELECT id FROM translation_queue 
        WHERE status = 'pending' 
        ORDER BY priority DESC, created_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    );
    
    -- 处理深度分析队列（用户触发的）
    UPDATE deep_analysis_queue 
    SET status = 'processing', processed_at = NOW()
    WHERE id IN (
        SELECT id FROM deep_analysis_queue 
        WHERE status = 'pending' 
        ORDER BY priority DESC, created_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    );
END;
$$ LANGUAGE plpgsql;
