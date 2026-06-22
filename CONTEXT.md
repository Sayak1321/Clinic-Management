# CONTEXT.md — Clinic Management System
## For AI Agent Use: Full Upgrade Brief

> **Purpose of this file:** This document gives a complete picture of the
> project — what exists, what was planned, what the data model looks like,
> and exactly what "10x better" means for this specific app. Read every
> section before writing a single line of code.

---

## 1. What This App Is

A **staff-only internal web application** for a small clinic. It is not
patient-facing. The two users are:

- **Receptionist** — registers walk-in patients, assigns queue tokens,
  generates bills, marks payments.
- **Doctor** — sees the queue in real time, picks the next patient, writes
  a prescription, marks the visit done.

There is no public signup. No patients log in. All accounts are created by
the clinic admin directly in the PocketBase admin panel.

**Core daily workflow:**
1. Patient walks in → Receptionist registers them (or finds existing record
   by phone) → assigns a queue token (T-1, T-2, T-3 …).
2. Doctor sees the live queue → clicks the next token → patient details and
   any visit history appear → doctor writes prescription → marks done.
3. Receptionist sees the token flip to "done" → generates bill → prints/
   downloads PDF → marks paid.

Token numbers reset every day. The system runs on a local network inside the
clinic (receptionist and doctor on separate desktops/tablets), so **real-time
sync between the two roles is the killer feature**, not mobile responsiveness.

---

## 2. Current Repository State

**Repo:** `https://github.com/Sayak1321/Clinic-Management`
**Branch:** `master` (should be renamed to `main`)
**Commits:** 1 (entire project pushed at once — blank scaffold)
**Tech stack chosen:**
- Frontend: React 19 + Vite 7 + Tailwind CSS 3.4 + React Router 7
- Backend: PocketBase 0.26 (BaaS — single Go binary, SQLite underneath)
- PDF: jsPDF 3

**What actually exists right now:**
- Default Vite + React scaffold (`src/App.jsx` says "Edit me to get started")
- `package.json` with build tools in the wrong dependency bucket
- `index.html` still titled "Vite + React"
- Two markdown setup guides for PocketBase (generic, not domain-specific)
- No `.env` handling
- No routing
- No auth
- No components
- No PocketBase collections defined
- No real-time subscription code

**What was designed but not built** (from `PRODUCTION_READINESS.md`):
- Full file structure planned: `src/lib/`, `src/context/`, `src/pages/`,
  `src/components/`
- PocketBase schema for 5 collections: `users`, `patients`, `tokens`,
  `prescriptions`, `bills`
- Auth context with role-based redirects
- Receptionist and Doctor dashboards with live queue
- jsPDF bill generation
- GitHub Actions CI
- VPS deployment with nginx + systemd

---

## 3. Data Model (Source of Truth)

### PocketBase Collections

#### `users` (built-in auth collection, extended)
```
id            string   PK (auto)
email         string   unique, required
password      string   hashed by PocketBase
role          select   "doctor" | "receptionist"  — required
name          string   display name — required
created       datetime auto
updated       datetime auto
```

#### `patients`
```
id            string   PK (auto)
name          string   required
phone         string   required — 10-digit, used as lookup key
dob           date     optional
address       text     optional
blood_group   select   "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
created       datetime auto
updated       datetime auto
```

#### `tokens`
```
id            string   PK (auto)
patient       relation → patients, single, required
token_number  number   required — auto-incremented per day by app logic
date          date     required — ISO date string "YYYY-MM-DD", today's date
status        select   "waiting" | "in_progress" | "done" — required
receptionist  relation → users, single, required
doctor        relation → users, single, optional (set when doctor picks up)
notes         text     optional — receptionist notes at registration time
created       datetime auto
updated       datetime auto
```
> Token number logic: on creation, query MAX(token_number) WHERE date=today,
> add 1. If no tokens today, start at 1.

