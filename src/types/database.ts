// Generated type definitions for Supabase database schema
// Based on /supabase/migrations/20250117_justice_watch_schema.sql

export interface Database {
  public: {
    Tables: {
      cases: {
        Row: {
          id: string;
          case_number: string;
          court_name: string | null;
          case_title: string | null;
          case_type: string | null;
          status: string | null;
          filing_date: string | null;
          judge: string | null;
          location: string | null;
          next_hearing: string | null;
          case_url: string | null;
          raw_data: any | null;
          scraped_at: string;
          updated_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cases']['Row'], 'id' | 'scraped_at' | 'updated_at' | 'created_at'> & {
          id?: string;
          scraped_at?: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cases']['Insert']>;
      };
      case_parties: {
        Row: {
          id: string;
          case_id: string;
          party_type: 'plaintiff' | 'defendant';
          party_name: string | null;
          relationship: string | null;
          sex: string | null;
          attorney: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['case_parties']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['case_parties']['Insert']>;
      };
      case_charges: {
        Row: {
          id: string;
          case_id: string;
          ars_code: string | null;
          description: string | null;
          crime_date: string | null;
          severity: string | null;
          disposition: string | null;
          disposition_date: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['case_charges']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['case_charges']['Insert']>;
      };
      case_calendar: {
        Row: {
          id: string;
          case_id: string;
          hearing_date: string | null;
          hearing_time: string | null;
          event_type: string | null;
          result: string | null;
          location: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['case_calendar']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['case_calendar']['Insert']>;
      };
      scrape_logs: {
        Row: {
          id: string;
          scrape_type: string;
          status: string;
          courts_processed: number | null;
          cases_found: number | null;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scrape_logs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['scrape_logs']['Insert']>;
      };
      mcso_bookings: {
        Row: {
          id: string;
          booking_number: string;
          first_name: string | null;
          last_name: string | null;
          charges: string[] | null;
          charges_raw: string | null;
          arresting_agency: string | null;
          is_dui: boolean | null;
          mugshot_b64: string | null;
          source: string | null;
          first_seen_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['mcso_bookings']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['mcso_bookings']['Insert']>;
      };
      scrape_state: {
        Row: {
          key: string;
          value: string | null;
          updated_at: string | null;
        };
        Insert: Database['public']['Tables']['scrape_state']['Row'];
        Update: Partial<Database['public']['Tables']['scrape_state']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Type aliases for easier use
export type Case = Database['public']['Tables']['cases']['Row'];
export type CaseParty = Database['public']['Tables']['case_parties']['Row'];
export type CaseCharge = Database['public']['Tables']['case_charges']['Row'];
export type CaseCalendar = Database['public']['Tables']['case_calendar']['Row'];
export type ScrapeLog = Database['public']['Tables']['scrape_logs']['Row'];
export type McsoBooking = Database['public']['Tables']['mcso_bookings']['Row'];
export type ScrapeState = Database['public']['Tables']['scrape_state']['Row'];

// Extended types with relationships
export interface CaseWithRelations extends Case {
  case_parties?: CaseParty[];
  case_charges?: CaseCharge[];
  case_calendar?: CaseCalendar[];
}

// Legacy compatibility types (for existing components)
export interface CaseSummary {
  case_number: string;
  court_name: string;
  case_title: string;
  case_type: string;
  status: string;
  filing_date: string;
  judge: string;
  location: string;
  next_hearing: string | null;
  parties: string; // JSON string for legacy compatibility
  docket_entries: string; // JSON string for legacy compatibility
}

export interface Statistics {
  total_cases: number;
  cases_by_court: Record<string, number>;
  cases_by_type: Record<string, number>;
  charges_breakdown: Record<string, number>;
  recent_cases: number;
  upcoming_hearings: number;
}