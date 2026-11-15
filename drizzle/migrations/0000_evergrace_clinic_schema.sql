CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE public.clinic_role AS ENUM ('owner','manager');
CREATE TYPE public.appointment_status AS ENUM ('booked','completed','cancelled','no_show');
CREATE TYPE public.payment_method AS ENUM ('cash','card','bank_transfer');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','half_day','leave');
CREATE TYPE public.salary_status AS ENUM ('pending','paid');
CREATE TYPE public.treatment_plan_status AS ENUM ('active','completed','cancelled');

CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), full_name text NOT NULL, is_active boolean NOT NULL DEFAULT true);
GRANT SELECT ON public.profiles TO authenticated; GRANT UPDATE(full_name) ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.clinic_role NOT NULL, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,role));
GRANT SELECT,INSERT,UPDATE ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
CREATE TABLE public.services (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, default_price integer NOT NULL DEFAULT 0 CHECK(default_price>=0), default_slots integer NOT NULL DEFAULT 1 CHECK(default_slots BETWEEN 1 AND 3), active boolean NOT NULL DEFAULT true, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.services TO authenticated; GRANT ALL ON public.services TO service_role;
CREATE TABLE public.slots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL, start_time time NOT NULL, end_time time NOT NULL CHECK(end_time>start_time), sort_order integer NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.slots TO authenticated; GRANT ALL ON public.slots TO service_role;
CREATE TABLE public.patients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text NOT NULL UNIQUE CHECK(phone ~ '^03[0-9]{9}$'), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.patients TO authenticated; GRANT ALL ON public.patients TO service_role;
CREATE TABLE public.treatment_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.patients(id), service_id uuid NOT NULL REFERENCES public.services(id), total_sessions integer NOT NULL CHECK(total_sessions>0), total_price integer NOT NULL DEFAULT 0 CHECK(total_price>=0), status public.treatment_plan_status NOT NULL DEFAULT 'active', created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.treatment_plans TO authenticated; GRANT ALL ON public.treatment_plans TO service_role;
CREATE TABLE public.appointments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.patients(id), service_id uuid NOT NULL REFERENCES public.services(id), appt_date date NOT NULL, start_slot integer NOT NULL REFERENCES public.slots(sort_order), slots_count integer NOT NULL DEFAULT 1 CHECK(slots_count BETWEEN 1 AND 3), total_amount integer NOT NULL CHECK(total_amount>=0), status public.appointment_status NOT NULL DEFAULT 'booked', cancel_reason text, plan_id uuid REFERENCES public.treatment_plans(id), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT appointments_no_overlap EXCLUDE USING gist(appt_date WITH =, int4range(start_slot,start_slot+slots_count,'[)') WITH &&) WHERE(status IN('booked','completed')));
GRANT SELECT ON public.appointments TO authenticated; GRANT UPDATE(status,cancel_reason) ON public.appointments TO authenticated; GRANT ALL ON public.appointments TO service_role;
CREATE TABLE public.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL REFERENCES public.appointments(id), patient_id uuid NOT NULL REFERENCES public.patients(id), amount integer NOT NULL CHECK(amount>0), method public.payment_method NOT NULL, paid_at timestamptz NOT NULL DEFAULT now(), voided boolean NOT NULL DEFAULT false, void_reason text, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.payments TO authenticated; GRANT UPDATE(voided,void_reason) ON public.payments TO authenticated; GRANT ALL ON public.payments TO service_role;
CREATE TABLE public.expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL, amount integer NOT NULL CHECK(amount>0), method public.payment_method NOT NULL, note text, spent_on date NOT NULL, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.expenses TO authenticated; GRANT ALL ON public.expenses TO service_role;
CREATE TABLE public.staff (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, base_salary integer NOT NULL DEFAULT 0 CHECK(base_salary>=0), active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.staff TO authenticated; GRANT ALL ON public.staff TO service_role;
CREATE TABLE public.attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_id uuid NOT NULL REFERENCES public.staff(id), work_date date NOT NULL, status public.attendance_status NOT NULL, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(staff_id,work_date));
GRANT SELECT,INSERT,UPDATE ON public.attendance TO authenticated; GRANT ALL ON public.attendance TO service_role;
CREATE TABLE public.salaries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_id uuid NOT NULL REFERENCES public.staff(id), month date NOT NULL CHECK(month=date_trunc('month',month)::date), base integer NOT NULL CHECK(base>=0), deductions integer NOT NULL DEFAULT 0 CHECK(deductions>=0), advance integer NOT NULL DEFAULT 0 CHECK(advance>=0), net integer NOT NULL CHECK(net>=0), status public.salary_status NOT NULL DEFAULT 'pending', paid_on date, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(staff_id,month));
GRANT SELECT,INSERT,UPDATE ON public.salaries TO authenticated; GRANT ALL ON public.salaries TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.services ENABLE ROW LEVEL SECURITY; ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY; ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY; ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY; ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY; ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.has_role(_user_id uuid,_role public.clinic_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION public.is_active_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.clinic_role) FROM PUBLIC,anon; REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.clinic_role) TO authenticated,service_role; GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated,service_role;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(auth.uid()=id OR(public.is_active_user() AND public.has_role(auth.uid(),'owner')));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING(auth.uid()=id AND public.is_active_user()) WITH CHECK(auth.uid()=id AND public.is_active_user());
CREATE POLICY profiles_update_owner ON public.profiles FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING(public.is_active_user() AND(auth.uid()=user_id OR public.has_role(auth.uid(),'owner')));
CREATE POLICY roles_insert_owner ON public.user_roles FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY roles_update_owner ON public.user_roles FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY services_read ON public.services FOR SELECT TO authenticated USING(public.is_active_user() AND(active OR public.has_role(auth.uid(),'owner')));
CREATE POLICY services_insert_owner ON public.services FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY services_update_owner ON public.services FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY slots_read ON public.slots FOR SELECT TO authenticated USING(public.is_active_user() AND(active OR public.has_role(auth.uid(),'owner')));
CREATE POLICY slots_insert_owner ON public.slots FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY slots_update_owner ON public.slots FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY patients_read ON public.patients FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY patients_insert ON public.patients FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY patients_update ON public.patients FOR UPDATE TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))) WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY plans_read ON public.treatment_plans FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY plans_insert ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY plans_update ON public.treatment_plans FOR UPDATE TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))) WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY appointments_read ON public.appointments FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY appointments_update ON public.appointments FOR UPDATE TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))) WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY payments_void ON public.payments FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY expenses_read_owner ON public.expenses FOR SELECT TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY expenses_update_owner ON public.expenses FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY staff_read ON public.staff FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY staff_insert_owner ON public.staff FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY staff_update_owner ON public.staff FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));
CREATE POLICY attendance_read ON public.attendance FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))) WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY salaries_read ON public.salaries FOR SELECT TO authenticated USING(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY salaries_insert ON public.salaries FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));
CREATE POLICY salaries_update_owner ON public.salaries FOR UPDATE TO authenticated USING(public.is_active_user() AND public.has_role(auth.uid(),'owner')) WITH CHECK(public.is_active_user() AND public.has_role(auth.uid(),'owner'));

CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION public.create_clinic_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_name text;
BEGIN
  v_name:=COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'),''),NULLIF(split_part(COALESCE(NEW.email,''),'@',1),''),'Clinic user');
  INSERT INTO public.profiles(id,created_by,full_name) VALUES(NEW.id,NEW.id,v_name) ON CONFLICT(id) DO NOTHING;
  PERFORM pg_advisory_xact_lock(746291,2026);
  IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='owner') THEN INSERT INTO public.user_roles(user_id,role,created_by) VALUES(NEW.id,'owner',NEW.id) ON CONFLICT(user_id,role) DO NOTHING; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER auth_user_create_clinic_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_clinic_profile();

CREATE FUNCTION public.guard_payment_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_total integer; v_paid integer;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.method IS DISTINCT FROM OLD.method OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.created_by IS DISTINCT FROM OLD.created_by OR OLD.voided OR NOT NEW.voided OR NULLIF(btrim(NEW.void_reason),'') IS NULL THEN RAISE EXCEPTION 'Payments are append-only; void a payment with a reason to correct it'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount<=0 OR NEW.voided THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  SELECT total_amount INTO v_total FROM public.appointments WHERE id=NEW.appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  SELECT COALESCE(sum(amount),0) INTO v_paid FROM public.payments WHERE appointment_id=NEW.appointment_id AND NOT voided;
  IF v_paid+NEW.amount>v_total THEN RAISE EXCEPTION 'Payment exceeds the remaining balance'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_append_only_guard BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.guard_payment_mutation();