#### `prescriptions`
```
id            string   PK (auto)
token         relation → tokens, single, required
patient       relation → patients, single, required
doctor        relation → users, single, required
diagnosis     text     optional
medicines     json     required — array of { name, dosage, duration }
notes         text     optional — additional doctor notes
created       datetime auto
updated       datetime auto
```

#### `bills`
```
id            string   PK (auto)
token         relation → tokens, single, required
patient       relation → patients, single, required
items         json     required — array of { description, amount }
total         number   required — sum of items.amount
paid          bool     required — default false
receptionist  relation → users, single, required
created       datetime auto
updated       datetime auto
```

### PocketBase API Rules (per collection)

| Collection      | List/View              | Create                              | Update                              | Delete    |
|-----------------|------------------------|-------------------------------------|-------------------------------------|-----------|
| users           | `@request.auth.id!=""` | `@request.auth.id!=""`             | `@request.auth.id=id`               | `@admin`  |
| patients        | `@request.auth.id!=""` | `@request.auth.role="receptionist"` | `@request.auth.role="receptionist"` | `@admin`  |
| tokens          | `@request.auth.id!=""` | `@request.auth.role="receptionist"` | `@request.auth.id!=""`             | `@admin`  |
| prescriptions   | `@request.auth.id!=""` | `@request.auth.role="doctor"`       | `@request.auth.role="doctor"`       | `@admin`  |
| bills           | `@request.auth.id!=""` | `@request.auth.role="receptionist"` | `@request.auth.role="receptionist"` | `@admin`  |

---

## 4. Planned File Structure

