-- 创建PDF下载队列表
CREATE TABLE IF NOT EXISTS pdf_download_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    pdf_url TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pdf_download_queue_status ON pdf_download_queue(status);
CREATE INDEX IF NOT EXISTS idx_pdf_download_queue_paper_id ON pdf_download_queue(paper_id);
CREATE INDEX IF NOT EXISTS idx_pdf_download_queue_priority ON pdf_download_queue(priority DESC, created_at ASC);

-- 启用RLS
ALTER TABLE pdf_download_queue ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Allow all" ON pdf_download_queue FOR ALL USING (true) WITH CHECK (true);

-- 添加表注释
COMMENT ON TABLE pdf_download_queue IS 'PDF下载任务队列，用于异步下载和解析论文PDF';
COMMENT ON COLUMN pdf_download_queue.paper_id IS '关联的论文ID';
COMMENT ON COLUMN pdf_download_queue.pdf_url IS 'PDF文件URL';
COMMENT ON COLUMN pdf_download_queue.priority IS '任务优先级，数值越大优先级越高';
COMMENT ON COLUMN pdf_download_queue.status IS '任务状态: pending-待处理, processing-处理中, completed-已完成, failed-失败';
COMMENT ON COLUMN pdf_download_queue.retry_count IS '重试次数';
