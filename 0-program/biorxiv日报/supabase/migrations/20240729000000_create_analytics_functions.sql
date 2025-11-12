CREATE OR REPLACE FUNCTION get_daily_unique_visitors(for_date date)
RETURNS integer AS $$
  SELECT COUNT(DISTINCT ip_address)::integer FROM page_visits
  WHERE created_at::date = for_date;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION get_top_pages(limit_count integer)
RETURNS TABLE(path text, count bigint) AS $$
  SELECT path, COUNT(*) as count FROM page_visits
  GROUP BY path
  ORDER BY count DESC
  LIMIT limit_count;
$$ LANGUAGE sql;