-- Supabase Database Schema for Clinic Management (PostgreSQL)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null check (role in ('doctor', 'receptionist', 'admin')),
  is_available boolean default true,
  reg_number text,
  created_at timestamptz default now()
);

-- 2. Patients Table
create table public.patients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null unique,
  dob date,
  address text,
  blood_group text,
  created_at timestamptz default now()
);

-- 3. Tokens Table (daily queue)
create table public.tokens (
  id uuid primary key default uuid_generate_v4(),
  patient uuid references public.patients(id) on delete cascade not null,
  token_number integer not null,
  date date not null default current_date,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'done')),
  chief_complaint text,
  receptionist uuid references public.profiles(id) not null,
  doctor uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 4. Prescriptions Table
create table public.prescriptions (
  id uuid primary key default uuid_generate_v4(),
  token uuid references public.tokens(id) on delete cascade not null,
  patient uuid references public.patients(id) on delete cascade not null,
  doctor uuid references public.profiles(id) not null,
  medicines jsonb not null default '[]'::jsonb,
  diagnosis text,
  notes text,
  created_at timestamptz default now()
);

-- 5. Bills Table
create table public.bills (
  id uuid primary key default uuid_generate_v4(),
  token uuid references public.tokens(id) on delete cascade not null,
  patient uuid references public.patients(id) on delete cascade not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null,
  paid boolean not null default false,
  receptionist uuid references public.profiles(id) not null,
  created_at timestamptz default now()
);

-- 6. Settings Table
create table public.settings (
  key text primary key,
  value text not null
);

-- Pre-populate default settings
insert into public.settings (key, value) values
  ('clinic_name', 'Clinic Management'),
  ('default_consultation_fee', '500')
on conflict (key) do nothing;

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.tokens enable row level security;
alter table public.prescriptions enable row level security;
alter table public.bills enable row level security;
alter table public.settings enable row level security;

-- Policies: Allow authenticated users full CRUD access
create policy "Allow auth CRUD on profiles" on public.profiles for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow auth CRUD on patients" on public.patients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow auth CRUD on tokens" on public.tokens for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow auth CRUD on prescriptions" on public.prescriptions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow auth CRUD on bills" on public.bills for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Allow auth CRUD on settings" on public.settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Trigger function to automatically create a profile after auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role, is_available, reg_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Unknown User'),
    coalesce(new.raw_user_meta_data->>'role', 'receptionist'),
    true,
    new.raw_user_meta_data->>'reg_number'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