```
clinic-management/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
│   └── clinic-icon.svg
├── src/
│   ├── lib/
│   │   ├── pb.js              — PocketBase singleton
│   │   └── pdfBill.js         — jsPDF bill generator
│   ├── context/
│   │   └── AuthContext.jsx    — auth state, login(), logout()
│   ├── components/
│   │   ├── ProtectedRoute.jsx — role-aware route guard
│   │   ├── TokenQueue.jsx     — live queue, shared by both dashboards
│   │   └── ErrorBoundary.jsx  — class component, catches render errors
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── ReceptionistDashboard.jsx
│   │   └── DoctorDashboard.jsx
│   ├── App.jsx                — routes only, lazy-loaded pages
│   ├── main.jsx               — BrowserRouter + AuthProvider + StrictMode
│   └── index.css              — Tailwind directives + component classes
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

---

## 5. Design System (Tailwind Tokens)

The design language is **calm, clinical, staff-focused** — not decorative.
Dense information, fast scanning, keyboard-operable.

```js
// tailwind.config.js theme.extend
colors: {
  primary: {
    50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
    400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488',
    700: '#0f766e',  // main brand — teal
    800: '#115e59',  900: '#134e4a',
  },
  surface: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    700: '#334155', 900: '#0f172a',
  },
  // Token status colours
  waiting:     '#fbbf24',  // amber-400
  in_progress: '#3b82f6',  // blue-500
  done:        '#22c55e',  // green-500
},
fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
```

**Reusable CSS classes (defined in `index.css` `@layer components`):**
- `.btn-primary` — teal filled button
- `.btn-secondary` — subtle bordered button
- `.card` — white rounded-lg with soft shadow
- `.input` — full-width form field with focus ring
- `.badge-waiting` / `.badge-in_progress` / `.badge-done` — pill badges

---

## 6. Key Technical Decisions

### Real-time queue sync
PocketBase exposes Server-Sent Events (SSE) for live record updates.
The pattern used in both dashboards:

```js
useEffect(() => {
  fetchTokens();
  pb.collection('tokens').subscribe('*', () => fetchTokens());
  return () => pb.collection('tokens').unsubscribe('*');
}, [fetchTokens]);
```

**Critical nginx requirement** for SSE to work behind a proxy:
```nginx
proxy_buffering    off;
proxy_cache        off;
proxy_read_timeout 300s;
```

### Auth flow
- PocketBase stores JWT in `localStorage` automatically via its SDK.
- On app mount, `AuthContext` calls `pb.collection('users').authRefresh()`
  to validate the stored token. If invalid, clears and sends to `/login`.
- After login, user is redirected based on `user.role`:
  - `doctor` → `/doctor`
  - `receptionist` → `/receptionist`
- `ProtectedRoute` accepts an optional `role` prop. Wrong-role access
  redirects to the user's correct dashboard rather than showing a 403.

### Token number logic (race-condition-safe approach)
On receptionist creating a token:
1. Query `tokens` with `filter: date=today`, `sort: -token_number`, `perPage: 1`
2. `nextToken = result[0]?.token_number + 1 ?? 1`
3. Create token with that number

This is simple and fine for a single-clinic setup where concurrent
registrations are rare. For multi-receptionist environments, a PocketBase
hook (Go) would be more robust, but that's out of scope.

### PDF bill generation
Uses `jsPDF` in A5 format. The function `generateBillPDF()` in `src/lib/pdfBill.js`
accepts `{ token, patient, billItems, total, prescription }` and triggers a
browser download. No server-side rendering needed.

### Lazy loading
All page components are `React.lazy()` wrapped in `App.jsx`. This splits the
bundle into vendor / pocketbase / pdf / page chunks for faster initial load.

---

## 7. What "10x Better" Means For This App

The base plan delivers a working MVP. "10x better" means it becomes something
a real clinic would actually use every day without friction. Here is a
prioritised list of upgrades — work from top to bottom.

---

### P0 — Must-haves for daily usability

**7.1 Patient history panel in Doctor Dashboard**
When a doctor selects a token, show the patient's last 5 visits:
- Past diagnosis, medicines prescribed, date
- Query: `prescriptions` filtered by `patient = patientId`, sorted by
  `-created`, limit 5, expand `token`
- Render as a collapsible accordion below the prescription form
- This is the single most valuable clinical feature missing

**7.2 Patient lookup / autocomplete in Receptionist Dashboard**
Currently: receptionist types name + phone, patient is looked up by exact
phone match.
Better: as the receptionist types the phone number, show a dropdown of
matching patients. If found, pre-fill name/DOB. If not, offer "Register new".
- Use PocketBase filter: `phone ~ "{input}"` (contains search)
- Debounce 300ms
- Keyboard navigable (arrow keys + Enter)

**7.3 Bill items editor**
Currently: bill is hardcoded to one "Consultation fee: ₹500" item.
Better: receptionist can add multiple line items (consultation, tests,
medicines dispensed, injections, dressing) with individual amounts.
- Dynamic add/remove rows
- Total auto-calculated
- Common items available as quick-add chips (configurable in a `settings`
  collection or just hardcoded as presets)

**7.4 Paid / unpaid bill status toggle**
After generating a bill, the receptionist should be able to mark it as paid
with one click. The token queue row should show a ₹ icon in green when paid.
- `bills.paid` boolean field already in the schema
- Update via `pb.collection('bills').update(billId, { paid: true })`
- Show unpaid bills in a sidebar list so nothing gets forgotten

**7.5 Search patients by name or phone**
A dedicated search bar at the top of the Receptionist Dashboard:
- Type name or phone → get matching patient records
- Click a patient → see their full visit history
- Allows receptionist to look up old prescriptions for a returning patient

---

### P1 — High-impact improvements

**7.6 Doctor queue filter**
Currently the Doctor Dashboard shows all waiting/in-progress tokens.
In a multi-doctor clinic, each doctor should only see their assigned tokens,
or tokens with no doctor assigned yet.
- Add a filter toggle: "All patients" / "My patients"
- When doctor picks a token, set `tokens.doctor = currentUser.id`

**7.7 Visit notes / chief complaint field**
Add a `chief_complaint` text field to the `tokens` collection.
Receptionist fills this in at registration ("fever", "follow-up", "chest pain").
Doctor sees it instantly when they open the token.
- Minimal schema change: add `chief_complaint: text` to `tokens`
- Show it prominently at the top of the doctor's prescription panel

**7.8 Keyboard shortcuts**
For a staff app used 8 hours a day, keyboard shortcuts matter enormously.
- Receptionist: `Ctrl+N` → focus phone input (new patient)
- Doctor: `Ctrl+Enter` → save prescription, `Ctrl+↓` → next waiting token
- Show shortcut hints in the UI (small `kbd` tags)

**7.9 Print-optimised prescription slip**
Separate from the bill PDF, a prescription slip the patient takes to a
pharmacy. A5 format, doctor name + registration number at top, clinic name,
patient name, date, medicines in a clean table.
- New function `generatePrescriptionPDF()` in `src/lib/pdfPrescription.js`
- "Print Rx" button in Doctor Dashboard after saving
- Doctor's registration number stored as `reg_number` field on `users`

**7.10 Daily summary for receptionist**
At end of day, a "Today's Summary" card on the Receptionist Dashboard:
- Total patients seen
- Total billed amount
- Unpaid bills count
- "Download day report" button → simple PDF or CSV
- Computed from today's `tokens` and `bills` records

**7.11 Toast notifications**
Replace the current inline text feedback (successMsg, formError) with a
global toast system:
- Success toasts (green, bottom-right, auto-dismiss 3s)
- Error toasts (red, require manual dismiss)
- Queue update toasts when a new token arrives on the Doctor Dashboard
  ("Token T-5 added — Ravi Kumar")
- A `useToast()` hook + a `<ToastContainer />` mounted in `main.jsx`
- Do NOT use a library — implement with a simple `useState` array + CSS
  transition (keeps bundle lean)

---

### P2 — Quality-of-life upgrades

**7.12 Settings collection in PocketBase**
A `settings` collection with `key` / `value` pairs, admin-only write access.
Used for:
- Clinic name (shown in PDF headers)
- Doctor's registration number (if single-doctor clinic)
- Default consultation fee
- Loaded once on app init, stored in a `SettingsContext`

**7.13 Offline indicator**
PocketBase SSE drops when the network goes down. When the connection is lost,
show a non-blocking banner: "Connection lost — queue may be out of date.
Reconnecting…". Use `navigator.onLine` + `pb.authStore.onChange`.

**7.14 Confirmation dialogs**
Any destructive or final action (mark paid, mark done, reject bill) should
ask for a one-click confirmation:
- A lightweight `<ConfirmDialog />` component using a `<dialog>` HTML element
  (no library needed)

**7.15 Doctor availability toggle**
A simple toggle on the Doctor Dashboard: "Accepting patients" / "On break".
Receptionist sees this status next to the doctor's name when assigning tokens.
- Store as `is_available: bool` on `users`
- Real-time update via `users` subscription
- Visual indicator (green dot / grey dot) in both dashboards

**7.16 Revisit detection**
When a patient is registered, check if they have a token from today already.
If yes, warn the receptionist: "This patient already has Token #3 today. Register again?"
- Query: `tokens` WHERE `patient=X AND date=today`

---

### P3 — Future / Nice-to-have (do not block on these)

**7.17 Admin dashboard**
A third role: `admin`. Can view all-time statistics:
- Patients per day (last 30 days) — bar chart using Recharts or a simple SVG
- Revenue per day
- Most common diagnoses (from `prescriptions.diagnosis` text)
- Add/remove doctor and receptionist accounts
- Manage default bill items

**7.18 Medicine master list**
A `medicines` collection in PocketBase with pre-loaded common medicines.
Autocomplete in the prescription form instead of free-text entry.
Prevents misspellings. Can be curated by the doctor.

**7.19 WhatsApp bill delivery**
After generating a bill, offer "Send via WhatsApp" — opens
`https://wa.me/{phone}?text={encodedMessage}` in a new tab with a pre-filled
message containing the bill summary. Zero backend needed, just a URL.

