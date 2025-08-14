const { Pool } = require('pg');

/**
 * Save case data to the new normalized database schema
 */
async function saveCaseToDatabase(caseData, pool, userId = null) {
  // Use pool directly for Supabase compatibility
  const client = pool;
  
  try {
    // Skip transactions for Supabase
    // await client.query('BEGIN');
    
    // Generate court_id from court_name if not provided
    const courtId = caseData.court_id || 
      (caseData.court_name ? caseData.court_name.toLowerCase().replace(/\s+justice\s+court/i, '').replace(/\s+/g, '_') : 'unknown');
    
    // 1. Insert or update main case record
    const caseResult = await client.query(`
      INSERT INTO cases (
        case_number, court_id, court_name, case_title, case_type, 
        case_status, filing_date, judge, location, case_url, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (case_number, court_id) 
      DO UPDATE SET
        case_title = EXCLUDED.case_title,
        case_type = EXCLUDED.case_type,
        case_status = EXCLUDED.case_status,
        filing_date = EXCLUDED.filing_date,
        judge = EXCLUDED.judge,
        location = EXCLUDED.location,
        case_url = EXCLUDED.case_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      caseData.case_number,
      courtId,
      caseData.court_name,
      caseData.case_title,
      caseData.raw_data?.case_information?.case_type || caseData.case_type,
      caseData.raw_data?.case_information?.case_status || caseData.status,
      parseDate(caseData.raw_data?.case_information?.file_date || caseData.filing_date),
      caseData.raw_data?.case_information?.judge || caseData.judge,
      caseData.raw_data?.case_information?.location,
      caseData.case_url || caseData.raw_data?.case_url,
      userId
    ]);
    
    const caseId = caseResult.rows[0].id;
    
    // 2. Delete existing related records (for updates)
    await client.query('DELETE FROM case_parties WHERE case_id = $1', [caseId]);
    await client.query('DELETE FROM case_charges WHERE case_id = $1', [caseId]);
    await client.query('DELETE FROM case_calendar WHERE case_id = $1', [caseId]);
    await client.query('DELETE FROM case_documents WHERE case_id = $1', [caseId]);
    await client.query('DELETE FROM case_events WHERE case_id = $1', [caseId]);
    await client.query('DELETE FROM case_judgments WHERE case_id = $1', [caseId]);
    
    // 3. Insert parties
    const partyInfo = caseData.raw_data?.party_information || caseData.parties || {};
    
    // Insert plaintiff(s)
    if (partyInfo.plaintiff) {
      const plaintiff = partyInfo.plaintiff;
      await client.query(`
        INSERT INTO case_parties (
          case_id, party_type, party_name, relationship, sex, attorney
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        caseId, 'plaintiff',
        plaintiff.party_name || plaintiff,
        plaintiff.relationship,
        plaintiff.sex,
        plaintiff.attorney
      ]);
    }
    
    // Insert defendant(s)
    if (partyInfo.defendant) {
      const defendant = partyInfo.defendant;
      await client.query(`
        INSERT INTO case_parties (
          case_id, party_type, party_name, relationship, sex, attorney
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        caseId, 'defendant',
        defendant.party_name || defendant,
        defendant.relationship,
        defendant.sex,
        defendant.attorney
      ]);
    }
    
    // 4. Insert charges/disposition information
    const charges = caseData.raw_data?.disposition_information || caseData.disposition_information || [];
    for (const charge of charges) {
      // Extract severity from ARS code
      const arsCode = charge.ars_code || '';
      let severity = null;
      if (arsCode.includes('(') && arsCode.includes(')')) {
        severity = arsCode.substring(arsCode.indexOf('(') + 1, arsCode.indexOf(')'));
      }
      
      await client.query(`
        INSERT INTO case_charges (
          case_id, party_name, ars_code, description, crime_date,
          disposition_code, disposition_date, disposition, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        caseId,
        charge.party_name,
        arsCode,
        charge.description,
        parseDateTime(charge.crime_date),
        charge.disposition_code,
        parseDate(charge.disposition_date),
        charge.disposition,
        severity
      ]);
    }
    
    // 5. Insert calendar entries
    const calendar = caseData.raw_data?.case_calendar || [];
    for (const entry of calendar) {
      await client.query(`
        INSERT INTO case_calendar (
          case_id, hearing_date, hearing_time, event_type, result
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        caseId,
        parseDate(entry.date),
        parseTime(entry.time),
        entry.event,
        entry.result
      ]);
    }
    
    // 6. Insert documents (if any)
    const documents = caseData.raw_data?.case_documents || [];
    for (const doc of documents) {
      if (typeof doc === 'object' && doc !== null) {
        await client.query(`
          INSERT INTO case_documents (
            case_id, document_name, document_type, filed_date, filed_by
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          caseId,
          doc.name || doc.document_name,
          doc.type || doc.document_type,
          parseDate(doc.filed_date),
          doc.filed_by
        ]);
      }
    }
    
    // 7. Insert events (if any)
    const events = caseData.raw_data?.events || [];
    for (const event of events) {
      if (typeof event === 'object' && event !== null) {
        await client.query(`
          INSERT INTO case_events (
            case_id, event_date, event_type, event_description
          ) VALUES ($1, $2, $3, $4)
        `, [
          caseId,
          parseDate(event.date || event.event_date),
          event.type || event.event_type,
          event.description || event.event_description
        ]);
      }
    }
    
    // 8. Insert judgments (if any)
    const judgments = caseData.raw_data?.judgments || [];
    for (const judgment of judgments) {
      if (typeof judgment === 'object' && judgment !== null) {
        await client.query(`
          INSERT INTO case_judgments (
            case_id, judgment_date, judgment_type, judgment_description
          ) VALUES ($1, $2, $3, $4)
        `, [
          caseId,
          parseDate(judgment.date || judgment.judgment_date),
          judgment.type || judgment.judgment_type,
          judgment.description || judgment.judgment_description
        ]);
      }
    }
    
    // 9. Save raw data for backup/reference
    // First delete any existing raw data for this case
    await client.query('DELETE FROM case_raw_data WHERE case_id = $1', [caseId]);
    
    // Then insert the new raw data
    await client.query(`
      INSERT INTO case_raw_data (case_id, raw_data, scraped_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
    `, [caseId, JSON.stringify(caseData.raw_data || caseData)]);
    
    await client.query('COMMIT');
    
    console.log(`Successfully saved case ${caseData.case_number} with:`);
    console.log(`  - ${charges.length} charges`);
    console.log(`  - ${calendar.length} calendar entries`);
    console.log(`  - ${documents.length} documents`);
    
    return caseId;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving case to database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper functions
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Handle MM/DD/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      if (year && month && day) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    // Handle YYYY-MM-DD format
    if (dateStr.includes('-') && dateStr.length === 10) {
      return dateStr;
    }
    return null;
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return null;
  }
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  
  try {
    // Handle HH:MM format
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        return `${timeStr}:00`;
      }
      return timeStr;
    }
    return null;
  } catch (error) {
    console.error('Error parsing time:', timeStr, error);
    return null;
  }
}

function parseDateTime(datetimeStr) {
  if (!datetimeStr) return null;
  
  try {
    // Handle "MM/DD/YYYY HH:MM AM/PM" format
    if (datetimeStr.includes('/') && datetimeStr.includes(':')) {
      const datePart = datetimeStr.split(' ')[0];
      const parsed = parseDate(datePart);
      if (parsed) {
        return `${parsed} 00:00:00`;
      }
    }
    return parseDate(datetimeStr);
  } catch (error) {
    console.error('Error parsing datetime:', datetimeStr, error);
    return null;
  }
}

module.exports = {
  saveCaseToDatabase
};