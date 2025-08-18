-- Insert test data for Justice Watch v3

-- First, let's insert some test cases
INSERT INTO cases (
  case_number,
  case_title,
  case_type,
  court_name,
  filing_date,
  status,
  judge,
  location,
  next_hearing,
  scraped_at,
  created_at,
  updated_at
) VALUES 
  -- Active arraignment cases
  ('CR2025-001234', 'STATE OF ARIZONA vs JOHN DOE', 'Criminal', 'Agua Fria Justice Court', '2025-01-15', 'Active', 'Judge Smith', 'Courtroom 1', '2025-01-20 09:00:00', NOW(), NOW(), NOW()),
  ('CR2025-001235', 'STATE OF ARIZONA vs JANE SMITH', 'Criminal', 'Desert Ridge Justice Court', '2025-01-16', 'Active', 'Judge Johnson', 'Courtroom 2', '2025-01-21 10:00:00', NOW(), NOW(), NOW()),
  ('CR2025-001236', 'STATE OF ARIZONA vs ROBERT JONES', 'Criminal', 'North Valley Justice Court', '2025-01-17', 'Active', 'Judge Williams', 'Courtroom 3', '2025-01-22 14:00:00', NOW(), NOW(), NOW()),
  
  -- Some traffic cases
  ('TR2025-005678', 'STATE OF ARIZONA vs MARIA GARCIA', 'Traffic', 'Agua Fria Justice Court', '2025-01-10', 'Active', 'Judge Smith', 'Courtroom 1', '2025-01-25 11:00:00', NOW(), NOW(), NOW()),
  ('TR2025-005679', 'STATE OF ARIZONA vs DAVID LEE', 'Traffic', 'Desert Ridge Justice Court', '2025-01-12', 'Closed', 'Judge Johnson', 'Courtroom 2', NULL, NOW(), NOW(), NOW()),
  
  -- Some civil cases
  ('CV2025-002345', 'LANDLORD LLC vs TENANT SMITH', 'Civil', 'North Valley Justice Court', '2025-01-05', 'Active', 'Judge Brown', 'Courtroom 4', '2025-01-28 13:00:00', NOW(), NOW(), NOW()),
  ('CV2025-002346', 'CREDITOR CORP vs DEBTOR DOE', 'Civil', 'Agua Fria Justice Court', '2025-01-08', 'Active', 'Judge Davis', 'Courtroom 1', '2025-01-30 15:00:00', NOW(), NOW(), NOW()),
  
  -- Some older cases (will be hidden by "Hide Past Cases")
  ('CR2024-009999', 'STATE OF ARIZONA vs OLD DEFENDANT', 'Criminal', 'Desert Ridge Justice Court', '2024-11-15', 'Closed', 'Judge Wilson', 'Courtroom 2', NULL, '2024-11-20', NOW(), NOW()),
  ('TR2024-008888', 'STATE OF ARIZONA vs PAST DRIVER', 'Traffic', 'North Valley Justice Court', '2024-10-20', 'Closed', 'Judge Taylor', 'Courtroom 3', NULL, '2024-10-25', NOW(), NOW());

-- Now let's add parties for these cases
INSERT INTO case_parties (
  case_id,
  party_type,
  party_name,
  attorney,
  created_at,
  updated_at
) 
SELECT 
  c.id,
  'Plaintiff',
  'STATE OF ARIZONA',
  'District Attorney Office',
  NOW(),
  NOW()
FROM cases c
WHERE c.case_type IN ('Criminal', 'Traffic');

-- Add defendants
INSERT INTO case_parties (
  case_id,
  party_type,
  party_name,
  attorney,
  created_at,
  updated_at
) VALUES
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001234'), 'Defendant', 'JOHN DOE', 'Public Defender Smith', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001235'), 'Defendant', 'JANE SMITH', 'Attorney Johnson', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001236'), 'Defendant', 'ROBERT JONES', NULL, NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'TR2025-005678'), 'Defendant', 'MARIA GARCIA', NULL, NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'TR2025-005679'), 'Defendant', 'DAVID LEE', 'Attorney Brown', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CV2025-002345'), 'Plaintiff', 'LANDLORD LLC', 'Property Law Firm', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CV2025-002345'), 'Defendant', 'TENANT SMITH', NULL, NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CV2025-002346'), 'Plaintiff', 'CREDITOR CORP', 'Collections Attorney', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CV2025-002346'), 'Defendant', 'DEBTOR DOE', NULL, NOW(), NOW());

-- Add some charges for criminal cases
INSERT INTO case_charges (
  case_id,
  charge_description,
  statute,
  severity,
  created_at,
  updated_at
) VALUES
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001234'), 'ASSAULT', 'ARS 13-1203', 'Misdemeanor', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001234'), 'DISORDERLY CONDUCT', 'ARS 13-2904', 'Misdemeanor', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001235'), 'THEFT', 'ARS 13-1802', 'Felony', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001236'), 'DUI', 'ARS 28-1381', 'Misdemeanor', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'TR2025-005678'), 'SPEEDING', 'ARS 28-701', 'Civil Traffic', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'TR2025-005679'), 'RED LIGHT VIOLATION', 'ARS 28-645', 'Civil Traffic', NOW(), NOW());

-- Add calendar events for active cases
INSERT INTO case_calendar (
  case_id,
  event_type,
  event_date,
  location,
  notes,
  created_at,
  updated_at
) VALUES
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001234'), 'Arraignment Hearing', '2025-01-20 09:00:00', 'Courtroom 1', 'Initial appearance', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001235'), 'Arraignment Hearing', '2025-01-21 10:00:00', 'Courtroom 2', 'Plea entry expected', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CR2025-001236'), 'Arraignment Hearing', '2025-01-22 14:00:00', 'Courtroom 3', 'Bail hearing included', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'TR2025-005678'), 'Traffic Court', '2025-01-25 11:00:00', 'Courtroom 1', 'Citation hearing', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CV2025-002345'), 'Eviction Hearing', '2025-01-28 13:00:00', 'Courtroom 4', 'Forcible detainer', NOW(), NOW()),
  ((SELECT id FROM cases WHERE case_number = 'CV2025-002346'), 'Judgment Hearing', '2025-01-30 15:00:00', 'Courtroom 1', 'Default judgment motion', NOW(), NOW());

-- Add a scrape log entry
INSERT INTO scrape_logs (
  scrape_type,
  status,
  started_at,
  completed_at,
  cases_found,
  cases_processed,
  error_message,
  created_at
) VALUES
  ('scheduled', 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', 9, 9, NULL, NOW());

COMMIT;