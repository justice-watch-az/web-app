const { supabase } = require('./supabase');
const pool = require('../db');

class Database {
  constructor() {
    this.useSupabase = !!supabase;
  }

  async query(text, params = []) {
    if (this.useSupabase) {
      // Convert PostgreSQL query to Supabase
      return this.supabaseQuery(text, params);
    } else {
      // Use local PostgreSQL
      return pool.query(text, params);
    }
  }

  async supabaseQuery(text, params) {
    // Handle common query patterns
    if (text.includes('INSERT INTO users')) {
      const matches = text.match(/INSERT INTO users \((.*?)\) VALUES \((.*?)\) RETURNING \*/);
      if (matches) {
        const columns = matches[1].split(',').map(c => c.trim());
        const values = {};
        columns.forEach((col, i) => {
          values[col] = params[i];
        });
        
        const { data, error } = await supabase
          .from('users')
          .insert([values])
          .select();
        
        if (error) throw error;
        return { rows: data };
      }
    }

    if (text.includes('SELECT * FROM users WHERE email')) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', params[0])
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return { rows: data ? [data] : [] };
    }

    if (text.includes('SELECT * FROM users WHERE id')) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', params[0])
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return { rows: data ? [data] : [] };
    }

    if (text.includes('UPDATE users SET last_login')) {
      const { error } = await supabase
        .from('users')
        .update({ last_login: params[0] })
        .eq('id', params[1]);
      
      if (error) throw error;
      return { rowCount: 1 };
    }

    // Handle cases table queries
    if (text.includes('INSERT INTO cases')) {
      const matches = text.match(/INSERT INTO cases \((.*?)\) VALUES \((.*?)\)/);
      if (matches) {
        const columns = matches[1].split(',').map(c => c.trim());
        const values = {};
        columns.forEach((col, i) => {
          values[col] = params[i];
        });
        
        const { data, error } = await supabase
          .from('cases')
          .upsert([values], { onConflict: 'case_number,court_id' })
          .select();
        
        if (error) throw error;
        return { rows: data };
      }
    }

    if (text.includes('SELECT * FROM cases')) {
      let query = supabase.from('cases').select('*');
      
      if (text.includes('WHERE user_id')) {
        query = query.eq('user_id', params[0]);
      }
      
      if (text.includes('ORDER BY')) {
        query = query.order('scraped_at', { ascending: false });
      }
      
      if (text.includes('LIMIT')) {
        const limitMatch = text.match(/LIMIT (\d+)/);
        if (limitMatch) {
          query = query.limit(parseInt(limitMatch[1]));
        }
      }
      
      const { data, error } = await supabase.rpc('get_cases_with_details', {});
      if (error) throw error;
      return { rows: data };
    }

    // Fallback - log unhandled query
    console.warn('Unhandled Supabase query:', text);
    throw new Error('Query not implemented for Supabase: ' + text);
  }

  async getCasesWithDetails(userId) {
    if (this.useSupabase) {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          case_parties (*),
          case_charges (*),
          case_calendar (*),
          case_documents (*),
          case_events (*),
          case_judgments (*)
        `)
        .eq('user_id', userId)
        .order('scraped_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } else {
      const query = `
        SELECT c.*, 
          json_agg(DISTINCT cp.*) as parties,
          json_agg(DISTINCT ch.*) as charges,
          json_agg(DISTINCT cal.*) as calendar
        FROM cases c
        LEFT JOIN case_parties cp ON c.id = cp.case_id
        LEFT JOIN case_charges ch ON c.id = ch.case_id
        LEFT JOIN case_calendar cal ON c.id = cal.case_id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.scraped_at DESC
      `;
      const result = await pool.query(query, [userId]);
      return result.rows;
    }
  }

  async insertCase(caseData) {
    if (this.useSupabase) {
      const { data, error } = await supabase
        .from('cases')
        .upsert([caseData], { onConflict: 'case_number,court_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      const query = `
        INSERT INTO cases (case_number, court_id, court_name, case_title, case_type, case_status, 
          filing_date, judge, location, case_url, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (case_number, court_id) DO UPDATE
        SET case_title = EXCLUDED.case_title,
            case_status = EXCLUDED.case_status,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const result = await pool.query(query, Object.values(caseData));
      return result.rows[0];
    }
  }

  async insertCaseParty(caseId, partyData) {
    if (this.useSupabase) {
      const { data, error } = await supabase
        .from('case_parties')
        .insert([{ case_id: caseId, ...partyData }])
        .select();
      
      if (error) throw error;
      return data;
    } else {
      const query = `
        INSERT INTO case_parties (case_id, party_type, party_name, relationship, sex, attorney)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await pool.query(query, [caseId, ...Object.values(partyData)]);
    }
  }

  async insertCaseCharge(caseId, chargeData) {
    if (this.useSupabase) {
      const { data, error } = await supabase
        .from('case_charges')
        .insert([{ case_id: caseId, ...chargeData }])
        .select();
      
      if (error) throw error;
      return data;
    } else {
      const query = `
        INSERT INTO case_charges (case_id, party_name, ars_code, description, crime_date, 
          disposition_code, disposition_date, disposition, severity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      await pool.query(query, [caseId, ...Object.values(chargeData)]);
    }
  }

  async insertCaseCalendar(caseId, calendarData) {
    if (this.useSupabase) {
      const { data, error } = await supabase
        .from('case_calendar')
        .insert([{ case_id: caseId, ...calendarData }])
        .select();
      
      if (error) throw error;
      return data;
    } else {
      const query = `
        INSERT INTO case_calendar (case_id, hearing_date, hearing_time, event_type, result, location)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await pool.query(query, [caseId, ...Object.values(calendarData)]);
    }
  }
}

module.exports = new Database();