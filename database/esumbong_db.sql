--
-- PostgreSQL database dump
--

\restrict tGrYHFdCqN3d527lDEDBHW6tl4ktIQZof7xtT1vjfgMGd1qMAk0jQn3L2tTbTBA

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.hearings DROP CONSTRAINT IF EXISTS hearings_complaint_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hearings DROP CONSTRAINT IF EXISTS hearings_assigned_personnel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.complaints DROP CONSTRAINT IF EXISTS complaints_assigned_to_fkey;
ALTER TABLE IF EXISTS ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_hearing_id_fkey;
ALTER TABLE IF EXISTS ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_complaint_id_fkey;
ALTER TABLE IF EXISTS ONLY public.personnel DROP CONSTRAINT IF EXISTS personnel_pkey;
ALTER TABLE IF EXISTS ONLY public.personnel DROP CONSTRAINT IF EXISTS personnel_email_key;
ALTER TABLE IF EXISTS ONLY public.hearings DROP CONSTRAINT IF EXISTS hearings_pkey;
ALTER TABLE IF EXISTS ONLY public.complaints DROP CONSTRAINT IF EXISTS complaints_reference_number_key;
ALTER TABLE IF EXISTS ONLY public.complaints DROP CONSTRAINT IF EXISTS complaints_pkey;
ALTER TABLE IF EXISTS ONLY public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_pkey;
ALTER TABLE IF EXISTS public.personnel ALTER COLUMN personnel_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.hearings ALTER COLUMN hearing_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.complaints ALTER COLUMN complaint_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.activity_logs ALTER COLUMN log_id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.personnel_personnel_id_seq;
DROP TABLE IF EXISTS public.personnel;
DROP SEQUENCE IF EXISTS public.hearings_hearing_id_seq;
DROP TABLE IF EXISTS public.hearings;
DROP SEQUENCE IF EXISTS public.complaints_complaint_id_seq;
DROP TABLE IF EXISTS public.complaints;
DROP SEQUENCE IF EXISTS public.activity_logs_log_id_seq;
DROP TABLE IF EXISTS public.activity_logs;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    log_id integer NOT NULL,
    complaint_id integer NOT NULL,
    hearing_id integer,
    activity character varying(100) NOT NULL,
    previous_status character varying(40),
    new_status character varying(40),
    actions_taken text,
    next_steps text,
    resident_instructions text,
    communication_channel character varying(30),
    remarks text,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: activity_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_log_id_seq OWNED BY public.activity_logs.log_id;


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaints (
    complaint_id integer NOT NULL,
    reference_number character varying(30) NOT NULL,
    resident_name character varying(120) NOT NULL,
    contact_number character varying(30),
    category character varying(80) NOT NULL,
    incident_date date,
    incident_time time without time zone,
    incident_location text NOT NULL,
    persons_involved text,
    description text NOT NULL,
    submission_channel character varying(20) DEFAULT 'Walk-In'::character varying,
    verification_status character varying(30) DEFAULT 'Ready for Verification'::character varying,
    status character varying(40) DEFAULT 'Received'::character varying,
    priority character varying(20) DEFAULT 'Normal'::character varying,
    assigned_to integer,
    routing_date date,
    decision character varying(60),
    routing_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resident_address text,
    purok_location text
);


--
-- Name: complaints_complaint_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.complaints_complaint_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: complaints_complaint_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.complaints_complaint_id_seq OWNED BY public.complaints.complaint_id;


