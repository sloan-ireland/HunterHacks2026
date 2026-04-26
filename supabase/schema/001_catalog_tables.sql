create table if not exists institutions (
  institution_id text primary key,
  name text,
  source_value text
);

create table if not exists terms (
  term_id text primary key,
  term_value text,
  name text,
  year integer,
  season text
);

create table if not exists subjects (
  subject_id text primary key,
  code text,
  name text
);

create table if not exists courses (
  course_id text primary key,
  institution_id text references institutions(institution_id) on delete cascade,
  term_id text references terms(term_id) on delete cascade,
  subject_id text references subjects(subject_id) on delete cascade,
  subject text,
  course_number text,
  code text,
  title text,
  career text,
  units_raw text,
  min_units numeric,
  max_units numeric,
  class_components text,
  grading text,
  prerequisites text,
  corequisites text,
  pre_or_corequisites text,
  enrollment_requirements text,
  descriptions jsonb not null default '[]'::jsonb,
  statuses jsonb not null default '[]'::jsonb,
  section_count integer not null default 0
);

create table if not exists sections (
  section_id text primary key,
  course_id text references courses(course_id) on delete cascade,
  institution_id text references institutions(institution_id) on delete cascade,
  term_id text references terms(term_id) on delete cascade,
  subject_id text references subjects(subject_id) on delete cascade,
  class_number text,
  section text,
  section_code text,
  section_type text,
  status text,
  session text,
  instruction_mode text,
  career text,
  units_raw text,
  min_units numeric,
  max_units numeric,
  class_components text,
  grading text,
  location text,
  campus text,
  dates_raw text,
  start_date date,
  end_date date,
  class_notes text,
  description text,
  course_topic text,
  details_url text,
  enrollment_requirements text,
  prerequisites text,
  corequisites text,
  pre_or_corequisites text
);

create table if not exists meetings (
  meeting_id text primary key,
  section_id text references sections(section_id) on delete cascade,
  days_and_times_raw text,
  days_raw text,
  days jsonb not null default '[]'::jsonb,
  start_time time,
  end_time time,
  room text,
  instructor text,
  meeting_dates_raw text,
  start_date date,
  end_date date
);

create table if not exists section_availability (
  section_id text primary key references sections(section_id) on delete cascade,
  class_capacity integer,
  wait_list_capacity integer,
  enrollment_total integer,
  wait_list_total integer,
  available_seats integer
);

create table if not exists requirement_designations (
  requirement_designation_id text primary key,
  name text not null
);

create table if not exists class_attributes (
  class_attribute_id text primary key,
  name text not null
);

create table if not exists section_requirement_designations (
  section_id text references sections(section_id) on delete cascade,
  requirement_designation_id text references requirement_designations(requirement_designation_id) on delete cascade,
  primary key (section_id, requirement_designation_id)
);

create table if not exists section_class_attributes (
  section_id text references sections(section_id) on delete cascade,
  class_attribute_id text references class_attributes(class_attribute_id) on delete cascade,
  primary key (section_id, class_attribute_id)
);

create index if not exists courses_term_id_idx on courses(term_id);
create index if not exists courses_subject_id_idx on courses(subject_id);
create index if not exists sections_course_id_idx on sections(course_id);
create index if not exists sections_term_id_idx on sections(term_id);
create index if not exists meetings_section_id_idx on meetings(section_id);
