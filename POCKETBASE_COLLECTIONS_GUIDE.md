# PocketBase Collections Guide

This guide will help you set up and manage collections in PocketBase for your Clinic Management System.

## 1. What is a Collection?
A collection in PocketBase is like a table in a database. Each collection holds records (rows) with fields (columns).

---

## 2. Accessing the Admin UI
- Start your PocketBase server: `./pocketbase serve`
- Open [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/) in your browser.
- Log in with the admin credentials you set up on first run.

---

## 3. Creating a Collection
1. In the left sidebar, click **Collections**.
2. Click the **+ New Collection** button.
3. Enter a name (e.g., `patients`, `appointments`, `doctors`).
4. (Optional) Add a description.
5. Click **Create**.

---

## 4. Adding Fields to a Collection
1. After creating a collection, click its name in the sidebar.
2. Click **+ Add Field**.
3. Choose a field type (e.g., text, number, email, relation, file, etc.).
4. Enter a field name (e.g., `name`, `email`, `dob`, `doctor_id`).
5. Set options (required, unique, default value, etc.).
6. Click **Create**.

Repeat for all fields you need.

---

## 5. Example Collections for a Clinic
### Patients
- name (text, required)
- email (email, required, unique)
- dob (date)
- phone (text)
- address (text)

### Doctors
- name (text, required)
- specialty (text)
- email (email, required, unique)
- phone (text)

### Appointments
- patient (relation, required, points to `patients`)
- doctor (relation, required, points to `doctors`)
- date (date, required)
- time (text, required)
- notes (text)

---

## 6. Relations
- Use the **relation** field type to link records between collections (e.g., an appointment links to a patient and a doctor).

---

## 7. Managing Records
- Click a collection name to view/add/edit/delete records.
- Use the **+ New Record** button to add data.

---

## 8. API & Permissions
- Each collection has its own API endpoint (e.g., `/api/collections/patients/records`).
- Set permissions (who can read/write) in the collection settings.

---

## 9. More Resources
- [PocketBase Docs: Collections](https://pocketbase.io/docs/collections/)
- [PocketBase Docs: Fields](https://pocketbase.io/docs/fields/)
- [PocketBase Docs: Relations](https://pocketbase.io/docs/relations/)

---

## 10. API Rules & Permissions (Recommended)

For each collection, set permissions to control who can read, create, update, or delete records. In the PocketBase admin UI, go to the collection's **"Rules"** tab and set rules using PocketBase's simple query language. Here are some common rules:

### Public Collections (e.g., doctors)
- **List/Read:** `true` (anyone can view)
- **Create/Update/Delete:** `@admin` (only admin users)

### Private Collections (e.g., patients, appointments, prescriptions, bills)
- **List/Read:** `@request.auth.id != ''` (only logged-in users)
- **Create:** `@request.auth.id != ''` (only logged-in users)
- **Update/Delete:** `@request.auth.id = @collection.patients.id` (only the owner or admin)
- Or, for staff/doctor access, use role-based rules if you add a `role` field to users or staff.

### Example: Appointments
- **List/Read:** `@request.auth.id != ''` (only logged-in users)
- **Create:** `@request.auth.id != ''`
- **Update/Delete:** `@request.auth.id = @collection.appointments.patient` (only the patient who owns the appointment)

### Example: Patients
- **List/Read:** `@request.auth.id = id` (users can only read their own patient record)
- **Create:** `true` (allow registration)
- **Update/Delete:** `@request.auth.id = id` (users can only update/delete their own record)

### Example: Staff/Doctors
- **List/Read:** `@request.auth.id != ''` (only logged-in users)
- **Create/Update/Delete:** `@admin` (only admin)

### Admin-Only Collections
- Set all rules to `@admin` if only admins should access.

---

**Tip:**
- You can use advanced rules to allow doctors to see their own appointments, or staff to manage all patients, by referencing relations and user roles.
- See the [PocketBase Rules Docs](https://pocketbase.io/docs/collections-rules/) for more examples and syntax.

If you want specific rules for a collection, let me know the use case!
