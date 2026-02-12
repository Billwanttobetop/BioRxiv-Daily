-- 分层AI分析系统核心数据库更新
-- 修复依赖问题，专注于核心功能

-- 1. 更新paper_analysis表，添加基础翻译字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='paper_analysis' AND column_name='translation_status'
    ) THEN
        ALTER TABLE paper_analysis 
        ADD COLUMN title_en TEXT,
        ADD COLUMN abstract_en TEXT,
        ADD COLUMN translation_model TEXT,
        ADD COLUMN translation_cost FLOAT DEFAULT 0,
        ADD COLUMN translation_status VARCHAR(20) DEFAULT 'pending',
        ADD COLUMN translated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

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

-- 4. 创建分析任务统计表
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

-- 5. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_paper_analysis_translation_status ON paper_analysis(translation_status);
CREATE INDEX IF NOT EXISTS idx_paper_analysis_translated_at ON paper_analysis(translated_at);
CREATE INDEX IF NOT EXISTS idx_paper_deep_analysis_status ON paper_deep_analysis(analysis_status);
CREATE INDEX IF NOT EXISTS idx_paper_deep_analysis_paper_id ON paper_deep_analysis(paper_id);
CREATE INDEX IF NOT EXISTS idx_translation_queue_status_priority ON translation_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_statistics_created_at ON analysis_statistics(created_at DESC);

-- 6. 创建触发器函数
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

-- 7. 创建统计视图
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

-- 8. 添加DeepSeek API配置（使用现有的配置表结构）
-- 如果site_settings表存在，添加相关配置
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='site_settings') THEN
        INSERT INTO site_settings (setting_key, setting_value, description) VALUES 
        ('deepseek_api_key', '', 'DeepSeek API密钥，用于论文翻译和深度分析'),
        ('deepseek_api_url', 'https://api.deepseek.com/v1', 'DeepSeek API基础URL'),
        ('translation_batch_size', '5', '翻译队列批处理大小'),
        ('analysis_cost_per_token', '0.00000014', '每token分析成本（美元）')
        ON CONFLICT (setting_key) DO NOTHING;
    END IF;
END $$;