CREATE FUNCTION public.book_appointment(p_phone text,p_name text,p_service_id uuid,p_appt_date date,p_start_slot integer,p_slots_count integer,p_total_amount integer,p_advance_amount integer DEFAULT 0,p_payment_method public.payment_method DEFAULT NULL,p_plan_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_phone text; v_patient_id uuid; v_appointment_id uuid; v_order integer; v_start time; v_end time; v_previous_end time;
BEGIN
  IF NOT public.is_active_user() OR NOT(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_appt_date<(now() AT TIME ZONE 'Asia/Karachi')::date THEN RAISE EXCEPTION 'Past dates cannot be booked'; END IF;
  IF p_slots_count NOT BETWEEN 1 AND 3 OR p_total_amount<=0 OR COALESCE(p_advance_amount,0)<0 OR p_advance_amount>p_total_amount THEN RAISE EXCEPTION 'Check the duration, total, and advance amounts'; END IF;
  IF p_advance_amount>0 AND p_payment_method IS NULL THEN RAISE EXCEPTION 'Choose a payment method'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=p_service_id AND active) THEN RAISE EXCEPTION 'Choose an active service'; END IF;
  FOR v_order IN p_start_slot..(p_start_slot+p_slots_count-1) LOOP
    SELECT start_time,end_time INTO v_start,v_end FROM public.slots WHERE sort_order=v_order AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Duration includes an unavailable slot'; END IF;
    IF v_previous_end IS NOT NULL AND v_previous_end<>v_start THEN RAISE EXCEPTION 'Duration cannot span a break'; END IF;
    v_previous_end:=v_end;
  END LOOP;
  v_phone:=regexp_replace(COALESCE(p_phone,''),'[^0-9]','','g');
  IF length(v_phone)=12 AND left(v_phone,2)='92' THEN v_phone:='0'||right(v_phone,10); END IF;
  IF v_phone !~ '^03[0-9]{9}$' OR NULLIF(btrim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Enter a valid Pakistani mobile number and patient name'; END IF;
  INSERT INTO public.patients(name,phone,created_by) VALUES(btrim(p_name),v_phone,auth.uid()) ON CONFLICT(phone) DO UPDATE SET name=public.patients.name RETURNING id INTO v_patient_id;
  IF p_plan_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.treatment_plans WHERE id=p_plan_id AND patient_id=v_patient_id AND service_id=p_service_id) THEN RAISE EXCEPTION 'Treatment plan does not match this patient and service'; END IF;
  INSERT INTO public.appointments(patient_id,service_id,appt_date,start_slot,slots_count,total_amount,plan_id,created_by) VALUES(v_patient_id,p_service_id,p_appt_date,p_start_slot,p_slots_count,p_total_amount,p_plan_id,auth.uid()) RETURNING id INTO v_appointment_id;
  IF COALESCE(p_advance_amount,0)>0 THEN INSERT INTO public.payments(appointment_id,patient_id,amount,method,created_by) VALUES(v_appointment_id,v_patient_id,p_advance_amount,p_payment_method,auth.uid()); END IF;
  RETURN v_appointment_id;
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION USING MESSAGE='Slot already taken',ERRCODE='P0001';
END $$;
CREATE FUNCTION public.receive_appointment_payment(p_appointment_id uuid,p_amount integer,p_method public.payment_method) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_patient_id uuid; v_total integer; v_paid integer; v_payment_id uuid;
BEGIN
  IF NOT public.is_active_user() OR NOT(public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_amount<=0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  SELECT patient_id,total_amount INTO v_patient_id,v_total FROM public.appointments WHERE id=p_appointment_id AND status NOT IN('cancelled','no_show') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found or not payable'; END IF;
  SELECT COALESCE(sum(amount),0) INTO v_paid FROM public.payments WHERE appointment_id=p_appointment_id AND NOT voided;
  IF v_paid+p_amount>v_total THEN RAISE EXCEPTION 'Payment exceeds the remaining balance'; END IF;
  INSERT INTO public.payments(appointment_id,patient_id,amount,method,created_by) VALUES(p_appointment_id,v_patient_id,p_amount,p_method,auth.uid()) RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END $$;
REVOKE ALL ON FUNCTION public.book_appointment(text,text,uuid,date,integer,integer,integer,integer,public.payment_method,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.receive_appointment_payment(uuid,integer,public.payment_method) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(text,text,uuid,date,integer,integer,integer,integer,public.payment_method,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_appointment_payment(uuid,integer,public.payment_method) TO authenticated;

CREATE VIEW public.appointment_balance WITH(security_invoker=true) AS SELECT a.id,a.patient_id,a.service_id,a.appt_date,a.start_slot,a.slots_count,a.total_amount,a.status,a.cancel_reason,a.plan_id,a.created_by,a.created_at,a.updated_at,COALESCE(sum(p.amount) FILTER(WHERE NOT p.voided),0)::integer AS paid_total,(a.total_amount-COALESCE(sum(p.amount) FILTER(WHERE NOT p.voided),0))::integer AS balance FROM public.appointments a LEFT JOIN public.payments p ON p.appointment_id=a.id GROUP BY a.id;
GRANT SELECT ON public.appointment_balance TO authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','user_roles','services','slots','patients','treatment_plans','appointments','payments','expenses','staff','attendance','salaries'] LOOP EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',t||'_touch_updated_at',t); END LOOP; END $$;
INSERT INTO public.services(name,default_price,default_slots,active) VALUES('Hydra Facial',0,1,true),('Laser',0,1,true),('PRP',0,1,true),('Chemical Peel',0,1,true);
INSERT INTO public.slots(label,start_time,end_time,sort_order,active) VALUES('10:00–11:00','10:00','11:00',1,true),('11:00–12:00','11:00','12:00',2,true),('12:00–13:00','12:00','13:00',3,true),('14:00–15:00','14:00','15:00',4,true),('15:00–16:00','15:00','16:00',5,true);