# Justice Watch Database Schema Documentation

## Overview
The database uses a normalized relational schema to store court case data with proper one-to-many relationships. Each data point from the Case History page gets its own record in the appropriate table, allowing for flexible display in the GUI and reporting.

## Table Structure

### 1. `cases` - Main Case Table (One record per case)
- **Purpose**: Stores core case information
- **Key Fields**:
  - `case_number`: Unique case identifier (e.g., TR2025128220)
  - `court_id`: Normalized court identifier (e.g., agua_fria)
  - `case_title`: Full case title (State of Arizona vs [Defendant])
  - `case_type`: Type of case (Criminal Traffic, etc.)
  - `case_status`: Current status (01 - New Case, etc.)
  - `filing_date`: Date case was filed
  - `judge`: Assigned judge name
  - `location`: Court location

### 2. `case_parties` - Parties Table (Multiple per case)
- **Purpose**: Stores all plaintiffs and defendants
- **Relationships**: Many-to-one with `cases`
- **Key Fields**:
  - `party_type`: 'plaintiff' or 'defendant'
  - `party_name`: Full name of party
  - `relationship`: Role in case
  - `sex`: Gender if available
  - `attorney`: Legal representation

### 3. `case_charges` - Charges/Disposition Table (Multiple per case)
- **Purpose**: Stores all criminal charges
- **Relationships**: Many-to-one with `cases`
- **Key Fields**:
  - `ars_code`: Arizona Revised Statutes code (e.g., 28-1381A1 (M1))
  - `description`: Charge description (e.g., DUI-LIQUOR/DRUGS/VAPORS/COMBO)
  - `crime_date`: Date of alleged crime
  - `severity`: Charge level (M1, M2, F1, etc.)
  - `disposition`: Final outcome if available
  - `disposition_date`: Date of disposition

### 4. `case_calendar` - Hearings/Events Table (Multiple per case)
- **Purpose**: Stores all scheduled hearings and events
- **Relationships**: Many-to-one with `cases`
- **Key Fields**:
  - `hearing_date`: Date of hearing
  - `hearing_time`: Time of hearing
  - `event_type`: Type of event (Arraignment Hearing, etc.)
  - `result`: Outcome of hearing
  - `location`: Hearing location if different from main court

### 5. `case_documents` - Documents Table (Multiple per case)
- **Purpose**: Stores references to all case documents
- **Relationships**: Many-to-one with `cases`
- **Key Fields**:
  - `document_name`: Name of document
  - `document_type`: Type/category of document
  - `filed_date`: Date document was filed
  - `filed_by`: Who filed the document

### 6. `case_events` - Events Table (Multiple per case)
- **Purpose**: Stores case events and milestones
- **Relationships**: Many-to-one with `cases`
- **Key Fields**:
  - `event_date`: Date of event
  - `event_type`: Type of event
  - `event_description`: Detailed description

### 7. `case_judgments` - Judgments Table (Multiple per case)
- **Purpose**: Stores court judgments and orders
- **Relationships**: Many-to-one with `cases`
- **Key Fields**:
  - `judgment_date`: Date of judgment
  - `judgment_type`: Type of judgment
  - `judgment_amount`: Monetary amount if applicable
  - `in_favor_of`: Winning party
  - `against`: Losing party

### 8. `case_raw_data` - Raw Data Backup
- **Purpose**: Stores complete scraped data as JSON for reference
- **Relationships**: One-to-one with `cases`
- **Key Fields**:
  - `raw_data`: Complete JSONB data from scraper
  - `scraped_at`: Timestamp of data collection

## Database Views

### `upcoming_hearings`
Shows all future court hearings across all cases, sorted by date.

### `active_charges`
Shows all charges that haven't been disposed of yet.

## Key Features

1. **Normalized Structure**: Each data type has its own table, preventing data duplication
2. **One-to-Many Relationships**: Properly handles multiple charges, parties, hearings per case
3. **Flexible Queries**: Can easily query specific data points for GUI display
4. **Data Integrity**: Foreign key constraints ensure referential integrity
5. **Performance**: Indexed on commonly queried fields
6. **Backup**: Raw data preserved in JSONB format

## GUI Display Capabilities

With this schema, the GUI can:
- Display all charges for a case in a table
- Show upcoming hearings in a calendar view
- List all parties involved with their attorneys
- Track case timeline through events
- Generate reports on specific charge types
- Filter cases by status, judge, or date range
- Show statistics on disposition outcomes

## Example Queries

```sql
-- Get all charges for a case
SELECT * FROM case_charges 
WHERE case_id = (SELECT id FROM cases WHERE case_number = 'TR2025128220');

-- Get next hearing for all active cases
SELECT c.case_number, c.case_title, cal.hearing_date, cal.event_type
FROM cases c
JOIN case_calendar cal ON c.id = cal.case_id
WHERE cal.hearing_date >= CURRENT_DATE
ORDER BY cal.hearing_date;

-- Count charges by type
SELECT ch.description, COUNT(*) as count
FROM case_charges ch
GROUP BY ch.description
ORDER BY count DESC;
```