
-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_raw_data ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = email);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = email);

-- Users can only see their own cases
CREATE POLICY "Users can view own cases" ON cases
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE email = auth.uid()::text
  ));

CREATE POLICY "Users can insert own cases" ON cases
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM users WHERE email = auth.uid()::text
  ));

-- Case-related tables inherit permissions from cases table
CREATE POLICY "View case details" ON case_parties
  FOR SELECT USING (case_id IN (
    SELECT id FROM cases WHERE user_id IN (
      SELECT id FROM users WHERE email = auth.uid()::text
    )
  ));

CREATE POLICY "View case charges" ON case_charges
  FOR SELECT USING (case_id IN (
    SELECT id FROM cases WHERE user_id IN (
      SELECT id FROM users WHERE email = auth.uid()::text
    )
  ));

CREATE POLICY "View case calendar" ON case_calendar
  FOR SELECT USING (case_id IN (
    SELECT id FROM cases WHERE user_id IN (
      SELECT id FROM users WHERE email = auth.uid()::text
    )
  ));

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON cases
  FOR ALL USING (auth.role() = 'service_role');