--
-- Name: hearings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hearings (
    hearing_id integer NOT NULL,
    complaint_id integer NOT NULL,
    hearing_type character varying(60) DEFAULT 'Initial Hearing'::character varying,
    hearing_date date NOT NULL,
    hearing_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 60,
    hearing_location character varying(100) NOT NULL,
    assigned_personnel_id integer NOT NULL,
    status character varying(30) DEFAULT 'Scheduled'::character varying,
    notify_resident boolean DEFAULT true,
    additional_instructions text,
    original_hearing_date date,
    original_hearing_time time without time zone,
    reschedule_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: hearings_hearing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hearings_hearing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hearings_hearing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hearings_hearing_id_seq OWNED BY public.hearings.hearing_id;


--
-- Name: personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel (
    personnel_id integer NOT NULL,
    full_name character varying(120) NOT NULL,
    email character varying(120) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT personnel_role_check CHECK (((role)::text = ANY ((ARRAY['Desk Staff'::character varying, 'Barangay Secretary'::character varying, 'Barangay Captain'::character varying, 'Kagawad'::character varying])::text[])))
);


--
-- Name: personnel_personnel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personnel_personnel_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personnel_personnel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personnel_personnel_id_seq OWNED BY public.personnel.personnel_id;


--
-- Name: activity_logs log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN log_id SET DEFAULT nextval('public.activity_logs_log_id_seq'::regclass);


--
-- Name: complaints complaint_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints ALTER COLUMN complaint_id SET DEFAULT nextval('public.complaints_complaint_id_seq'::regclass);


--
-- Name: hearings hearing_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hearings ALTER COLUMN hearing_id SET DEFAULT nextval('public.hearings_hearing_id_seq'::regclass);


--
-- Name: personnel personnel_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel ALTER COLUMN personnel_id SET DEFAULT nextval('public.personnel_personnel_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_logs (log_id, complaint_id, hearing_id, activity, previous_status, new_status, actions_taken, next_steps, resident_instructions, communication_channel, remarks, updated_by, created_at) FROM stdin;
1	2	1	Hearing schedule created	\N	Scheduled	\N	\N	\N	\N	Initial Hearing created for BC-2025-0042.	1	2026-11-24 10:38:32.001672
2	1	\N	Complaint status updated	Under Review	Submitted	\N	\N	\N	\N	Date of action: 2026-11-24\nCommunication channel: In-Person\nResident message: \nResident acknowledgment: Acknowledged	1	2026-11-24 12:15:49.737409
3	2	\N	Complaint Details Updated	Hearing Scheduled	Hearing Scheduled	\N	\N	\N	\N	Updated resident name, resident address and purok/location.	1	2026-11-24 12:37:44.506133
4	2	2	Hearing Scheduled	\N	Hearing Scheduled	\N	\N	\N	\N	2026-11-26 at 16:11 (Barangay Mediation Room)	1	2026-11-24 13:08:56.638512
\.


--
-- Data for Name: complaints; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.complaints (complaint_id, reference_number, resident_name, contact_number, category, incident_date, incident_time, incident_location, persons_involved, description, submission_channel, verification_status, status, priority, assigned_to, routing_date, decision, routing_notes, created_at, resident_address, purok_location) FROM stdin;
1	BC-2025-0047	Joel Mendoza	+63 917 625 1840	Garbage / Sanitation	2025-03-16	22:30:00	Purok 4, Maharlika Street, Barangay Poblacion	Carlo Mendoza and two unidentified individuals	Improperly disposed waste beside the Purok 5 pathway.	Walk-In	Verified	Submitted	Normal	2	\N	\N	\N	2026-11-24 10:38:32.001672	\N	\N
2	BC-2025-0042	Brylle Villanueva	+63 918 555 0192	Noise / Public Disturbance	2025-02-28	21:00:00	Barangay Poblacion	Unidentified neighbors	Repeated excessive noise and disruptive behavior were reported near the resident's home during late evening hours.	Walk-In	Verified	Hearing Scheduled	Normal	3	\N	\N	\N	2026-11-24 10:38:32.001672	Barangay Poblacion	Barangay Poblacion
\.


--
-- Data for Name: hearings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hearings (hearing_id, complaint_id, hearing_type, hearing_date, hearing_time, duration_minutes, hearing_location, assigned_personnel_id, status, notify_resident, additional_instructions, original_hearing_date, original_hearing_time, reschedule_reason, created_at) FROM stdin;
1	2	Initial Hearing	2025-03-05	09:00:00	60	Barangay Mediation Room	3	Scheduled	t	\N	\N	\N	\N	2026-11-24 10:38:32.001672
2	2	Initial Hearing	2026-11-26	16:11:00	60	Barangay Mediation Room	3	Scheduled	t		\N	\N	\N	2026-11-24 13:08:56.628737
\.


--
-- Data for Name: personnel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personnel (personnel_id, full_name, email, password_hash, role, created_at) FROM stdin;
1	Maria Santos	secretary@demo.local	demo1234	Barangay Secretary	2026-11-24 10:38:32.001672
2	Hon. Roberto Dela Cruz	captain@demo.local	demo1234	Barangay Captain	2026-11-24 10:38:32.001672
3	Kagawad Leonardo Ramos	ramos@demo.local	demo1234	Kagawad	2026-11-24 10:38:32.001672
\.


--
-- Name: activity_logs_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_logs_log_id_seq', 4, true);


--
-- Name: complaints_complaint_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.complaints_complaint_id_seq', 2, true);


--
-- Name: hearings_hearing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hearings_hearing_id_seq', 2, true);


--
-- Name: personnel_personnel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.personnel_personnel_id_seq', 3, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (log_id);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (complaint_id);


--
-- Name: complaints complaints_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_reference_number_key UNIQUE (reference_number);


--
-- Name: hearings hearings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hearings
    ADD CONSTRAINT hearings_pkey PRIMARY KEY (hearing_id);


--
-- Name: personnel personnel_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_email_key UNIQUE (email);


--
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (personnel_id);


--
-- Name: activity_logs activity_logs_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(complaint_id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_hearing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_hearing_id_fkey FOREIGN KEY (hearing_id) REFERENCES public.hearings(hearing_id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.personnel(personnel_id);


--
-- Name: complaints complaints_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.personnel(personnel_id);


--
-- Name: hearings hearings_assigned_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hearings
    ADD CONSTRAINT hearings_assigned_personnel_id_fkey FOREIGN KEY (assigned_personnel_id) REFERENCES public.personnel(personnel_id);


--
-- Name: hearings hearings_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hearings
    ADD CONSTRAINT hearings_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(complaint_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict tGrYHFdCqN3d527lDEDBHW6tl4ktIQZof7xtT1vjfgMGd1qMAk0jQn3L2tTbTBA

