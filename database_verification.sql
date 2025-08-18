-- Verification Queries
-- Run these to verify your database setup

-- 1. Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('cases', 'case_parties', 'case_charges', 'case_calendar', 'cron_schedules', 'cron_executions')
ORDER BY table_name;

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('cases', 'case_parties', 'case_charges', 'case_calendar')
ORDER BY tablename;

-- 3. Test database functions
SELECT get_case_stats();

-- 4. Check indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('cases', 'case_parties', 'case_charges', 'case_calendar')
ORDER BY tablename, indexname;

-- 5. Verify policies exist
SELECT policyname, tablename, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