**7.20 Dark mode**
Add `darkMode: 'class'` to `tailwind.config.js`. Toggle stored in
`localStorage`. Not a priority for a clinic display but useful if the doctor
uses the app in a dim consultation room.

---

## 8. UI Architecture Guidance

### Layout pattern
Both dashboards use a **two-panel layout** — not tabbed navigation:
- Left panel (narrower): the action form (register patient / prescription)
- Right panel (wider): the live token queue

On small screens (tablet in portrait), these stack vertically with the queue
on top and the form below.

### Component hierarchy
```
App
├── Login
├── ReceptionistDashboard
│   ├── PatientSearchInput      (P1 — 7.2)
│   ├── PatientRegisterForm
│   ├── TokenQueue              (shared)
│   │   └── TokenRow
│   ├── BillEditor              (P0 — 7.3)
│   └── DailySummaryCard        (P1 — 7.10)
└── DoctorDashboard
    ├── AvailabilityToggle      (P2 — 7.15)
    ├── TokenQueue              (shared)
    │   └── TokenRow
    ├── PatientDetailPanel
    │   ├── PatientHistoryAccordion  (P0 — 7.1)
    │   └── PrescriptionForm
    └── (future: AdminDashboard)
```

### State management
Do NOT introduce Redux, Zustand, or any global state library. The app is
simple enough that:
- Auth state lives in `AuthContext`
- Settings (P2) live in `SettingsContext`
- All other data is fetched locally in each component + refreshed via
  PocketBase subscriptions

