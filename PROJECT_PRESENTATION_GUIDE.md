# Project Presentation Guide: Next-Gen Attendance Management System

This document is your complete script and reference guide for your presentation. It breaks down the entire application flow, the technologies used, and specifically **how** each feature was implemented under the hood.

---

## 💻 1. Core Technology Stack
*Be prepared to mention these if asked about your architecture.*

- **Frontend Framework:** Next.js 14 (App Router), React, TypeScript.
- **Styling:** Tailwind CSS & shadcn/ui (for premium, responsive glassmorphism UI).
- **Backend & Database:** Supabase (PostgreSQL).
- **Authentication:** Supabase Auth with custom PostgreSQL Triggers.
- **Security:** Row Level Security (RLS) in PostgreSQL.
- **AI Integration:** Google Gemini 3.1 Pro & Flash (`@google/generative-ai`).
- **Biometrics:** `face-api.js` (TensorFlow.js based facial recognition).

---

## 🚀 2. Application Flow & Implementation Details

### A. Authentication & Onboarding
**What it does:** 
Users sign up using their email and choose a role: **Student** or **Faculty**.

**How it's implemented:**
- We use **Supabase Auth** to securely handle credentials.
- **Database Triggers:** When a user signs up, a PostgreSQL trigger (`handle_new_user()`) automatically intercepts the event and creates a linked record in our custom `profiles` table, storing their chosen role.
- **Security:** We implemented Row Level Security (RLS) to ensure that if a student logs in, the database physically rejects any attempts by them to read or write faculty-level data.

### B. Student Profile & Facial Enrollment
**What it does:** 
Students must complete their profile by selecting their Department, Year, and Division. They then scan their face using their webcam to enroll in the biometric system. Once saved, their class details are locked.

**How it's implemented:**
- **Profile Locking:** React state manages the form. We programmed the UI to check if the database already holds a value for Department/Year/Division. If it does, the dropdowns are `disabled` to prevent students from hopping between divisions.
- **Facial Recognition Tech:** We integrated `face-api.js`. It loads pre-trained machine learning models (SSD Mobilenet v1 for detection, Face Landmark 68 for features) directly in the browser. 
- **Storage:** Instead of saving an image (which is heavy and a privacy risk), the AI extracts a **128-dimensional Float32 array** (a mathematical map of the face) and stores it securely in the Supabase database.

### C. Timetable Management (Faculty Collaborative Setup)
**What it does:** 
Faculty can dynamically construct a weekly schedule for specific Departments, Years, and Divisions. They can set custom start and end times.

**How it's implemented:**
- **UI Architecture:** We moved away from rigid grids to a modern "Column Layout" where each day is mapped dynamically.
- **Data Fetching:** The UI queries the `courses` table based on the selected filters, then queries the `timetable_slots` table for those specific courses.
- **Collaboration:** Because our Supabase RLS policies grant the `faculty` role global write access to the `timetable_slots` table, any faculty member can instantly edit the schedule, and it syncs for everyone seamlessly. The exact faculty who creates the slot is recorded via their `user_id`.

### D. The Live Lecture & Smart Attendance Process (The Core Engine)
**What it does:** 
A faculty member starts a "Live Lecture". Students then use their devices to mark attendance by verifying their face. The faculty sees the attendance list populate in real-time.

**How it's implemented:**
- **Lecture Initialization:** The faculty clicks "Start Lecture", inserting a row into the `lectures` table with `status = 'active'`.
- **Real-time Sync:** The faculty dashboard subscribes to **Supabase Realtime Channels** (WebSockets). It listens for INSERT events on the `attendance` table.
- **Student Verification:** 
  1. The student opens the live scanner. 
  2. `face-api.js` captures a live frame from their webcam and extracts the live 128-dimensional descriptor.
  3. The system calculates the **Euclidean Distance** between the live face and the stored database face. If the distance is below a strict threshold (e.g., 0.4), it proves identity.
  4. (If enabled) The **HTML5 Geolocation API** ensures the student is physically within the classroom coordinates.
- **Secure Logging:** The system attempts to INSERT into the `attendance` table. RLS policies ensure this only succeeds if the lecture is currently `active`.

### E. AI Assistant (VISO Analytics)
**What it does:** 
Faculty can ask an AI assistant complex questions like "Who are my lowest performing students?" or "Summarize the attendance trends for CS Division A."

**How it's implemented:**
- **Data Aggregation:** Before calling the AI, our Next.js backend (`actions/ai-timetable.ts`) executes heavy SQL joins across `courses`, `lectures`, and `attendance` to calculate percentages and aggregate raw stats.
- **Prompt Engineering:** We inject this JSON data into a hidden system prompt sent to **Gemini 3.1 Pro**.
- **Execution:** Gemini acts as a data analyst, interpreting the raw JSON and returning human-readable, formatted Markdown insights directly into the chat UI.

### F. Automated CSV Reporting
**What it does:** 
Faculty can download attendance sheets that are intelligently named (e.g., `Software_Engineering_02_May.csv`).

**How it's implemented:**
- We built a custom client-side function that iterates through the attendance state array. 
- It formats the data into a comma-separated string, creates a Blob object (`type: 'text/csv'`), generates a temporary DOM URL, and programmatically triggers an HTML `<a>` download click.

---

## 🧹 Housekeeping / Cleanup

During the presentation or deployment, you can safely delete the following files to clean up your repository, as they are either legacy artifacts or redundant:

1. `package-lock.json` (Since your project is configured for `pnpm`, having NPM's lockfile causes Vercel build conflicts).
2. `proxy.ts` (This was meant to be Next.js middleware, but it must be named `middleware.ts` to actually function).
3. The `/scratch/` directory (These are temporary LLM workspace files).
4. `BLE_TESTING_GUIDE.md` (If you are fully utilizing Face Recognition now instead of Bluetooth).
