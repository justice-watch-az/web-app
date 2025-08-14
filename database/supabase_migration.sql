--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: get_case_summary(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_case_summary(p_case_number character varying) RETURNS TABLE(case_number character varying, case_title character varying, total_charges bigint, total_parties bigint, next_hearing_date date, next_hearing_event character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.case_number,
        c.case_title,
        COUNT(DISTINCT ch.id) as total_charges,
        COUNT(DISTINCT cp.id) as total_parties,
        MIN(cal.hearing_date) FILTER (WHERE cal.hearing_date >= CURRENT_DATE) as next_hearing_date,
        MIN(cal.event_type) FILTER (WHERE cal.hearing_date >= CURRENT_DATE) as next_hearing_event
    FROM cases c
    LEFT JOIN case_charges ch ON c.id = ch.case_id
    LEFT JOIN case_parties cp ON c.id = cp.case_id
    LEFT JOIN case_calendar cal ON c.id = cal.case_id
    WHERE c.case_number = p_case_number
    GROUP BY c.case_number, c.case_title;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: case_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_charges (
    id integer NOT NULL,
    case_id integer,
    party_name character varying(255),
    ars_code character varying(50),
    description text,
    crime_date timestamp without time zone,
    disposition_code character varying(100),
    disposition_date date,
    disposition text,
    severity character varying(10),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id integer NOT NULL,
    case_number character varying(100) NOT NULL,
    court_id character varying(100) NOT NULL,
    court_name character varying(255),
    case_title character varying(500),
    case_type character varying(100),
    case_status character varying(100),
    filing_date date,
    judge character varying(255),
    location character varying(255),
    case_url character varying(500),
    scraped_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer
);


--
-- Name: active_charges; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_charges AS
 SELECT c.case_number,
    c.case_title,
    ch.party_name,
    ch.ars_code,
    ch.description,
    ch.crime_date,
    ch.disposition
   FROM (public.cases c
     JOIN public.case_charges ch ON ((c.id = ch.case_id)))
  WHERE ((ch.disposition IS NULL) OR (ch.disposition = ''::text))
  ORDER BY c.case_number, ch.ars_code;


--
-- Name: case_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_calendar (
    id integer NOT NULL,
    case_id integer,
    hearing_date date,
    hearing_time time without time zone,
    event_type character varying(255),
    result text,
    location character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: case_calendar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_calendar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_calendar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_calendar_id_seq OWNED BY public.case_calendar.id;


--
-- Name: case_charges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_charges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_charges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_charges_id_seq OWNED BY public.case_charges.id;


--
-- Name: case_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_documents (
    id integer NOT NULL,
    case_id integer,
    document_name character varying(255),
    document_type character varying(100),
    filed_date date,
    filed_by character varying(255),
    document_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: case_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_documents_id_seq OWNED BY public.case_documents.id;


--
-- Name: case_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_events (
    id integer NOT NULL,
    case_id integer,
    event_date date,
    event_type character varying(255),
    event_description text,
    filed_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: case_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_events_id_seq OWNED BY public.case_events.id;


--
-- Name: case_judgments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_judgments (
    id integer NOT NULL,
    case_id integer,
    judgment_date date,
    judgment_type character varying(100),
    judgment_amount numeric(10,2),
    judgment_description text,
    in_favor_of character varying(255),
    against character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: case_judgments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_judgments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_judgments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_judgments_id_seq OWNED BY public.case_judgments.id;


--
-- Name: case_parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_parties (
    id integer NOT NULL,
    case_id integer,
    party_type character varying(50),
    party_name character varying(255),
    relationship character varying(100),
    sex character varying(20),
    attorney character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: case_parties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_parties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_parties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_parties_id_seq OWNED BY public.case_parties.id;


--
-- Name: case_raw_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_raw_data (
    id integer NOT NULL,
    case_id integer,
    raw_data jsonb,
    scraped_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: case_raw_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_raw_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_raw_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.case_raw_data_id_seq OWNED BY public.case_raw_data.id;


--
-- Name: cases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cases_id_seq OWNED BY public.cases.id;


--
-- Name: upcoming_hearings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.upcoming_hearings AS
 SELECT c.case_number,
    c.case_title,
    c.court_name,
    c.judge,
    cal.hearing_date,
    cal.hearing_time,
    cal.event_type,
    cal.location
   FROM (public.cases c
     JOIN public.case_calendar cal ON ((c.id = cal.case_id)))
  WHERE (cal.hearing_date >= CURRENT_DATE)
  ORDER BY cal.hearing_date, cal.hearing_time;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255),
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone,
    is_active boolean DEFAULT true
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: case_calendar id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_calendar ALTER COLUMN id SET DEFAULT nextval('public.case_calendar_id_seq'::regclass);


--
-- Name: case_charges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_charges ALTER COLUMN id SET DEFAULT nextval('public.case_charges_id_seq'::regclass);


--
-- Name: case_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents ALTER COLUMN id SET DEFAULT nextval('public.case_documents_id_seq'::regclass);


--
-- Name: case_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_events ALTER COLUMN id SET DEFAULT nextval('public.case_events_id_seq'::regclass);


--
-- Name: case_judgments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_judgments ALTER COLUMN id SET DEFAULT nextval('public.case_judgments_id_seq'::regclass);


--
-- Name: case_parties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_parties ALTER COLUMN id SET DEFAULT nextval('public.case_parties_id_seq'::regclass);


--
-- Name: case_raw_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_raw_data ALTER COLUMN id SET DEFAULT nextval('public.case_raw_data_id_seq'::regclass);


--
-- Name: cases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases ALTER COLUMN id SET DEFAULT nextval('public.cases_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: case_calendar case_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_calendar
    ADD CONSTRAINT case_calendar_pkey PRIMARY KEY (id);


--
-- Name: case_charges case_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_charges
    ADD CONSTRAINT case_charges_pkey PRIMARY KEY (id);


--
-- Name: case_documents case_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents
    ADD CONSTRAINT case_documents_pkey PRIMARY KEY (id);


--
-- Name: case_events case_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_events
    ADD CONSTRAINT case_events_pkey PRIMARY KEY (id);


--
-- Name: case_judgments case_judgments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_judgments
    ADD CONSTRAINT case_judgments_pkey PRIMARY KEY (id);


--
-- Name: case_parties case_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_parties
    ADD CONSTRAINT case_parties_pkey PRIMARY KEY (id);


--
-- Name: case_raw_data case_raw_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_raw_data
    ADD CONSTRAINT case_raw_data_pkey PRIMARY KEY (id);


--
-- Name: cases cases_case_number_court_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_case_number_court_id_key UNIQUE (case_number, court_id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_case_calendar_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_calendar_case_id ON public.case_calendar USING btree (case_id);


--
-- Name: idx_case_calendar_hearing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_calendar_hearing_date ON public.case_calendar USING btree (hearing_date);


--
-- Name: idx_case_charges_ars_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_charges_ars_code ON public.case_charges USING btree (ars_code);


--
-- Name: idx_case_charges_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_charges_case_id ON public.case_charges USING btree (case_id);


--
-- Name: idx_case_documents_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_documents_case_id ON public.case_documents USING btree (case_id);


--
-- Name: idx_case_events_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_events_case_id ON public.case_events USING btree (case_id);


--
-- Name: idx_case_judgments_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_judgments_case_id ON public.case_judgments USING btree (case_id);


--
-- Name: idx_case_parties_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_parties_case_id ON public.case_parties USING btree (case_id);


--
-- Name: idx_case_parties_party_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_parties_party_type ON public.case_parties USING btree (party_type);


--
-- Name: idx_cases_case_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_case_number ON public.cases USING btree (case_number);


--
-- Name: idx_cases_case_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_case_status ON public.cases USING btree (case_status);


--
-- Name: idx_cases_court_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_court_id ON public.cases USING btree (court_id);


--
-- Name: idx_cases_filing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_filing_date ON public.cases USING btree (filing_date);


--
-- Name: case_calendar case_calendar_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_calendar
    ADD CONSTRAINT case_calendar_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_charges case_charges_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_charges
    ADD CONSTRAINT case_charges_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_documents case_documents_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents
    ADD CONSTRAINT case_documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_events case_events_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_events
    ADD CONSTRAINT case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_judgments case_judgments_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_judgments
    ADD CONSTRAINT case_judgments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_parties case_parties_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_parties
    ADD CONSTRAINT case_parties_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_raw_data case_raw_data_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_raw_data
    ADD CONSTRAINT case_raw_data_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: cases cases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

