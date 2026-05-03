# 🛰️ Viso: Next-Gen Attendance Management

Viso is a cutting-edge, mobile-first attendance management system designed for modern classrooms. It replaces manual registers and simple QR codes with **Native BLE Broadcasting** and **AI-powered Face Verification** to ensure zero-fraud, automated attendance tracking.

---

## 🚀 Key Features

### 1. Native BLE Proximity (Native App Only)
- **Faculty:** Acts as a BLE Peripheral, broadcasting a unique encrypted session ID.
- **Students:** Automatically scan and detect nearby lectures without manual device selection.
- **Verification:** Ensures the student is physically present in the classroom.

### 2. AI Face Recognition
- Built-in liveness detection to prevent photo-spoofing.
- Instant face matching against student profiles using `face-api.js`.
- Dual-layer security: **Proximity (BLE) + Identity (Face AI)**.

### 3. AI-Powered Timetables
- Generate optimized, conflict-free timetables using **Gemini AI**.
- Dynamic scheduling and real-time class notifications.

### 4. Real-time Analytics
- Comprehensive student attendance reports.
- Faculty dashboards for tracking engagement and trends.
- Automated absentee marking at the end of each session.

---

## 🏗️ Architecture

Viso is built using a **Static Client-Side Architecture** to ensure compatibility with native mobile webviews (Capacitor) and high performance.

- **Frontend:** Next.js 16 (Static Export)
- **Logic:** Vanilla JavaScript / TypeScript
- **Styling:** CSS3 + Lucide Icons
- **Backend:** Supabase (Auth, DB, Real-time)
- **Mobile Bridge:** Capacitor 8.3
- **Native Logic:** `@capacitor-community/bluetooth-le`

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (Latest LTS)
- NPM or PNPM

### 2. Installation
```bash
git clone https://github.com/Ronakj15/NativeApp.git
cd NativeApp
npm install
```

### 3. Development
```bash
npm run dev
```

### 4. Build for Web
```bash
npm run build
```
The static site will be generated in the `/out` directory.

---

## 📱 Native Mobile Setup

Viso is ready for Android and iOS deployment out of the box.

### Android
```bash
npm run build
npx cap sync android
npx cap open android
```

### iOS
```bash
npm run build
npx cap sync ios
npx cap open ios
```
*Note: Ensure you have Android Studio and Xcode installed for mobile builds.*

---

## 🔒 Security & Privacy
- **Face Data:** All face matching happens locally on the client for maximum privacy.
- **Private Repo:** This project is intended for private usage and secure campus deployment.

---

## 👨‍💻 Author
**Ronak J**  
[GitHub Profile](https://github.com/Ronakj15)

---
*Generated with ❤️ by Antigravity*
