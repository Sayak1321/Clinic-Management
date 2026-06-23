# CliniQ — Clinic Queue & EMR Management System

CliniQ is a modern, high-performance, and responsive clinic management web application built with **React**, **Vite**, **Tailwind CSS**, and **Supabase**. It provides a seamless selection portal linking two major workflows: the **Receptionist Portal** (for patient intake, queue card assignment, and billing) and the **Doctor Portal** (for managing the consultation queue, recording diagnoses, writing prescriptions, downloading A5 PDF slips, and tracking daily caseload summaries).

The application is tailored for quick deployments using guest access credentials—allowing instant login bypass for both receptionist and doctor portals.

---

## 🚀 Getting Started

### 1. Clone the repository and install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a file named `.env.local` in the root of the project and add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-publishable-key
VITE_APP_NAME="Clinic Management"
```

### 3. Run the Development Server
```bash
npm run dev
```
The application will run locally on [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Database Setup (Supabase SQL)
Run the following SQL commands in the **SQL Editor** of your Supabase dashboard. This setup disables Row Level Security (RLS) for guest authentication, seeds default guest profiles, and enables real-time event streaming for instant client syncing:

```sql
-- 1. Disable Row Level Security (RLS) on all tables for guest access
alter table public.profiles disable row level security;
alter table public.patients disable row level security;
alter table public.tokens disable row level security;
alter table public.prescriptions disable row level security;
alter table public.bills disable row level security;
alter table public.settings disable row level security;

-- 2. Drop the foreign key constraint that requires profile IDs to exist in auth.users
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 3. Pre-populate default guest profiles
insert into public.profiles (id, name, email, role, is_available) values
  ('d0000000-0000-0000-0000-000000000000', 'Guest Doctor', 'doctor@cliniq.com', 'doctor', true),
  ('e0000000-0000-0000-0000-000000000000', 'Guest Receptionist', 'receptionist@cliniq.com', 'receptionist', true)
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  is_available = excluded.is_available;

-- 4. Enable real-time replication for tables
do $$
begin
  alter publication supabase_realtime drop table public.tokens, public.patients, public.bills, public.profiles;
exception
  when others then null;
end $$;

alter publication supabase_realtime add table public.tokens, public.patients, public.bills, public.profiles;
```

---

## 📁 Key Features

### 📋 Receptionist Portal
* **Walk-in Registration:** Quick intake form with patient name, phone autocomplete, DOB, blood group, address, and primary complaint.
* **Smart Token Queue:** Auto-generates unique daily queue numbers. Includes inline controls on token cards to assign or reassign doctors on the fly.
* **Unified Billing System:** Add predefined presets (Consultation Fee, dressing, dressing charges, etc.) or custom entries, calculate totals, print thermal invoice bills, and process status tracking (Paid/Unpaid badge updates).
* **Patient Records Lookup:** Search by name or phone and look up past visits, medical logs, and prescription history.

### 🩺 Doctor Portal
* **Waiting Queue:** View the live, prioritized queue of patients assigned to you (with option to switch view to "All Queue Patients").
* **EMR Intake Form:** Record consultation notes, diagnoses, active medications (name, dosage, duration), and a short summary/visit report.
* **A5 PDF Prescription Slip:** Downloads a professional prescription format containing clinic branding, patient info, complaints, notes, diagnoses, medications list, and the doctor's visit report details.
* **Integrated Caseload Tracker:** Direct dashboard summary widget displaying total assigned caseload stats (Waiting, In Progress, Completed), remarks logger, patient lists, and a `.txt` summary file exporter.

---

## 📦 Deployment

### Vercel (Recommended)
This repository includes a `vercel.json` configuration ensuring client-side routes (like `/receptionist` and `/doctor`) resolve correctly upon browser refresh. Connect Vercel to your repository, declare `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in Vercel settings, and click **Deploy**.

### Netlify
A Netlify `_redirects` file is included in the `public` directory. Simply link Netlify to your repository, declare the environment variables, and build.

---

*For detailed code structures, state models, database tables, and UI component walkthroughs, please consult the [DOCUMENTATION.md](./DOCUMENTATION.md) file.*