### Error handling pattern
All PocketBase calls should be wrapped in try/catch. Errors bubble to either:
1. A local `error` state rendered inline (form validation errors)
2. The global toast system (network errors, unexpected failures)
3. The `ErrorBoundary` (render crashes)

Never let a PocketBase error silently fail.

---

## 9. Environment Variables Reference

| Variable       | Required | Example                          | Notes                              |
|----------------|----------|----------------------------------|------------------------------------|
| `VITE_PB_URL`  | Yes      | `http://127.0.0.1:8090`          | No trailing slash                  |
| `VITE_APP_NAME`| No       | `Clinic Management`              | Shown in `<title>` tag             |

All variables must be prefixed with `VITE_` to be accessible in the browser
via `import.meta.env.VITE_*`.

---

## 10. PocketBase SDK Patterns

### Singleton (never instantiate more than once)
```js
// src/lib/pb.js
import PocketBase from 'pocketbase';
const pb = new PocketBase(import.meta.env.VITE_PB_URL);
pb.autoCancellation(false);
export default pb;
```

### Auth
```js
// Login
await pb.collection('users').authWithPassword(email, password);
// Current user
pb.authStore.model          // { id, email, role, name, ... }
pb.authStore.isValid        // bool
// Logout
pb.authStore.clear();
// Refresh token
await pb.collection('users').authRefresh();
```

### CRUD
```js
// List with filter + expand
await pb.collection('tokens').getFullList({
  filter: `date = "${today}" && status != "done"`,
  expand: 'patient,doctor',
  sort: 'token_number',
});

// Single record
await pb.collection('tokens').getOne(id, { expand: 'patient' });

// Create
await pb.collection('tokens').create({ patient: id, token_number: n, ... });

// Update
await pb.collection('tokens').update(id, { status: 'done' });

// First match
await pb.collection('bills').getFirstListItem(`token = "${tokenId}"`);
```

### Real-time subscription
```js
// Subscribe to ALL changes on a collection
pb.collection('tokens').subscribe('*', (event) => {
  // event.action: 'create' | 'update' | 'delete'
  // event.record: the changed record
  fetchTokens(); // simplest approach — re-fetch on any change
});

// Unsubscribe (call in useEffect cleanup)
pb.collection('tokens').unsubscribe('*');
```

### Error shape
```js
try {
  await pb.collection('patients').create(data);
} catch (err) {
  // err.status       — HTTP status code (400, 403, 404, etc.)
  // err.response.message  — human-readable message from PocketBase
  // err.response.data     — field-level validation errors { field: { message } }
}
```

---

## 11. Packages Already Installed

