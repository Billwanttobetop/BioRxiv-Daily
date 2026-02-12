-- 检查 paper_analysis 表的列名
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'paper_analysis';
