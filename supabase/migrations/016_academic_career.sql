-- 016 Academic career: 100L → 500L → graduation, on real weeks.
-- Additive only. Mirrors src/config/academicCareer.ts (scripts/test-academics-db.ts checks drift).
--  * A semester is one Lagos week, Monday–Sunday. The exam window is Saturday–Sunday.
--  * Coursework: a 3-question quiz right after each attended (allowance-paid) lecture, drawn from
--    what that lecturer taught. Answers never leave the database until a quiz/exam is submitted.
--  * Exam: 10 questions from the lectures you attended this semester, 10 minutes, once.
--  * Semester score = 40% coursework + 60% exam → Nigerian 5-point grade. A pass (≥40) counts
--    toward promotion; a fail is a carryover (counts in CGPA, no promotion); missing the exam or
--    attending fewer than 3 lectures is "incomplete" (no effect). Two passes = next level.
--  * Ten passed semesters = graduation with a class of degree. Nobody is ever expelled.

create table public.lecture_questions(
 id text primary key, lecture_id text not null, question text not null,
 options text[] not null check(cardinality(options) between 2 and 5),
 answer integer not null check(answer>=0)
);
insert into public.lecture_questions(id,lecture_id,question,options,answer) values
 ('fst201-1','funaab-fst-201','Which starch molecule has α-1,6 branch points?',array['Amylose','Amylopectin','Cellulose','Glycogen'],1),
 ('fst201-2','funaab-fst-201','What happens when eba cools down and firms up?',array['Gelatinization','Retrogradation','Caramelization','Fermentation'],1),
 ('fst201-3','funaab-fst-201','Which enzyme makes cut yam slices turn brown?',array['Amylase','Polyphenol oxidase','Lipase','Pectinase'],1),
 ('fst201-4','funaab-fst-201','Which of these helps prevent enzymatic browning?',array['Leaving it in the sun','Vitamin C (ascorbic acid)','Adding sugar','Stirring it'],1),
 ('mee203-1','funaab-eng-203','How did the lecturer write the First Law?',array['dU = dQ − dW','F = ma','V = IR','PV = nRT'],0),
 ('mee203-2','funaab-eng-203','Carnot efficiency is…',array['1 − T_cold / T_hot','T_hot / T_cold','1 − T_hot / T_cold','W / Q_cold'],0),
 ('mee203-3','funaab-eng-203','Temperatures in the Carnot formula must be in…',array['Celsius','Fahrenheit','Kelvin','Any unit'],2),
 ('mee203-4','funaab-eng-203','Enthalpy H is defined as…',array['U − PV','U + PV','Q − W','PV / T'],1),
 ('bio205-1','funaab-bio-205','The Law of Segregation gives which F2 ratio in a monohybrid cross?',array['1:1','3:1','9:3:3:1','1:2'],1),
 ('bio205-2','funaab-bio-205','The dihybrid F2 phenotypic ratio is…',array['3:1','9:3:3:1','1:2:1','12:3:1'],1),
 ('bio205-3','funaab-bio-205','mRNA carries the genetic code from the nucleus to the…',array['Mitochondria','Ribosomes','Cell wall','Vacuole'],1),
 ('bio205-4','funaab-bio-205','FUNAAB breeders use these principles to select pest-resistant…',array['Cowpea and cassava','Goats and sheep','Steel and timber','Fish and prawns'],0),
 ('cve201-1','funaab-cve-201','Stress is…',array['Force × area','Force per unit area','Change in length','Length per unit force'],1),
 ('cve201-2','funaab-cve-201','Strain is…',array['ΔL / L₀','F / A','E × σ','L₀ / ΔL'],0),
 ('cve201-3','funaab-cve-201','Within the elastic limit, stress ÷ strain is the…',array['Poisson''s ratio','Young''s modulus','Factor of safety','Yield stress'],1),
 ('cve201-4','funaab-cve-201','Young''s modulus of steel is about…',array['10 GPa','200 GPa','2 GPa','2000 GPa'],1),
 ('vet201-1','funaab-vet-201','Which bone comes directly after the scapula in the forelimb?',array['Radius','Humerus','Carpus','Femur'],1),
 ('vet201-2','funaab-vet-201','In the ox, the radius and ulna are…',array['Absent','Partially fused','Completely separate','Longer than the humerus'],1),
 ('vet201-3','funaab-vet-201','The joint between the humerus and the radius is the…',array['Shoulder','Elbow','Carpal joint','Hip'],1),
 ('vet201-4','funaab-vet-201','In which animal did the lecturer say the radius and ulna stay separate?',array['Ox','Dog','Goat','Sheep'],1),
 ('anp201-1','funaab-anp-201','Feed is roughly what share of livestock production cost?',array['10%','30%','70%','95%'],2),
 ('anp201-2','funaab-anp-201','Feed conversion ratio (FCR) is…',array['Weight gain ÷ feed','Feed consumed ÷ weight gain','Feed × weight','Price ÷ feed'],1),
 ('anp201-3','funaab-anp-201','A broiler eats 4 kg of feed and gains 2 kg. Its FCR is…',array['0.5','2','4','8'],1),
 ('anp201-4','funaab-anp-201','Which is NOT one of the production systems named in class?',array['Extensive','Semi-intensive','Intensive','Hydroponic'],3),
 ('hrt201-1','funaab-hrt-201','Which of these is sexual propagation?',array['Grafting','Seed','Layering','Cuttings'],1),
 ('hrt201-2','funaab-hrt-201','Grafting joins a scion to a…',array['Rootstock','Seedling tray','Leaf','Fruit'],0),
 ('hrt201-3','funaab-hrt-201','For a graft to take, which tissue must be in contact?',array['Cambium','Pith','Bark only','Root hairs'],0),
 ('hrt201-4','funaab-hrt-201','A key advantage of grafting over seed is that the plants are…',array['True-to-type','Always taller','Seedless','Cheaper to water'],0),
 ('emt201-1','funaab-emt-201','What does an Environmental Impact Assessment do?',array['Predicts a project''s effects before it begins','Audits a company''s accounts','Measures rainfall','Licenses drivers'],0),
 ('emt201-2','funaab-emt-201','Which is the first stage of an EIA?',array['Monitoring','Mitigation','Screening','Scoping'],2),
 ('emt201-3','funaab-emt-201','When untreated organic waste enters a river, dissolved oxygen…',array['Rises','Falls','Stays the same','Turns into BOD'],1),
 ('emt201-4','funaab-emt-201','BOD rises when…',array['Organic load increases','The river is cold','pH is exactly 7','Turbidity falls'],0),
 ('cyb201-1','funaab-cyb-201','In the CIA triad, C, I and A stand for…',array['Control, Identity, Access','Confidentiality, Integrity, Availability','Cyber, Internet, Antivirus','Code, Input, Audit'],1),
 ('cyb201-2','funaab-cyb-201','Ransomware mainly attacks…',array['Confidentiality','Integrity','Availability','Anonymity'],2),
 ('cyb201-3','funaab-cyb-201','Phishing mainly attacks…',array['Confidentiality','Availability','Bandwidth','Hardware'],0),
 ('cyb201-4','funaab-cyb-201','What did the lecturer ask you to turn on today?',array['Two-factor authentication','Airplane mode','Bluetooth','Dark mode'],0),
 ('phy201-1','funaab-phy-201','Newton''s second law: force equals the rate of change of…',array['Velocity','Momentum','Energy','Mass'],1),
 ('phy201-2','funaab-phy-201','Momentum p equals…',array['m·a','m·v','½mv²','F·t²'],1),
 ('phy201-3','funaab-phy-201','With no external force in a collision, total momentum is…',array['Lost as heat','Conserved','Doubled','Zero'],1),
 ('phy201-4','funaab-phy-201','A 2 kg ball at 3 m/s hits a resting 1 kg ball and stops. The 1 kg ball moves at…',array['3 m/s','6 m/s','1.5 m/s','2 m/s'],1);