```json
{
  "dependencies": {
    "jspdf":           "^3.0.1",
    "pocketbase":      "^0.26.1",
    "react":           "^19.1.0",
    "react-dom":       "^19.1.0",
    "react-router-dom":"^7.7.0"
  },
  "devDependencies": {
    "@eslint/js":                 "^9.30.1",
    "@types/react":               "^19.1.8",
    "@types/react-dom":           "^19.1.6",
    "@vitejs/plugin-react":       "^4.6.0",
    "autoprefixer":               "^10.4.21",
    "eslint":                     "^9.30.1",
    "eslint-plugin-react-hooks":  "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals":                    "^16.3.0",
    "postcss":                    "^8.5.6",
    "prettier":                   "^3.3.0",
    "tailwindcss":                "^3.4.17",
    "vite":                       "^7.0.4"
  }
}
```

**Do NOT add:**
- Redux / Zustand / MobX — not needed
- Axios — PocketBase SDK handles HTTP
- Lodash — React + native JS is enough
- Component libraries (MUI, Ant Design, Chakra) — Tailwind is the design system
- Date libraries (Moment, Day.js) — native `Intl` and `Date` are sufficient

**You MAY add if a specific feature needs it:**
- `recharts` — if building the admin stats charts (P3 — 7.17)
- `papaparse` — if exporting CSV reports (P1 — 7.10)

---

## 12. Constraints & Non-Goals

- **No TypeScript.** The project is plain JavaScript. Do not convert files.
- **No server-side code.** Everything is PocketBase (Go binary) + React SPA.
  Do not introduce Node.js servers, Express, or serverless functions.
- **No patient-facing features.** Patients do not log in. Do not build a
  patient portal.
- **No appointment scheduling.** This is a walk-in queue system. Appointments
  are out of scope.
- **No SMS/email notifications.** Optional future feature, not in scope now.
- **Single clinic.** Multi-tenancy is not required. One PocketBase instance
  serves one clinic.
- **Indian locale.** Currency is ₹ (INR). Dates in DD/MM/YYYY where displayed
  to users. Phone numbers are 10-digit Indian mobile numbers.

---

## 13. Suggested Build Order

If building everything from scratch, do it in this sequence to avoid
dependency issues:

1. `src/lib/pb.js` — singleton first, everything else imports it
2. `src/context/AuthContext.jsx` — auth before any page can exist
3. `src/components/ErrorBoundary.jsx` — wrap early
4. `src/components/ProtectedRoute.jsx` — needed before routes
5. `src/App.jsx` + `src/main.jsx` — wire up routing and providers
6. `src/index.css` + `tailwind.config.js` — design tokens before styling
7. `src/pages/Login.jsx` — first page a user sees
8. `src/components/TokenQueue.jsx` — shared, needed by both dashboards
9. `src/pages/ReceptionistDashboard.jsx` — simpler of the two dashboards
10. `src/pages/DoctorDashboard.jsx` — adds prescription form + patient history
11. `src/lib/pdfBill.js` — bill PDF after billing UI exists
12. `src/lib/pdfPrescription.js` — prescription PDF after Rx form works
13. P0 upgrades (7.1–7.5) — patient history, autocomplete, bill items, paid status, search
14. P1 upgrades (7.6–7.11) — filter, chief complaint, shortcuts, toasts, summary
15. P2 upgrades (7.12–7.16) — settings, offline, confirm dialogs, availability
16. P3 upgrades (7.17–7.20) — admin panel, medicine list, WhatsApp, dark mode

---

## 14. Reference: Completed Work

The file `PRODUCTION_READINESS.md` (in this same directory) contains:
- Complete working code for all core files (sections 1–20)
- GitHub Actions CI configuration
- VPS + nginx + systemd deployment instructions
- Vercel/Netlify SPA routing config
- Final deployment checklist

Treat `PRODUCTION_READINESS.md` as the baseline implementation. `CONTEXT.md`
(this file) adds the upgrade roadmap on top of that baseline.

---

*Last updated: June 2026*
*Project: Sayak1321/Clinic-Management*
