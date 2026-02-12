CREATE TABLE IF NOT EXISTS page_visits (
    id bigserial PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    path text,
    ip_address text,
    user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admins" ON page_visits
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Allow individual user to view their own visits" ON page_visits
FOR SELECT
USING (auth.uid() = user_id);