create table public.academic_records(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 start_semester integer not null, semesters_passed integer not null default 0,
 cgpa numeric(3,2), graduated_at timestamptz, class_of_degree text,
 created_at timestamptz not null default now()
);
create table public.semester_results(
 user_id uuid not null references public.profiles(id) on delete cascade, semester integer not null,
 lectures integer not null, coursework numeric(5,2) not null, exam numeric(5,2), score numeric(5,2),
 grade text, grade_point integer, status text not null check(status in('passed','failed','incomplete')),
 level integer not null, created_at timestamptz not null default now(), primary key(user_id,semester)
);
create table public.quiz_attempts(
 attendance_id uuid primary key references public.lecture_attendance(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, lecture_id text not null,
 questions text[] not null, answers integer[] not null, score integer not null, total integer not null,
 created_at timestamptz not null default now()
);
create index quiz_attempts_user on public.quiz_attempts(user_id,created_at);
create table public.exam_attempts(
 user_id uuid not null references public.profiles(id) on delete cascade, semester integer not null,
 questions text[] not null, started_at timestamptz not null default now(), submitted_at timestamptz,
 answers integer[], score integer, total integer not null, primary key(user_id,semester)
);

alter table public.lecture_questions enable row level security;
alter table public.academic_records enable row level security;
alter table public.semester_results enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.exam_attempts enable row level security;
-- Questions (with answers) are never readable by clients; they come through the RPCs below.
revoke all on public.lecture_questions,public.academic_records,public.semester_results,public.quiz_attempts,public.exam_attempts from anon,authenticated;
grant select on public.academic_records,public.semester_results to authenticated;
create policy academic_records_own on public.academic_records for select using(user_id=auth.uid());
create policy semester_results_own on public.semester_results for select using(user_id=auth.uid());

-- Week 0 starts Monday 5 January 2026 (Lagos).
create or replace function public.academic_semester(p_day date) returns integer language sql immutable as $$
 select floor((p_day - date '2026-01-05')::numeric / 7)::integer $$;
create or replace function public.academic_semester_from(p_semester integer) returns timestamptz language sql stable as $$
 select (date '2026-01-05' + p_semester*7)::timestamp at time zone 'Africa/Lagos' $$;
create or replace function public.academic_exam_open(p_day date) returns boolean language sql immutable as $$
 select extract(isodow from p_day) in (6,7) $$;
create or replace function public.academic_level(p_passed integer) returns integer language sql immutable as $$
 select least(500, 100 + (p_passed/2)*100) $$;
create or replace function public.academic_grade(p_score numeric) returns table(grade text,grade_point integer) language sql immutable as $$
 select case when p_score>=70 then 'A' when p_score>=60 then 'B' when p_score>=50 then 'C' when p_score>=45 then 'D' when p_score>=40 then 'E' else 'F' end,
        case when p_score>=70 then 5 when p_score>=60 then 4 when p_score>=50 then 3 when p_score>=45 then 2 when p_score>=40 then 1 else 0 end $$;
create or replace function public.academic_class(p_cgpa numeric) returns text language sql immutable as $$
 select case when p_cgpa>=4.5 then 'First Class' when p_cgpa>=3.5 then 'Second Class Upper' when p_cgpa>=2.4 then 'Second Class Lower'
   when p_cgpa>=1.5 then 'Third Class' else 'Pass' end $$;

-- Lectures attended (allowance rows) inside a semester.
create or replace function public.academic_lectures(p_user uuid,p_semester integer) returns integer
language sql stable security definer set search_path=public as $$
 select count(*)::integer from lecture_attendance where user_id=p_user
  and created_at>=academic_semester_from(p_semester) and created_at<academic_semester_from(p_semester+1) $$;
create or replace function public.academic_coursework(p_user uuid,p_semester integer) returns numeric
language sql stable security definer set search_path=public as $$
 select coalesce(round(100.0*sum(score)/nullif(sum(total),0),2),0) from quiz_attempts where user_id=p_user
  and created_at>=academic_semester_from(p_semester) and created_at<academic_semester_from(p_semester+1) $$;

-- Finalise every finished semester that has no result yet (lazy: runs whenever state is read).
create or replace function public.academic_close(p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r academic_records; s integer; v_now integer := academic_semester(lagos_today());
 v_lectures integer; v_cw numeric; e exam_attempts; v_exam numeric; v_score numeric; g record; v_status text;
begin
 select * into r from academic_records where user_id=p_user for update;
 if not found or r.graduated_at is not null then return; end if;
 for s in select generate_series(greatest(r.start_semester, coalesce((select max(semester)+1 from semester_results where user_id=p_user), r.start_semester)), v_now-1) loop
  v_lectures := academic_lectures(p_user,s); v_cw := academic_coursework(p_user,s);
  select * into e from exam_attempts where user_id=p_user and semester=s;
  v_exam := case when e.submitted_at is not null then round(100.0*e.score/nullif(e.total,0),2) end;
  if v_exam is null or v_lectures<3 then
   insert into semester_results(user_id,semester,lectures,coursework,exam,status,level)
    values(p_user,s,v_lectures,v_cw,v_exam,'incomplete',academic_level(r.semesters_passed));
   continue;
  end if;
  v_score := round(0.4*v_cw+0.6*v_exam,2);
  select * into g from academic_grade(v_score);
  v_status := case when g.grade_point>=1 then 'passed' else 'failed' end;
  insert into semester_results(user_id,semester,lectures,coursework,exam,score,grade,grade_point,status,level)
   values(p_user,s,v_lectures,v_cw,v_exam,v_score,g.grade,g.grade_point,v_status,academic_level(r.semesters_passed));
  if v_status='passed' then r.semesters_passed := r.semesters_passed+1; end if;
  r.cgpa := (select round(avg(grade_point),2) from semester_results where user_id=p_user and status in('passed','failed'));
  if r.semesters_passed>=10 then
   r.graduated_at := now(); r.class_of_degree := academic_class(r.cgpa);
   update academic_records set semesters_passed=r.semesters_passed,cgpa=r.cgpa,graduated_at=r.graduated_at,class_of_degree=r.class_of_degree where user_id=p_user;
   return;
  end if;
 end loop;
 update academic_records set semesters_passed=r.semesters_passed,cgpa=r.cgpa where user_id=p_user;
end $$;

create or replace function public.academic_state_for(p_user uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r academic_records; v_day date := lagos_today(); v_sem integer := academic_semester(lagos_today()); e exam_attempts;
begin
 insert into academic_records(user_id,start_semester) values(p_user,v_sem) on conflict do nothing;
 perform academic_close(p_user);
 select * into r from academic_records where user_id=p_user;
 select * into e from exam_attempts where user_id=p_user and semester=v_sem;
 return jsonb_build_object(
  'level',academic_level(r.semesters_passed),'semesters_passed',r.semesters_passed,'cgpa',r.cgpa,
  'graduated',r.graduated_at is not null,'class_of_degree',r.class_of_degree,'graduated_at',r.graduated_at,
  'semester',jsonb_build_object('number',v_sem-r.start_semester+1,'id',v_sem,
    'ends_at',academic_semester_from(v_sem+1),'exam_open',academic_exam_open(v_day),
    'exam_opens_at',academic_semester_from(v_sem)+interval '5 days',
    'lectures',academic_lectures(p_user,v_sem),'lectures_needed',3,'coursework',academic_coursework(p_user,v_sem),
    'quizzes',(select count(*) from quiz_attempts where user_id=p_user and created_at>=academic_semester_from(v_sem)),
    'exam',case when e.user_id is null then null else jsonb_build_object('started_at',e.started_at,'submitted',e.submitted_at is not null,
      'score',e.score,'total',e.total) end),
  'results',coalesce((select jsonb_agg(jsonb_build_object('semester',semester-r.start_semester+1,'level',level,'lectures',lectures,
      'coursework',coursework,'exam',exam,'score',score,'grade',grade,'grade_point',grade_point,'status',status) order by semester desc)
    from semester_results where user_id=p_user),'[]'));
end $$;
create or replace function public.academic_state() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return academic_state_for(auth.uid());
end $$;

-- Quiz for the lecture you just attended: same 3 questions however often you ask.
create or replace function public.academic_quiz_questions(p_attendance uuid,p_lecture text) returns text[]
language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(id),'{}') from (select id from lecture_questions where lecture_id=p_lecture
  order by md5(p_attendance::text||id) limit 3) q $$;
create or replace function public.lecture_quiz(p_lecture text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare u uuid := auth.uid(); a lecture_attendance;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into a from lecture_attendance where user_id=u and lecture_id=p_lecture and now()-created_at<interval '30 minutes'
  order by created_at desc limit 1;
 if not found then raise exception 'Attend this lecture first'; end if;
 if exists(select 1 from quiz_attempts where attendance_id=a.id) then raise exception 'Quiz already taken'; end if;
 return jsonb_build_object('attendance_id',a.id,'lecture_id',p_lecture,'questions',
  (select jsonb_agg(jsonb_build_object('id',q.id,'question',q.question,'options',to_jsonb(q.options)) order by array_position(ids,q.id))
   from lecture_questions q, (select academic_quiz_questions(a.id,p_lecture) ids) x where q.id=any(x.ids)));
end $$;
create or replace function public.submit_lecture_quiz(p_attendance uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); a lecture_attendance; v_ids text[]; v_ans integer[] := '{}'; v_score integer := 0; q lecture_questions; v integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into a from lecture_attendance where id=p_attendance and user_id=u for update;
 if not found then raise exception 'Attend this lecture first'; end if;
 if now()-a.created_at>=interval '30 minutes' then raise exception 'This quiz has closed'; end if;
 if exists(select 1 from quiz_attempts where attendance_id=a.id) then raise exception 'Quiz already taken'; end if;
 v_ids := academic_quiz_questions(a.id,a.lecture_id);
 if cardinality(v_ids)=0 then raise exception 'No quiz for this lecture'; end if;
 foreach q in array (select array_agg(lq order by array_position(v_ids,lq.id)) from lecture_questions lq where lq.id=any(v_ids)) loop
  v := case when jsonb_typeof(p_answers->q.id)='number' then (p_answers->>q.id)::integer else -1 end;
  v_ans := v_ans||v; if v=q.answer then v_score := v_score+1; end if;
 end loop;
 insert into quiz_attempts(attendance_id,user_id,lecture_id,questions,answers,score,total) values(a.id,u,a.lecture_id,v_ids,v_ans,v_score,cardinality(v_ids));
 return jsonb_build_object('score',v_score,'total',cardinality(v_ids),
  'answers',(select jsonb_object_agg(id,answer) from lecture_questions where id=any(v_ids)));
end $$;

-- Semester exam: weekend only, 3+ lectures attended this semester, once, 10 minutes.
create or replace function public.start_semester_exam() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_day date := lagos_today(); v_sem integer := academic_semester(lagos_today()); e exam_attempts; v_ids text[];
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform academic_state_for(u);
 if exists(select 1 from academic_records where user_id=u and graduated_at is not null) then raise exception 'You have graduated'; end if;
 select * into e from exam_attempts where user_id=u and semester=v_sem;
 if found then
  if e.submitted_at is not null then raise exception 'You already sat this semester''s exam'; end if;
  v_ids := e.questions;
 else
  if not academic_exam_open(v_day) then raise exception 'Exams open on Saturday and Sunday'; end if;
  if academic_lectures(u,v_sem)<3 then raise exception 'Attend at least 3 lectures this semester to sit the exam'; end if;
  select array_agg(id) into v_ids from (select id from lecture_questions where lecture_id in(
    select distinct lecture_id from lecture_attendance where user_id=u and created_at>=academic_semester_from(v_sem) and created_at<academic_semester_from(v_sem+1))
   order by md5(u::text||v_sem::text||id) limit 10) q;
  insert into exam_attempts(user_id,semester,questions,total) values(u,v_sem,v_ids,cardinality(v_ids)) returning * into e;
 end if;
 return jsonb_build_object('started_at',e.started_at,'ends_at',e.started_at+interval '10 minutes','questions',
  (select jsonb_agg(jsonb_build_object('id',q.id,'question',q.question,'options',to_jsonb(q.options)) order by array_position(v_ids,q.id))
   from lecture_questions q where q.id=any(v_ids)));
end $$;
create or replace function public.submit_semester_exam(p_answers jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); v_sem integer := academic_semester(lagos_today()); e exam_attempts; v_ans integer[] := '{}'; v_score integer := 0; q lecture_questions; v integer;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select * into e from exam_attempts where user_id=u and semester=v_sem for update;
 if not found then raise exception 'Start the exam first'; end if;
 if e.submitted_at is not null then raise exception 'You already sat this semester''s exam'; end if;
 -- Late submissions still count what was answered, but nothing after 10 minutes + 30 s grace.
 if now() > e.started_at+interval '10 minutes 30 seconds' then p_answers := '{}'::jsonb; end if;
 foreach q in array (select array_agg(lq order by array_position(e.questions,lq.id)) from lecture_questions lq where lq.id=any(e.questions)) loop
  v := case when jsonb_typeof(p_answers->q.id)='number' then (p_answers->>q.id)::integer else -1 end;
  v_ans := v_ans||v; if v=q.answer then v_score := v_score+1; end if;
 end loop;
 update exam_attempts set submitted_at=now(),answers=v_ans,score=v_score where user_id=u and semester=v_sem;
 return jsonb_build_object('score',v_score,'total',e.total);
end $$;

-- What other students may see: level and graduation for everyone; CGPA only for friends.
create or replace function public.academic_public(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare r academic_records; v_friend boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into r from academic_records where user_id=p_user;
 if not found then return null; end if;
 v_friend := p_user=auth.uid() or exists(select 1 from friends where status='accepted'
  and ((user_id=auth.uid() and friend_id=p_user) or (user_id=p_user and friend_id=auth.uid())));
 return jsonb_build_object('level',academic_level(r.semesters_passed),'graduated',r.graduated_at is not null,
  'class_of_degree',r.class_of_degree,'cgpa',case when v_friend then r.cgpa end);
end $$;

revoke all on function public.academic_semester(date),public.academic_semester_from(integer),public.academic_exam_open(date),
 public.academic_level(integer),public.academic_grade(numeric),public.academic_class(numeric),public.academic_lectures(uuid,integer),
 public.academic_coursework(uuid,integer),public.academic_close(uuid),public.academic_state_for(uuid),
 public.academic_quiz_questions(uuid,text) from public,anon,authenticated;
revoke all on function public.academic_state(),public.lecture_quiz(text),public.submit_lecture_quiz(uuid,jsonb),
 public.start_semester_exam(),public.submit_semester_exam(jsonb),public.academic_public(uuid) from public,anon;
grant execute on function public.academic_state(),public.lecture_quiz(text),public.submit_lecture_quiz(uuid,jsonb),
 public.start_semester_exam(),public.submit_semester_exam(jsonb),public.academic_public(uuid) to authenticated;
