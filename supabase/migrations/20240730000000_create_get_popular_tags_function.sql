CREATE OR REPLACE FUNCTION get_popular_tags(limit_count INT)
RETURNS TABLE(name TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name,
        COUNT(pt.tag_id) AS count
    FROM
        tags t
    JOIN
        paper_tags pt ON t.id = pt.tag_id
    GROUP BY
        t.name
    ORDER BY
        count DESC
    LIMIT
        limit_count;
END;
$$ LANGUAGE plpgsql;