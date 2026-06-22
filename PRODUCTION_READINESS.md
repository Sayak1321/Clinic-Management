# Clinic Management — Production Readiness Plan

> **How to use this file:** Work through each section in order. Every section
> contains the exact file path, what to do, and the complete file content to
> drop in. Nothing is left vague. By the end you will have a deployable app.

---

## Table of Contents

1. [Repo Hygiene](#1-repo-hygiene)
2. [package.json — Fix Dependencies](#2-packagejson--fix-dependencies)
3. [Environment Variables](#3-environment-variables)
4. [PocketBase Client Singleton](#4-pocketbase-client-singleton)
5. [PocketBase Schema (Collections)](#5-pocketbase-schema-collections)
6. [PocketBase API Rules](#6-pocketbase-api-rules)
7. [Authentication Context](#7-authentication-context)
8. [Routing & Role Guards](#8-routing--role-guards)
9. [index.html — Meta & Title](#9-indexhtml--meta--title)
10. [vite.config.js — Build Optimisation](#10-viteconfigjs--build-optimisation)
11. [tailwind.config.js — Design Tokens](#11-tailwindconfigjs--design-tokens)
12. [Application Entry — main.jsx](#12-application-entry--mainjsx)
13. [App.jsx — Route Definitions](#13-appjsx--route-definitions)
14. [Pages — Login](#14-pages--login)
15. [Pages — Receptionist Dashboard](#15-pages--receptionist-dashboard)
16. [Pages — Doctor Dashboard](#16-pages--doctor-dashboard)
17. [Components — ProtectedRoute](#17-components--protectedroute)
18. [Components — TokenQueue (Real-time)](#18-components--tokenqueue-real-time)
19. [Billing — PDF Generation](#19-billing--pdf-generation)
20. [Error Boundary](#20-error-boundary)
21. [GitHub Actions CI](#21-github-actions-ci)
22. [Deployment — PocketBase on a VPS](#22-deployment--pocketbase-on-a-vps)
23. [Deployment — Frontend on Vercel / Netlify](#23-deployment--frontend-on-vercel--netlify)
24. [Final Checklist](#24-final-checklist)

---

## 1. Repo Hygiene

### 1a. Rename the default branch

```bash
# In your local repo
git branch -m master main
git push -u origin main
# Then go to GitHub → Settings → Branches → change default to main
```

### 1b. `.gitignore` — replace the existing one

**File: `.gitignore`**

```gitignore
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment — NEVER commit these
.env
.env.local
.env.production
.env.*.local

# Editor
.vscode/settings.json
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# PocketBase binary & data (if running locally in repo)
pocketbase
pb_data/
pb_migrations/
```

---

## 2. package.json — Fix Dependencies

Three issues to fix:
- `autoprefixer`, `postcss`, `tailwindcss` are in `dependencies` — move them to `devDependencies`
- Add `prettier` for consistent formatting
- Name is too generic

**File: `package.json`** — replace entirely:

```json
{
  "name": "clinic-management-system",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{js,jsx,css}\""
  },
  "dependencies": {
    "jspdf": "^3.0.1",
    "pocketbase": "^0.26.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.7.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "autoprefixer": "^10.4.21",
    "eslint": "^9.30.1",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "postcss": "^8.5.6",
    "prettier": "^3.3.0",
    "tailwindcss": "^3.4.17",
    "vite": "^7.0.4"
  }
}
```

Then run:

```bash
npm install
```

---

## 3. Environment Variables

### 3a. `.env.example` — commit this to the repo

**File: `.env.example`**

```env
# PocketBase server URL
# Development: http://127.0.0.1:8090
# Production: https://your-pocketbase-domain.com
VITE_PB_URL=http://127.0.0.1:8090

# App name shown in the browser tab
VITE_APP_NAME=Clinic Management
```

### 3b. `.env.local` — create locally, NEVER commit

```env
VITE_PB_URL=http://127.0.0.1:8090
VITE_APP_NAME=Clinic Management
```

### 3c. `.env.production` — create for production deploy, NEVER commit

```env
VITE_PB_URL=https://pb.yourclinic.com
VITE_APP_NAME=Clinic Management
```

> **Note for CI/CD:** Set `VITE_PB_URL` as a secret in GitHub Actions,
> Vercel, or Netlify rather than committing this file.

---

## 4. PocketBase Client Singleton

Never call `new PocketBase(...)` inside components. Create one shared instance.

**File: `src/lib/pb.js`** — create this file:

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase(import.meta.env.VITE_PB_URL);

// Keep the auth token refreshed across page reloads automatically
pb.autoCancellation(false);

export default pb;
```

Usage everywhere else:

```js
import pb from '../lib/pb';
```

---

## 5. PocketBase Schema (Collections)

Open the PocketBase admin UI at `http://127.0.0.1:8090/_/` and create the
following collections **in this order** (relations require the target to exist
first).

---

### Collection: `users` (auth collection — built-in, extend it)

PocketBase has a built-in `users` auth collection. Add these extra fields:

| Field      | Type   | Required | Notes                          |
|------------|--------|----------|--------------------------------|
| `role`     | Select | Yes      | Options: `doctor`, `receptionist` |
| `name`     | Text   | Yes      | Display name                   |

---

### Collection: `patients`

| Field        | Type   | Required | Notes                        |
|--------------|--------|----------|------------------------------|
| `name`       | Text   | Yes      |                              |
| `phone`      | Text   | Yes      | 10-digit, used for lookup    |
| `dob`        | Date   | No       |                              |
| `address`    | Text   | No       |                              |
| `blood_group`| Select | No       | A+, A−, B+, B−, AB+, AB−, O+, O− |

---

### Collection: `tokens`

| Field          | Type     | Required | Notes                                      |
|----------------|----------|----------|--------------------------------------------|
| `patient`      | Relation | Yes      | → `patients`, single                       |
| `token_number` | Number   | Yes      | Auto-assigned by receptionist logic        |
| `date`         | Date     | Yes      | Set to today's date (date only, no time)   |
| `status`       | Select   | Yes      | Options: `waiting`, `in_progress`, `done`  |
| `receptionist` | Relation | Yes      | → `users`, single                          |
| `doctor`       | Relation | No       | → `users`, single (set when doctor picks up) |
| `notes`        | Text     | No       | Receptionist notes                         |

> **Token number logic:** When creating a token, query the highest
> `token_number` for today's date and increment by 1. This happens in the
> receptionist dashboard (see Section 15). Token numbers reset daily because
> the date field changes.

---

### Collection: `prescriptions`

| Field        | Type     | Required | Notes                              |
|--------------|----------|----------|------------------------------------|
| `token`      | Relation | Yes      | → `tokens`, single                 |
| `patient`    | Relation | Yes      | → `patients`, single               |
| `doctor`     | Relation | Yes      | → `users`, single                  |
| `medicines`  | JSON     | Yes      | Array of `{name, dosage, duration}`|
| `diagnosis`  | Text     | No       |                                    |
| `notes`      | Text     | No       |                                    |

---

### Collection: `bills`

| Field         | Type     | Required | Notes                               |
|---------------|----------|----------|-------------------------------------|
| `token`       | Relation | Yes      | → `tokens`, single                  |
| `patient`     | Relation | Yes      | → `patients`, single                |
| `items`       | JSON     | Yes      | Array of `{description, amount}`    |
| `total`       | Number   | Yes      | Sum of items                        |
| `paid`        | Bool     | Yes      | Default false                       |
| `receptionist`| Relation | Yes      | → `users`, single                   |

---

## 6. PocketBase API Rules

Go to each collection → **Rules** tab and set the following.

### `users` (auth collection)

| Rule         | Value                        |
|--------------|------------------------------|
| List/Search  | `@request.auth.id != ""`     |
| View         | `@request.auth.id != ""`     |
| Create       | `@request.auth.id != ""`     |
| Update       | `@request.auth.id = id`      |
| Delete       | `@request.auth.id = id`      |

### `patients`

| Rule    | Value                    |
|---------|--------------------------|
| List    | `@request.auth.id != ""`|
| View    | `@request.auth.id != ""`|
| Create  | `@request.auth.role = "receptionist"` |
| Update  | `@request.auth.role = "receptionist"` |
| Delete  | `@admin`                 |

### `tokens`

| Rule    | Value                    |
|---------|--------------------------|
| List    | `@request.auth.id != ""`|
| View    | `@request.auth.id != ""`|
| Create  | `@request.auth.role = "receptionist"` |
| Update  | `@request.auth.id != ""`|
| Delete  | `@admin`                 |

### `prescriptions`

| Rule    | Value                                      |
|---------|--------------------------------------------|
| List    | `@request.auth.id != ""`                  |
| View    | `@request.auth.id != ""`                  |
| Create  | `@request.auth.role = "doctor"`           |
| Update  | `@request.auth.role = "doctor"`           |
| Delete  | `@admin`                                   |

### `bills`

| Rule    | Value                                             |
|---------|---------------------------------------------------|
| List    | `@request.auth.id != ""`                         |
| View    | `@request.auth.id != ""`                         |
| Create  | `@request.auth.role = "receptionist"`            |
| Update  | `@request.auth.role = "receptionist"`            |
| Delete  | `@admin`                                          |

---

## 7. Authentication Context

**File: `src/context/AuthContext.jsx`** — create this file:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import pb from '../lib/pb';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.model);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate stored token on mount
    const validate = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
          setUser(pb.authStore.model);
        } catch {
          pb.authStore.clear();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    validate();

    // Subscribe to auth store changes (login/logout)
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const record = await pb.collection('users').authWithPassword(email, password);
    setUser(record.record);
    return record.record;
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

---

## 8. Routing & Role Guards

**File: `src/components/ProtectedRoute.jsx`** — create this file:

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route and redirects unauthenticated users to /login.
 * If `role` prop is provided, also checks the user's role.
 *
 * Usage:
 *   <ProtectedRoute role="receptionist"><ReceptionistDashboard /></ProtectedRoute>
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-slate-500 text-sm">Loading…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    // Redirect to their own dashboard instead of showing a 403
    const dest = user.role === 'doctor' ? '/doctor' : '/receptionist';
    return <Navigate to={dest} replace />;
  }

  return children;
}
```

---

## 9. index.html — Meta & Title

**File: `index.html`** — replace entirely:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Clinic Management System — patient registration, token queue, prescriptions, and billing." />
    <meta name="theme-color" content="#0f766e" />
    <link rel="icon" type="image/svg+xml" href="/clinic-icon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>Clinic Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

> Add a simple SVG stethoscope icon as `public/clinic-icon.svg` — any
> healthcare SVG from heroicons.com works.

---

## 10. vite.config.js — Build Optimisation

**File: `vite.config.js`** — replace entirely:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Warn if any chunk exceeds 500 kB
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Split vendor libraries into a separate chunk for better caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          pocketbase: ['pocketbase'],
          pdf: ['jspdf'],
        },
      },
    },
  },
  // Expose env variables that start with VITE_ to the client
  envPrefix: 'VITE_',
});
```

---

## 11. tailwind.config.js — Design Tokens

**File: `tailwind.config.js`** — replace entirely:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary teal — calm, clinical
        primary: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',  // main brand colour
          800: '#115e59',
          900: '#134e4a',
        },
        // Neutral slate for text and surfaces
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#334155',
          900: '#0f172a',
        },
        // Semantic colours
        waiting:     '#fbbf24', // amber-400
        in_progress: '#3b82f6', // blue-500
        done:        '#22c55e', // green-500
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / .08), 0 1px 2px -1px rgb(0 0 0 / .06)',
      },
    },
  },
  plugins: [],
};
```

---

## 12. Application Entry — main.jsx

**File: `src/main.jsx`** — replace entirely:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
```

**File: `src/index.css`** — replace entirely:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-surface-50 text-surface-900 font-sans text-sm antialiased;
  }

  h1 { @apply text-2xl font-semibold; }
  h2 { @apply text-xl  font-semibold; }
  h3 { @apply text-base font-medium; }
}

@layer components {
  .btn-primary {
    @apply bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium
           hover:bg-primary-800 active:bg-primary-900 transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-secondary {
    @apply bg-surface-100 text-surface-700 border border-surface-200
           px-4 py-2 rounded-lg text-sm font-medium
           hover:bg-surface-200 transition-colors;
  }

  .card {
    @apply bg-white rounded-card shadow-card p-4;
  }

  .input {
    @apply w-full border border-surface-200 rounded-lg px-3 py-2 text-sm
           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
           placeholder:text-slate-400;
  }

  .badge-waiting     { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100  text-amber-800; }
  .badge-in_progress { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100   text-blue-800; }
  .badge-done        { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100  text-green-800; }
}
```

---

## 13. App.jsx — Route Definitions

**File: `src/App.jsx`** — replace entirely:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Pages — lazy-loaded for smaller initial bundle
import { lazy, Suspense } from 'react';
const Login              = lazy(() => import('./pages/Login'));
const ReceptionistDash   = lazy(() => import('./pages/ReceptionistDashboard'));
const DoctorDash         = lazy(() => import('./pages/DoctorDashboard'));

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <span className="text-slate-400 text-sm animate-pulse">Loading…</span>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/login" replace />;
  return user.role === 'doctor'
    ? <Navigate to="/doctor" replace />
    : <Navigate to="/receptionist" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"      element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          <Route path="/receptionist" element={
            <ProtectedRoute role="receptionist">
              <ReceptionistDash />
            </ProtectedRoute>
          } />

          <Route path="/doctor" element={
            <ProtectedRoute role="doctor">
              <DoctorDash />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## 14. Pages — Login

**File: `src/pages/Login.jsx`** — create this file:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate        = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // If already logged in, redirect immediately
  if (user) {
    navigate(user.role === 'doctor' ? '/doctor' : '/receptionist', { replace: true });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const record = await login(email.trim(), password);
      navigate(record.role === 'doctor' ? '/doctor' : '/receptionist', { replace: true });
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-100 px-4">
      <div className="card w-full max-w-sm">
        {/* Logo / branding */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 mb-3">
            <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-primary-700">Clinic Management</h1>
          <p className="text-slate-500 text-xs mt-1">Staff portal — sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@clinic.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 15. Pages — Receptionist Dashboard

**File: `src/pages/ReceptionistDashboard.jsx`** — create this file:

```jsx
import { useState, useEffect, useCallback } from 'react';
import pb from '../lib/pb';
import { useAuth } from '../context/AuthContext';
import TokenQueue from '../components/TokenQueue';
import { generateBillPDF } from '../lib/pdfBill';

export default function ReceptionistDashboard() {
  const { user, logout } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  // --- Patient registration state ---
  const [form, setForm] = useState({ name: '', phone: '', dob: '', address: '' });
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // --- Today's tokens ---
  const [tokens, setTokens] = useState([]);

  const fetchTokens = useCallback(async () => {
    const result = await pb.collection('tokens').getFullList({
      filter: `date = "${today}"`,
      expand: 'patient',
      sort: 'token_number',
    });
    setTokens(result);
  }, [today]);

  useEffect(() => {
    fetchTokens();
    // Real-time subscription — updates queue live without page refresh
    pb.collection('tokens').subscribe('*', () => fetchTokens());
    return () => pb.collection('tokens').unsubscribe('*');
  }, [fetchTokens]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      // 1. Upsert patient by phone (simple lookup)
      let patient;
      const existing = await pb.collection('patients').getList(1, 1, {
        filter: `phone = "${form.phone}"`,
      });
      if (existing.items.length > 0) {
        patient = existing.items[0];
      } else {
        patient = await pb.collection('patients').create({
          name: form.name,
          phone: form.phone,
          dob: form.dob || null,
          address: form.address,
        });
      }

      // 2. Calculate next token number for today
      const todayTokens = await pb.collection('tokens').getList(1, 1, {
        filter: `date = "${today}"`,
        sort: '-token_number',
      });
      const nextToken = todayTokens.items.length > 0
        ? todayTokens.items[0].token_number + 1
        : 1;

      // 3. Create token
      await pb.collection('tokens').create({
        patient:      patient.id,
        token_number: nextToken,
        date:         today,
        status:       'waiting',
        receptionist: user.id,
      });

      setSuccessMsg(`Token #${nextToken} assigned to ${patient.name}`);
      setForm({ name: '', phone: '', dob: '', address: '' });
    } catch (err) {
      setFormError(err?.response?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateBill = async (tokenId) => {
    const token = await pb.collection('tokens').getOne(tokenId, { expand: 'patient' });
    const prescription = await pb.collection('prescriptions').getFirstListItem(
      `token = "${tokenId}"`, { expand: 'doctor' }
    ).catch(() => null);

    // Create a simple consultation bill
    const billItems = [{ description: 'Consultation fee', amount: 500 }];
    const total = billItems.reduce((s, i) => s + i.amount, 0);

    await pb.collection('bills').create({
      token:        tokenId,
      patient:      token.expand.patient.id,
      items:        JSON.stringify(billItems),
      total,
      paid:         false,
      receptionist: user.id,
    });

    generateBillPDF({ token, patient: token.expand.patient, billItems, total, prescription });
  };

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-primary-700">Receptionist — {user?.name}</h1>
        <button onClick={logout} className="btn-secondary text-xs">Sign out</button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Register patient */}
        <div className="card lg:col-span-1">
          <h2 className="mb-4">Register Patient</h2>
          <form onSubmit={handleRegister} className="space-y-3">
            <input
              className="input"
              placeholder="Patient name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className="input"
              placeholder="Phone number *"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
              pattern="[0-9]{10}"
              title="10-digit phone number"
            />
            <input
              className="input"
              type="date"
              placeholder="Date of birth"
              value={form.dob}
              onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Address"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />

            {formError  && <p className="text-red-600 text-xs">{formError}</p>}
            {successMsg && <p className="text-green-700 text-xs font-medium">{successMsg}</p>}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Assigning…' : 'Assign Token'}
            </button>
          </form>
        </div>

        {/* Right: Today's queue */}
        <div className="lg:col-span-2">
          <TokenQueue
            tokens={tokens}
            showBillButton
            onGenerateBill={handleGenerateBill}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 16. Pages — Doctor Dashboard

**File: `src/pages/DoctorDashboard.jsx`** — create this file:

```jsx
import { useState, useEffect, useCallback } from 'react';
import pb from '../lib/pb';
import { useAuth } from '../context/AuthContext';
import TokenQueue from '../components/TokenQueue';

const EMPTY_RX = { diagnosis: '', medicines: [{ name: '', dosage: '', duration: '' }], notes: '' };

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [tokens, setTokens]           = useState([]);
  const [active, setActive]           = useState(null); // currently selected token
  const [rx, setRx]                   = useState(EMPTY_RX);
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState('');

  const fetchTokens = useCallback(async () => {
    const result = await pb.collection('tokens').getFullList({
      filter: `date = "${today}" && status != "done"`,
      expand: 'patient',
      sort: 'token_number',
    });
    setTokens(result);
  }, [today]);

  useEffect(() => {
    fetchTokens();
    pb.collection('tokens').subscribe('*', () => fetchTokens());
    return () => pb.collection('tokens').unsubscribe('*');
  }, [fetchTokens]);

  const selectToken = async (token) => {
    setActive(token);
    setSavedMsg('');
    setRx(EMPTY_RX);
    // Mark as in_progress
    if (token.status === 'waiting') {
      await pb.collection('tokens').update(token.id, { status: 'in_progress', doctor: user.id });
    }
  };

  const addMedicine = () => {
    setRx(r => ({ ...r, medicines: [...r.medicines, { name: '', dosage: '', duration: '' }] }));
  };

  const updateMedicine = (i, field, value) => {
    setRx(r => {
      const meds = [...r.medicines];
      meds[i] = { ...meds[i], [field]: value };
      return { ...r, medicines: meds };
    });
  };

  const savePresription = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await pb.collection('prescriptions').create({
        token:     active.id,
        patient:   active.expand.patient.id,
        doctor:    user.id,
        medicines: JSON.stringify(rx.medicines.filter(m => m.name.trim())),
        diagnosis: rx.diagnosis,
        notes:     rx.notes,
      });
      await pb.collection('tokens').update(active.id, { status: 'done' });
      setSavedMsg('Prescription saved. Token marked done.');
      setActive(null);
      setRx(EMPTY_RX);
    } catch {
      setSavedMsg('Error saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-100">
      <header className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-primary-700">Doctor — {user?.name}</h1>
        <button onClick={logout} className="btn-secondary text-xs">Sign out</button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Queue */}
        <div className="lg:col-span-1">
          <TokenQueue tokens={tokens} onSelectToken={selectToken} activeId={active?.id} />
        </div>

        {/* Right: Prescription form */}
        <div className="card lg:col-span-2">
          {active ? (
            <>
              <h2 className="mb-1">
                Token #{active.token_number} — {active.expand?.patient?.name}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Phone: {active.expand?.patient?.phone}
              </p>

              <div className="space-y-3">
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Diagnosis"
                  value={rx.diagnosis}
                  onChange={e => setRx(r => ({ ...r, diagnosis: e.target.value }))}
                />

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Medicines</p>
                  {rx.medicines.map((m, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                      <input className="input" placeholder="Medicine name" value={m.name}
                        onChange={e => updateMedicine(i, 'name', e.target.value)} />
                      <input className="input" placeholder="Dosage" value={m.dosage}
                        onChange={e => updateMedicine(i, 'dosage', e.target.value)} />
                      <input className="input" placeholder="Duration" value={m.duration}
                        onChange={e => updateMedicine(i, 'duration', e.target.value)} />
                    </div>
                  ))}
                  <button type="button" onClick={addMedicine} className="btn-secondary text-xs">
                    + Add medicine
                  </button>
                </div>

                <textarea
                  className="input"
                  rows={2}
                  placeholder="Additional notes"
                  value={rx.notes}
                  onChange={e => setRx(r => ({ ...r, notes: e.target.value }))}
                />

                {savedMsg && <p className="text-xs text-primary-700 font-medium">{savedMsg}</p>}

                <button onClick={savePresription} className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save & Mark Done'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <p className="text-sm">Select a token from the queue to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 17. Components — ProtectedRoute

Already written in [Section 8](#8-routing--role-guards).

---

## 18. Components — TokenQueue (Real-time)

**File: `src/components/TokenQueue.jsx`** — create this file:

```jsx
/**
 * TokenQueue — reusable queue display used by both dashboards.
 *
 * Props:
 *   tokens         – array of token records (already expanded with patient)
 *   onSelectToken  – (token) => void   (Doctor view)
 *   activeId       – string            (highlight selected token in Doctor view)
 *   showBillButton – bool              (Receptionist view)
 *   onGenerateBill – (tokenId) => void (Receptionist view)
 */
export default function TokenQueue({
  tokens = [],
  onSelectToken,
  activeId,
  showBillButton,
  onGenerateBill,
}) {
  const statusOrder = { waiting: 0, in_progress: 1, done: 2 };
  const sorted = [...tokens].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const badge = (status) => {
    const map = {
      waiting:     'badge-waiting',
      in_progress: 'badge-in_progress',
      done:        'badge-done',
    };
    const label = { waiting: 'Waiting', in_progress: 'In Progress', done: 'Done' };
    return <span className={map[status] || ''}>{label[status] || status}</span>;
  };

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <h2>Today's Queue</h2>
        <span className="text-xs text-slate-500">{tokens.length} patient{tokens.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-8">No tokens today</p>
      )}

      <ul className="space-y-2">
        {sorted.map(token => (
          <li
            key={token.id}
            onClick={() => onSelectToken?.(token)}
            className={[
              'flex items-center justify-between p-3 rounded-lg border transition-colors',
              onSelectToken ? 'cursor-pointer hover:border-primary-400' : '',
              activeId === token.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-surface-200 bg-surface-50',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                {token.token_number}
              </span>
              <div>
                <p className="font-medium text-sm leading-tight">
                  {token.expand?.patient?.name ?? '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {token.expand?.patient?.phone ?? ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {badge(token.status)}
              {showBillButton && token.status === 'done' && (
                <button
                  onClick={e => { e.stopPropagation(); onGenerateBill?.(token.id); }}
                  className="btn-secondary text-xs py-1"
                >
                  Bill
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 19. Billing — PDF Generation

**File: `src/lib/pdfBill.js`** — create this file:

```js
import jsPDF from 'jspdf';

/**
 * Generates and auto-downloads a bill PDF.
 *
 * @param {{ token, patient, billItems, total, prescription }} params
 */
export function generateBillPDF({ token, patient, billItems, total, prescription }) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a5' });
  const W    = doc.internal.pageSize.getWidth();
  let y      = 16;

  const line = (txt, x = 14, size = 10, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(txt, x, y);
    y += size * 0.5 + 2;
  };

  const hr = () => {
    doc.setDrawColor(200);
    doc.line(14, y, W - 14, y);
    y += 4;
  };

  // Header
  line('CLINIC MANAGEMENT', 14, 14, 'bold');
  line(`Date: ${new Date().toLocaleDateString()}`, W - 50, 9);
  y -= 6;
  hr();

  // Patient details
  line(`Patient: ${patient.name}`, 14, 10, 'bold');
  line(`Phone:   ${patient.phone}`);
  line(`Token:   #${token.token_number}`);
  hr();

  // Bill items
  line('BILL', 14, 11, 'bold');
  billItems.forEach(item => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(item.description, 14, y);
    doc.text(`₹ ${item.amount.toFixed(2)}`, W - 14, y, { align: 'right' });
    y += 6;
  });
  hr();

  // Total
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', 14, y);
  doc.text(`₹ ${total.toFixed(2)}`, W - 14, y, { align: 'right' });
  y += 8;

  // Prescription (if available)
  if (prescription) {
    hr();
    line('PRESCRIPTION', 14, 11, 'bold');
    if (prescription.diagnosis) line(`Diagnosis: ${prescription.diagnosis}`);
    const meds = JSON.parse(prescription.medicines || '[]');
    meds.forEach((m, i) => {
      line(`${i + 1}. ${m.name}  |  ${m.dosage}  |  ${m.duration}`);
    });
    if (prescription.notes) line(`Notes: ${prescription.notes}`);
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Thank you for visiting. Please retain this receipt.', W / 2, y, { align: 'center' });

  doc.save(`bill-token-${token.token_number}-${patient.name.replace(/\s+/g, '_')}.pdf`);
}
```

---

## 20. Error Boundary

**File: `src/components/ErrorBoundary.jsx`** — create this file:

```jsx
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'An unexpected error occurred.' };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to a logging service
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-surface-100">
          <div className="card text-center max-w-sm">
            <h2 className="text-red-600 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-4">{this.state.message}</p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 21. GitHub Actions CI

**File: `.github/workflows/ci.yml`** — create this file:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
        env:
          VITE_PB_URL: https://placeholder.example.com
          VITE_APP_NAME: Clinic Management
```

---

## 22. Deployment — PocketBase on a VPS

PocketBase is a single binary. The recommended production setup is to run it
behind nginx on a ₹500/month VPS (DigitalOcean, Hetzner, etc.).

### Step 1 — Download & install

```bash
# On your VPS (Ubuntu 22.04)
wget https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_linux_amd64.zip
unzip pocketbase_linux_amd64.zip -d /opt/pocketbase
chmod +x /opt/pocketbase/pocketbase
```

### Step 2 — Systemd service

**File: `/etc/systemd/system/pocketbase.service`**

```ini
[Unit]
Description=PocketBase — Clinic Management
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve \
  --http="127.0.0.1:8090" \
  --dir="/opt/pocketbase/pb_data"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now pocketbase
```

### Step 3 — nginx reverse proxy with HTTPS

```nginx
server {
    listen 443 ssl;
    server_name pb.yourclinic.com;

    ssl_certificate     /etc/letsencrypt/live/pb.yourclinic.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pb.yourclinic.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8090;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        # Required for PocketBase SSE (real-time subscriptions)
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 300s;
    }
}
server {
    listen 80;
    server_name pb.yourclinic.com;
    return 301 https://$host$request_uri;
}
```

```bash
certbot --nginx -d pb.yourclinic.com
nginx -t && systemctl reload nginx
```

### Step 4 — Backups

```bash
# Cron job: backup pb_data daily at 2 AM
crontab -e
# Add:
0 2 * * * tar -czf /backups/pb_data_$(date +\%Y\%m\%d).tar.gz /opt/pocketbase/pb_data
```

---

## 23. Deployment — Frontend on Vercel / Netlify

### Vercel

1. Push to GitHub main branch.
2. Import the repo on vercel.com → Framework: Vite.
3. Add environment variable: `VITE_PB_URL = https://pb.yourclinic.com`
4. Deploy. Done.

**File: `vercel.json`** — create this for SPA routing:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### Netlify

**File: `public/_redirects`** — create this for SPA routing:

```
/*  /index.html  200
```

Set `VITE_PB_URL` in Netlify → Site settings → Environment variables.

---

## 24. Final Checklist

Work through this before considering the app production-ready.

### Infrastructure
- [ ] PocketBase running on VPS with systemd
- [ ] PocketBase behind nginx with HTTPS (Let's Encrypt)
- [ ] Daily backup cron job configured
- [ ] PocketBase admin password changed from default
- [ ] PocketBase SMTP configured for auth emails (optional but recommended)

### PocketBase Data Model
- [ ] `users` collection has `role` and `name` fields
- [ ] `patients`, `tokens`, `prescriptions`, `bills` collections created
- [ ] API rules set correctly on every collection (see Section 6)
- [ ] At least one doctor and one receptionist user created via admin UI

### Frontend
- [ ] `.env.local` present locally (not committed)
- [ ] `.env.production` values set in Vercel/Netlify secrets
- [ ] `VITE_PB_URL` points to production PocketBase URL
- [ ] `vercel.json` or `public/_redirects` in place for SPA routing
- [ ] Build passes: `npm run build` with no errors
- [ ] Lint passes: `npm run lint` with no warnings

### Security
- [ ] No hardcoded URLs or credentials in source code
- [ ] PocketBase admin UI is not publicly accessible on port 8090 (nginx proxies it)
- [ ] HTTPS enforced; HTTP redirects to HTTPS
- [ ] PocketBase collection API rules restrict mutations to correct roles

### Code Quality
- [ ] All new files follow the structure in `src/`
- [ ] `prettier` formatting applied: `npm run format`
- [ ] GitHub Actions CI passes on push to `main`

---

*Last updated: June 2026*
