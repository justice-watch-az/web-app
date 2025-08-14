const logger = require('../utils/logger');

/**
 * Simplified save for Supabase - matches ACTUAL Supabase schema
 */
async function saveCaseToDatabase(caseData, pool, userId = null) {
  try {
    // Generate court_id from court_name if not provided (REQUIRED field)
    const courtId = caseData.court_id || 
      (caseData.court_name ? caseData.court_name.toLowerCase().replace(/\s+justice\s+court/i, '').replace(/\s+/g, '_') : 'maricopa');
    
    // Combine all calendar/charges/judgments into appropriate fields for Supabase schema
    const calendarData = caseData.raw_data?.case_calendar || caseData.raw_data?.calendar || [];
    const chargesData = caseData.raw_data?.disposition_information || caseData.raw_data?.charges || [];
    const partiesData = caseData.raw_data?.party_information || caseData.raw_data?.parties || [];
    
    // Build docket_entries from calendar + charges
    const docketEntries = [
      ...calendarData.map(c => ({
        date: c.date,
        time: c.time,
        description: c.event,
        type: 'calendar',
        result: c.result
      })),
      ...chargesData.map(c => ({
        date: c.disposition_date,
        description: `${c.description} - ${c.disposition || 'Pending'}`,
        type: 'charge',
        ars_code: c.ars_code
      }))
    ];
    
    // Build events array
    const eventsData = [
      ...(caseData.raw_data?.events || []),
      ...(caseData.raw_data?.case_activity || [])
    ];
    
    // Prepare case data matching ACTUAL Supabase columns
    const caseRecord = {
      case_number: caseData.case_number,
      court_id: courtId,  // REQUIRED
      court_name: caseData.court_name || 'Maricopa County Justice Court',
      case_title: caseData.case_title || caseData.raw_data?.case_information?.case_title || 'No Title',
      case_type: caseData.raw_data?.case_information?.case_type || caseData.case_type || 'Criminal',
      status: caseData.raw_data?.case_information?.case_status || caseData.status || 'Active',  // Note: 'status' not 'case_status'
      filing_date: caseData.raw_data?.case_information?.file_date || caseData.filing_date,
      judge: caseData.raw_data?.case_information?.judge || caseData.judge,
      location: caseData.raw_data?.case_information?.location,
      case_url: caseData.case_url || caseData.raw_data?.case_url,
      user_id: userId,
      
      // Store in the ACTUAL JSON columns that exist in Supabase
      parties: JSON.stringify(partiesData),
      docket_entries: JSON.stringify(docketEntries),  // Note: 'docket_entries' not 'calendar'
      next_hearing: calendarData[0]?.date || null,  // First calendar date as next hearing
      events: JSON.stringify(eventsData),
      documents: JSON.stringify(caseData.raw_data?.case_documents || caseData.raw_data?.documents || []),
      raw_data: JSON.stringify(caseData.raw_data || caseData)
    };
    
    // Use Supabase-compatible INSERT with ACTUAL column names
    const result = await pool.query(`
      INSERT INTO cases (
        case_number, court_id, court_name, case_title, case_type, 
        status, filing_date, judge, location, case_url, user_id,
        parties, docket_entries, next_hearing, events, documents, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (case_number, court_id) 
      DO UPDATE SET
        case_title = EXCLUDED.case_title,
        case_type = EXCLUDED.case_type,
        status = EXCLUDED.status,
        filing_date = EXCLUDED.filing_date,
        judge = EXCLUDED.judge,
        location = EXCLUDED.location,
        case_url = EXCLUDED.case_url,
        parties = EXCLUDED.parties,
        docket_entries = EXCLUDED.docket_entries,
        next_hearing = EXCLUDED.next_hearing,
        events = EXCLUDED.events,
        documents = EXCLUDED.documents,
        raw_data = EXCLUDED.raw_data,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      caseRecord.case_number,
      caseRecord.court_id,
      caseRecord.court_name,
      caseRecord.case_title,
      caseRecord.case_type,
      caseRecord.status,
      caseRecord.filing_date,
      caseRecord.judge,
      caseRecord.location,
      caseRecord.case_url,
      caseRecord.user_id,
      caseRecord.parties,
      caseRecord.docket_entries,
      caseRecord.next_hearing,
      caseRecord.events,
      caseRecord.documents,
      caseRecord.raw_data
    ]);
    
    logger.info(`Successfully saved case ${caseData.case_number} to Supabase`);
    return result.rows[0]?.id || Date.now();
    
  } catch (error) {
    logger.error('Error saving case to database:', error);
    // Don't throw - just log and continue
    return null;
  }
}

module.exports = { saveCaseToDatabase };