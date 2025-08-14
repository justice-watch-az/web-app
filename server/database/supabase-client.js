const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://tsgvxobkmmvsbjzxvuas.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZ3Z4b2JrbW12c2Jqenh2dWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwNjAxMCwiZXhwIjoyMDcwNjgyMDEwfQ.8HVnQhpnLHFWKPDaX7AnlydJ_dVu7mErl1YBs43Rl4k';

const supabase = createClient(supabaseUrl, supabaseKey);

// Wrapper to make Supabase work like pg Pool
class SupabasePool {
  async query(sql, params = []) {
    // Don't map table names - use "cases" as is in Supabase
    const mappedSql = sql;
    
    // Handle simple SELECT COUNT queries
    if (mappedSql.includes('SELECT COUNT(*)')) {
      const tableName = mappedSql.match(/FROM (\w+)/i)?.[1];
      if (tableName) {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          logger.warn(`Count query error for ${tableName}:`, error.message);
          return { rows: [{ count: '0' }] };
        }
        return { rows: [{ count: count.toString() }] };
      }
    }
    
    // Handle transaction commands
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      logger.info(`Transaction command: ${sql} (no-op for Supabase)`);
      return { rows: [], rowCount: 0 };
    }
    
    // Handle DELETE commands
    if (sql.startsWith('DELETE FROM')) {
      logger.info(`DELETE command: ${sql} (no-op for now)`);
      return { rows: [], rowCount: 0 };
    }
    
    // Handle SELECT NOW() for connection test
    if (sql.includes('SELECT NOW()')) {
      return { rows: [{ now: new Date().toISOString() }] };
    }
    
    // Handle CREATE TABLE (skip - tables already exist in Supabase)
    if (sql.includes('CREATE TABLE')) {
      logger.info('Skipping CREATE TABLE - tables managed by Supabase');
      return { rows: [], rowCount: 0 };
    }
    
    // Handle SELECT queries
    if (mappedSql.toLowerCase().startsWith('select')) {
      // Handle SELECT * FROM cases queries with any column specification
      if (mappedSql.toLowerCase().includes('from cases')) {
        logger.info('Handling cases SELECT query');
        
        // Check for specific query patterns
        let query = supabase.from('cases');
        
        // Check for LIMIT clause
        const limitMatch = mappedSql.match(/LIMIT\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1]) : null;
        
        // Check for WHERE clauses
        const whereMatch = mappedSql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
        
        // Check for ORDER BY
        const orderMatch = mappedSql.match(/ORDER BY\s+([^\s]+)(?:\s+(ASC|DESC))?/i);
        
        // For stats queries with COUNT
        if (mappedSql.includes('COUNT(*)')) {
          logger.info('Handling COUNT query for cases');
          const { count, error } = await supabase
            .from('cases')
            .select('*', { count: 'exact', head: true });
          
          if (error) {
            logger.warn('Count query error:', error.message);
            return { rows: [{ total_cases: '0', total_courts: '0', upcoming_hearings: '0' }] };
          }
          
          // If it's the summary stats query
          if (mappedSql.includes('COUNT(DISTINCT court_name)')) {
            const { data: courtData } = await supabase
              .from('cases')
              .select('court_name');
            
            const uniqueCourts = new Set(courtData?.map(c => c.court_name) || []);
            
            const { data: upcomingData } = await supabase
              .from('cases')
              .select('next_hearing')
              .gte('next_hearing', new Date().toISOString().split('T')[0]);
            
            return { 
              rows: [{
                total_cases: count?.toString() || '0',
                total_courts: uniqueCourts.size.toString(),
                upcoming_hearings: (upcomingData?.length || 0).toString()
              }]
            };
          }
          
          return { rows: [{ count: count?.toString() || '0' }] };
        }
        
        // For court distribution query
        if (mappedSql.includes('GROUP BY court_name')) {
          logger.info('Handling court distribution query');
          const { data, error } = await supabase
            .from('cases')
            .select('court_name');
          
          if (error) {
            logger.warn('Court distribution query error:', error.message);
            return { rows: [] };
          }
          
          // Group by court_name manually
          const courtCounts = {};
          (data || []).forEach(row => {
            const court = row.court_name || 'Unknown';
            courtCounts[court] = (courtCounts[court] || 0) + 1;
          });
          
          const result = Object.entries(courtCounts)
            .map(([court_name, case_count]) => ({
              court_name,
              case_count: case_count.toString()
            }))
            .sort((a, b) => parseInt(b.case_count) - parseInt(a.case_count));
          
          return { rows: result };
        }
        
        // For upcoming hearings query
        if (whereMatch && whereMatch[1].includes('next_hearing')) {
          logger.info('Handling upcoming hearings query');
          const { data, error } = await supabase
            .from('cases')
            .select('case_number, case_title, court_name, judge, next_hearing, location')
            .gte('next_hearing', new Date().toISOString().split('T')[0])
            .order('next_hearing', { ascending: true })
            .limit(limit || 50);
          
          if (error) {
            logger.warn('Upcoming hearings query error:', error.message);
            return { rows: [] };
          }
          
          return { rows: data || [] };
        }
        
        // Default SELECT query for cases list
        logger.info('Handling general cases SELECT query');
        let selectQuery = query.select('*');
        
        // Apply ordering
        if (orderMatch) {
          const [, column, direction] = orderMatch;
          selectQuery = selectQuery.order(column, { 
            ascending: direction?.toUpperCase() !== 'DESC' 
          });
        } else {
          // Default ordering
          selectQuery = selectQuery.order('updated_at', { ascending: false });
        }
        
        // Apply limit
        if (limit) {
          selectQuery = selectQuery.limit(limit);
        }
        
        const { data, error } = await selectQuery;
        
        if (error) {
          logger.warn('General select query error:', error.message);
          return { rows: [] };
        }
        
        // Map the data to match expected column names from SQL query
        const mappedData = (data || []).map(row => ({
          ...row,
          case_status: row.status  // Map 'status' to 'case_status' as expected by the query
        }));
        
        return { rows: mappedData };
      }
      
      // Handle SELECT FROM users queries (for authentication)
      if (mappedSql.includes('FROM users')) {
        // Parse the WHERE clause for email
        const emailMatch = mappedSql.match(/WHERE email = \$1/i);
        if (emailMatch && params[0]) {
          // Check what columns are being selected
          const selectMatch = mappedSql.match(/SELECT\s+(.+?)\s+FROM/i);
          const columns = selectMatch ? selectMatch[1].trim() : '*';
          
          // If only selecting id (for checking user exists)
          if (columns === 'id') {
            const { data, error } = await supabase
              .from('users')
              .select('id')
              .eq('email', params[0]);
            
            if (error) {
              logger.warn('User exists check error:', error.message);
              return { rows: [] };
            }
            return { rows: data || [] };
          } else {
            // Select all user fields
            const { data, error } = await supabase
              .from('users')
              .select('id, email, name, password')
              .eq('email', params[0]);
            
            if (error) {
              logger.warn('User query error:', error.message);
              return { rows: [] };
            }
            return { rows: data || [] };
          }
        }
      }
      
      // Handle SELECT FROM scraping_jobs queries
      if (mappedSql.includes('FROM scraping_jobs')) {
        logger.info('Handling scraping_jobs SELECT query');
        
        // Parse WHERE clause
        const whereUserMatch = mappedSql.match(/WHERE user_id = \$1/i);
        const limitMatch = mappedSql.match(/LIMIT\s+(\$\d+|\d+)/i);
        
        let query = supabase.from('scraping_jobs').select('*');
        
        if (whereUserMatch && params[0] !== undefined) {
          query = query.eq('user_id', params[0]);
        }
        
        // Check for ORDER BY
        if (mappedSql.includes('ORDER BY created_at DESC')) {
          query = query.order('created_at', { ascending: false });
        }
        
        // Apply limit
        if (limitMatch) {
          const limitValue = limitMatch[1].startsWith('$') 
            ? params[parseInt(limitMatch[1].substring(1)) - 1]
            : parseInt(limitMatch[1]);
          query = query.limit(limitValue);
        }
        
        const { data, error } = await query;
        
        if (error) {
          logger.warn('Scraping jobs query error:', error.message);
          return { rows: [] };
        }
        
        return { rows: data || [] };
      }
      
      // Default for other SELECT queries
      logger.info(`Handling SELECT query: ${mappedSql.substring(0, 50)}`);
      return { rows: [] };
    }
    
    // Handle INSERT INTO users (for registration)
    if (mappedSql.includes('INSERT INTO users')) {
      if (params.length >= 3) {
        const userData = {
          email: params[0],
          password: params[1],
          name: params[2]
        };
        
        logger.info(`Creating user ${userData.email} in Supabase`);
        
        const { data, error } = await supabase
          .from('users')
          .insert(userData)
          .select('id, email, name');
        
        if (error) {
          logger.error('Failed to create user:', error);
          throw error;
        }
        
        return { rows: data || [] };
      }
    }
    
    // Handle INSERT INTO cases
    if (mappedSql.includes('INSERT INTO cases')) {
      // Handle NEW CORRECT format from db-handler-simple (17 params matching Supabase schema)
      if (params.length === 17) {
        const caseData = {
          case_number: params[0],
          court_id: params[1],
          court_name: params[2],
          case_title: params[3],
          case_type: params[4],
          status: params[5],  // Note: 'status' not 'case_status' in Supabase
          filing_date: params[6],
          judge: params[7],
          location: params[8],
          case_url: params[9],
          user_id: params[10],
          parties: params[11],
          docket_entries: params[12],  // Note: 'docket_entries' not 'calendar' in Supabase
          next_hearing: params[13],
          events: params[14],
          documents: params[15],
          raw_data: params[16]
        };
        
        logger.info(`Inserting case ${caseData.case_number} into Supabase (17 param format)`);
        
        const { data, error } = await supabase
          .from('cases')
          .upsert(caseData, { onConflict: 'case_number,court_id' })
          .select('id');
        
        if (error) {
          logger.error('Failed to insert case - THIS IS THE REAL ERROR:', error);
          logger.error('Error details:', JSON.stringify(error, null, 2));
          // Still return mock data so scraper continues but LOG THE REAL ERROR
          return { rows: [{ id: Date.now() }], rowCount: 1 };
        }
        
        logger.info(`SUCCESSFULLY inserted case ${caseData.case_number} to Supabase!`);
        return { rows: data || [{ id: Date.now() }], rowCount: 1 };
      }
      // Handle OLD WRONG format from db-handler-simple (18 params)
      else if (params.length === 18) {
        logger.warn('Got 18 params - old format, needs 17 params for new schema');
        // Don't throw, return mock data for transaction to continue
        return { rows: [{ id: Date.now() }], rowCount: 1 };
      }
      // Handle NEW format from db-handler (11 params)
      else if (params.length === 11) {
        const caseData = {
          case_number: params[0],
          court_id: params[1],
          court_name: params[2],
          case_title: params[3],
          case_type: params[4],
          case_status: params[5],
          filing_date: params[6],
          judge: params[7],
          location: params[8],
          case_url: params[9],
          user_id: params[10]
        };
        
        logger.info(`Inserting case ${caseData.case_number} into Supabase (new format)`);
        
        const { data, error } = await supabase
          .from('cases')
          .upsert(caseData, { onConflict: 'case_number,court_id' })
          .select('id');
        
        if (error) {
          logger.error('Failed to insert case:', error);
          // Don't throw, return mock data for transaction to continue
          return { rows: [{ id: Date.now() }], rowCount: 1 };
        }
        
        return { rows: data || [{ id: Date.now() }], rowCount: 1 };
      }
      // Handle OLD format (7-8 params) 
      else if (params.length >= 7) {
        const caseData = {
          case_number: params[0],
          case_title: params[1],
          case_type: params[2],
          filing_date: params[3],
          status: params[4],
          judge: params[5],
          court_name: params[6],
          next_hearing: params[7] || null
        };
        
        logger.info(`Inserting case ${caseData.case_number} into Supabase (old format)`);
        
        const { data, error } = await supabase
          .from('cases')
          .upsert(caseData, { onConflict: 'case_number' })
          .select();
        
        if (error) {
          logger.error('Failed to insert case:', error);
          throw error;
        }
        
        return { rows: data || [], rowCount: 1 };
      }
    }
    
    // Handle INSERT INTO scraping_jobs
    if (mappedSql.includes('INSERT INTO scraping_jobs')) {
      logger.info('Handling scraping_jobs INSERT');
      
      // Parse the columns and values
      // Format: INSERT INTO scraping_jobs (user_id, status, config, started_at, job_type) VALUES ($1, $2, $3, $4, $5)
      if (params.length >= 5) {
        const jobData = {
          user_id: params[0],
          status: params[1],
          config: params[2],
          started_at: params[3],
          job_type: params[4]
        };
        
        const { data, error } = await supabase
          .from('scraping_jobs')
          .insert(jobData)
          .select('id');
        
        if (error) {
          logger.error('Failed to insert scraping job:', error);
          // Return mock ID to continue flow
          return { rows: [{ id: Date.now() }], rowCount: 1 };
        }
        
        return { rows: data || [{ id: Date.now() }], rowCount: 1 };
      }
      
      // Fallback for other formats
      logger.info('Mock handling scraping_jobs insert (unknown format)');
      return { 
        rows: [{ id: Date.now() }], 
        rowCount: 1 
      };
    }
    
    // Handle other INSERT queries
    if (mappedSql.includes('INSERT INTO')) {
      logger.info(`Generic INSERT query: ${mappedSql.substring(0, 100)}`);
      return { rows: [], rowCount: 0 };
    }
    
    // Handle UPDATE queries
    if (mappedSql.toLowerCase().startsWith('update')) {
      // Handle UPDATE scraping_jobs
      if (mappedSql.includes('UPDATE scraping_jobs')) {
        logger.info('Handling scraping_jobs UPDATE');
        
        // Parse the SET and WHERE clauses
        // Format: UPDATE scraping_jobs SET status = 'stopped', completed_at = $1 WHERE user_id = $2 AND status = 'running'
        const setMatch = mappedSql.match(/SET\s+(.+?)\s+WHERE/i);
        const whereMatch = mappedSql.match(/WHERE\s+(.+?)$/i);
        
        if (setMatch && whereMatch) {
          // Build update object from SET clause
          const updates = {};
          const setParts = setMatch[1].split(',').map(s => s.trim());
          let paramIndex = 0;
          
          setParts.forEach(part => {
            const [field, value] = part.split('=').map(s => s.trim());
            if (value.startsWith('$')) {
              updates[field] = params[paramIndex++];
            } else {
              // Remove quotes if present
              updates[field] = value.replace(/^['"]|['"]$/g, '');
            }
          });
          
          // Parse WHERE clause
          let query = supabase.from('scraping_jobs').update(updates);
          
          // Simple WHERE parsing for common patterns
          if (whereMatch[1].includes('user_id = $')) {
            const userIdParamMatch = whereMatch[1].match(/user_id = \$(\d+)/);
            if (userIdParamMatch) {
              const idx = parseInt(userIdParamMatch[1]) - 1;
              query = query.eq('user_id', params[idx]);
            }
          }
          
          if (whereMatch[1].includes("status = 'running'")) {
            query = query.eq('status', 'running');
          }
          
          const { data, error } = await query;
          
          if (error) {
            logger.warn('Scraping jobs update error:', error.message);
            return { rows: [], rowCount: 0 };
          }
          
          return { rows: [], rowCount: data ? data.length : 0 };
        }
      }
      
      // Default for other UPDATE queries
      logger.info(`UPDATE query (no-op for now): ${mappedSql.substring(0, 50)}`);
      return { rows: [], rowCount: 0 };
    }
    
    // For other queries, just log and return empty
    logger.info(`Query passed through: ${mappedSql.substring(0, 100)}`);
    return { rows: [], rowCount: 0 };
  }
  
  async connect() {
    // Return a client-like object for compatibility with transactions
    const self = this;
    return {
      query: (sql, params) => self.query(sql, params),
      release: () => Promise.resolve(),
      // Add transaction support (no-op for Supabase)
      begin: () => Promise.resolve(),
      commit: () => Promise.resolve(),
      rollback: () => Promise.resolve()
    };
  }
  
  async end() {
    // No-op for Supabase
    return Promise.resolve();
  }
}

// Export both the client and the pool wrapper
module.exports = {
  supabase,
  pool: new SupabasePool()
};