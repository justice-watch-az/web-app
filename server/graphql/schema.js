const typeDefs = `#graphql
  scalar Date
  scalar JSON

  type Case {
    id: ID!
    case_number: String!
    court_id: Int
    court_name: String
    case_title: String
    case_type: String
    case_status: String
    filing_date: Date
    judge: String
    location: String
    case_url: String
    next_hearing: Date
    
    # Parsed JSONB fields
    parties: [Party!]!
    charges: [Charge!]!
    events: [Event!]!
    documents: [Document!]!
    calendar: [CalendarEntry!]!
    
    # Computed fields
    days_until_hearing: Int
    has_attorney: Boolean
    charge_count: Int
  }
  
  type Party {
    party_type: String
    party_name: String
    relationship: String
    sex: String
    attorney: String
  }
  
  type Charge {
    ars_code: String
    description: String
    severity: String
    crime_date: Date
    disposition: String
  }
  
  type Event {
    event_date: Date
    event_type: String
    event_description: String
  }
  
  type Document {
    document_name: String
    document_type: String
    filed_date: Date
    filed_by: String
  }
  
  type CalendarEntry {
    date: Date
    time: String
    event: String
    result: String
  }
  
  type Dashboard {
    recent_cases(limit: Int = 20): [Case!]!
    upcoming_hearings(limit: Int = 10): [HearingPreview!]!
    statistics: Statistics!
    court_distribution: [CourtStats!]!
  }
  
  type HearingPreview {
    case_number: String!
    case_title: String
    next_hearing: Date!
    court_name: String
    judge: String
  }
  
  type Statistics {
    total_cases: Int!
    total_courts: Int!
    upcoming_hearings: Int!
    cases_today: Int!
  }
  
  type CourtStats {
    court_name: String!
    case_count: Int!
  }
  
  type Query {
    # Single case
    case(case_number: String!): Case
    
    # List cases
    cases(
      limit: Int = 100
      offset: Int = 0
      court_name: String
      case_status: String
    ): [Case!]!
    
    # Optimized dashboard
    dashboard: Dashboard!
    
    # Search
    searchCases(query: String!): [Case!]!
    
    # Statistics
    statistics: Statistics!
  }
`;

module.exports = typeDefs;