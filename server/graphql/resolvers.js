const { pool } = require('../database');
const DataLoader = require('dataloader');
const cache = require('../cache');

// DataLoader for batch loading cases
const createCaseLoader = () => new DataLoader(async (caseNumbers) => {
  const query = `
    SELECT * FROM cases 
    WHERE case_number = ANY($1::text[])
  `;
  
  const result = await pool.query(query, [caseNumbers]);
  
  const caseMap = new Map(
    result.rows.map(row => [row.case_number, row])
  );
  
  return caseNumbers.map(num => caseMap.get(num) || null);
});

const resolvers = {
  Query: {
    // Single case with caching
    case: async (_, { case_number }, context) => {
      const caseKey = cache.generateKey('case', { case_number });
      
      const { data } = await cache.withCache(
        caseKey,
        600, // 10 minutes
        async () => {
          if (context.caseLoader) {
            return context.caseLoader.load(case_number);
          }
          // Fallback if no DataLoader in context
          const result = await pool.query(
            'SELECT * FROM cases WHERE case_number = $1',
            [case_number]
          );
          return result.rows[0] || null;
        }
      );
      
      return data;
    },
    
    // List cases with filtering
    cases: async (_, { limit = 100, offset = 0, court_name, case_status }) => {
      const cacheKey = cache.generateKey('cases', { 
        limit, offset, court_name, case_status 
      });
      
      const { data } = await cache.withCache(
        cacheKey,
        60, // 1 minute for lists
        async () => {
          let query = `
            SELECT * FROM cases
            WHERE 1=1
          `;
          const params = [];
          let paramCount = 0;
          
          if (court_name) {
            params.push(court_name);
            query += ` AND court_name = $${++paramCount}`;
          }
          
          if (case_status) {
            params.push(case_status);
            query += ` AND case_status = $${++paramCount}`;
          }
          
          query += ` ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT ${limit} OFFSET ${offset}`;
          
          const result = await pool.query(query, params);
          return result.rows;
        }
      );
      
      return data;
    },
    
    // Optimized dashboard query
    dashboard: async () => {
      const cacheKey = cache.generateKey('dashboard', {});
      
      const { data } = await cache.withCache(
        cacheKey,
        30, // 30 seconds for dashboard
        async () => {
          // Parallel queries for dashboard data
          const [recentCases, upcomingHearings, stats, courtDist] = await Promise.all([
            // Recent cases (limited fields)
            pool.query(`
              SELECT case_number, case_title, court_name, 
                     next_hearing, judge, case_type
              FROM cases
              ORDER BY updated_at DESC NULLS LAST, id DESC
              LIMIT 20
            `),
            
            // Upcoming hearings
            pool.query(`
              SELECT case_number, case_title, next_hearing, 
                     court_name, judge
              FROM cases
              WHERE next_hearing >= CURRENT_DATE
              ORDER BY next_hearing
              LIMIT 10
            `),
            
            // Statistics
            pool.query(`
              SELECT 
                COUNT(*) as total_cases,
                COUNT(DISTINCT court_name) as total_courts,
                COUNT(CASE WHEN next_hearing >= CURRENT_DATE THEN 1 END) as upcoming_hearings,
                COUNT(CASE WHEN DATE(updated_at) = CURRENT_DATE THEN 1 END) as cases_today
              FROM cases
            `),
            
            // Court distribution
            pool.query(`
              SELECT court_name, COUNT(*) as case_count
              FROM cases
              WHERE court_name IS NOT NULL
              GROUP BY court_name
              ORDER BY case_count DESC
            `)
          ]);
          
          return {
            recent_cases: recentCases.rows,
            upcoming_hearings: upcomingHearings.rows,
            statistics: stats.rows[0] || {
              total_cases: 0,
              total_courts: 0,
              upcoming_hearings: 0,
              cases_today: 0
            },
            court_distribution: courtDist.rows
          };
        }
      );
      
      return data;
    },
    
    // Search with caching
    searchCases: async (_, { query }) => {
      const cacheKey = cache.generateKey('search', { query });
      
      const { data } = await cache.withCache(
        cacheKey,
        120, // 2 minutes for search
        async () => {
          const searchQuery = `
            SELECT * FROM cases
            WHERE case_number ILIKE $1
               OR case_title ILIKE $1
               OR judge ILIKE $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 50
          `;
          
          const result = await pool.query(searchQuery, [`%${query}%`]);
          return result.rows;
        }
      );
      
      return data;
    },
    
    statistics: async () => {
      const cacheKey = cache.generateKey('statistics', {});
      
      const { data } = await cache.withCache(
        cacheKey,
        300, // 5 minutes
        async () => {
          const result = await pool.query(`
            SELECT 
              COUNT(*) as total_cases,
              COUNT(DISTINCT court_name) as total_courts,
              COUNT(CASE WHEN next_hearing >= CURRENT_DATE THEN 1 END) as upcoming_hearings,
              COUNT(CASE WHEN DATE(updated_at) = CURRENT_DATE THEN 1 END) as cases_today
            FROM cases
          `);
          
          return result.rows[0] || {
            total_cases: 0,
            total_courts: 0,
            upcoming_hearings: 0,
            cases_today: 0
          };
        }
      );
      
      return data;
    }
  },
  
  // Field resolvers for normalized schema
  Case: {
    // Load parties from case_parties table
    parties: async (case_) => {
      const result = await pool.query(
        'SELECT * FROM case_parties WHERE case_id = $1',
        [case_.id]
      );
      return result.rows;
    },
    
    // Load charges from case_charges table
    charges: async (case_) => {
      const result = await pool.query(
        'SELECT * FROM case_charges WHERE case_id = $1',
        [case_.id]
      );
      return result.rows;
    },
    
    // Load events from case_events table
    events: async (case_) => {
      const result = await pool.query(
        'SELECT * FROM case_events WHERE case_id = $1 ORDER BY event_date',
        [case_.id]
      );
      return result.rows;
    },
    
    // Load documents from case_documents table
    documents: async (case_) => {
      const result = await pool.query(
        'SELECT * FROM case_documents WHERE case_id = $1',
        [case_.id]
      );
      return result.rows;
    },
    
    // Load calendar from case_calendar table
    calendar: async (case_) => {
      const result = await pool.query(
        'SELECT * FROM case_calendar WHERE case_id = $1 ORDER BY hearing_date',
        [case_.id]
      );
      return result.rows;
    },
    
    // Computed fields
    days_until_hearing: (case_) => {
      if (!case_.next_hearing) return null;
      
      const hearing = new Date(case_.next_hearing);
      const today = new Date();
      const diffTime = hearing - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays >= 0 ? diffDays : null;
    },
    
    has_attorney: async (case_) => {
      const result = await pool.query(
        'SELECT COUNT(*) FROM case_parties WHERE case_id = $1 AND attorney IS NOT NULL AND attorney != $2',
        [case_.id, 'TBD']
      );
      return parseInt(result.rows[0].count) > 0;
    },
    
    charge_count: async (case_) => {
      const result = await pool.query(
        'SELECT COUNT(*) FROM case_charges WHERE case_id = $1',
        [case_.id]
      );
      return parseInt(result.rows[0].count);
    },
    
    // No need to remap, case_status is the actual field
  },
  
  // Dashboard field resolvers
  Dashboard: {
    recent_cases: (dashboard) => dashboard.recent_cases || [],
    upcoming_hearings: (dashboard) => dashboard.upcoming_hearings || [],
    statistics: (dashboard) => dashboard.statistics || {
      total_cases: 0,
      total_courts: 0,
      upcoming_hearings: 0,
      cases_today: 0
    },
    court_distribution: (dashboard) => dashboard.court_distribution || []
  }
};

// Export both resolvers and DataLoader factory
module.exports = {
  resolvers,
  createCaseLoader
};