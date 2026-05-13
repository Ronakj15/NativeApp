# Viso Smart Attendance App - AI Development Context

This document serves as a comprehensive context file for future AI interactions. It details the architectural decisions, migrations, and bug fixes applied to the Viso Attendance Management project to transition it from a web prototype to a production-ready native mobile application.

## 1. Architecture Shift: Web to Native Mobile
The project was originally built as a Next.js web application utilizing Web Bluetooth APIs. It has been successfully migrated to a **Static-First Native Hybrid Architecture** using Capacitor.

*   **Framework:** Next.js (Static Export mode `output: "export"`)
*   **Native Container:** Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios`)
*   **Repository:** Migrated to private repository `Ronakj15/NativeApp.git`.

## 2. Core Feature: Native Bluetooth Low Energy (BLE)
Web Bluetooth (`navigator.bluetooth.requestDevice`) is not supported inside native WebViews. We implemented a hybrid BLE service.

*   **Plugin:** `@capacitor-community/bluetooth-le` (v8.1.3+)
*   **Implementation (`lib/ble.ts`):**
    *   **Faculty (Peripheral):** Broadcasts a custom 128-bit UUID (`VISO_SERVICE_UUID`) with the lecture's `beacon_id` embedded in the advertisement name.
    *   **Student (Central):** Performs background-capable scanning for the specific `beacon_id` to register attendance automatically, eliminating manual device pairing dialogs.
    *   **Fallback:** Detects `Capacitor.isNativePlatform()`. Falls back to Web Bluetooth if running in a desktop browser.

## 3. Native App Permissions & Configuration
Significant updates were made to native configuration files to support BLE and Camera hardware.

*   **Android (`android/app/src/main/AndroidManifest.xml`):**
    *   Added modern Android 12+ BLE permissions: `BLUETOOTH_SCAN` (`neverForLocation`), `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`.
    *   Added `CAMERA` permission and hardware feature declaration.
    *   Fixed linting warnings by ordering `<uses-permission>` tags *before* the `<application>` tag and adding `tools:targetApi="s"` where necessary.
*   **iOS (`ios/App/App/Info.plist`):**
    *   Added mandatory usage descriptions (`NSBluetoothAlwaysUsageDescription`, `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`).
    *   Enabled background modes: `bluetooth-central` and `bluetooth-peripheral`.

## 4. Permissions Gate Component
Added `components/permissions-gate.tsx` and wrapped the `app/layout.tsx` with it.
*   **Purpose:** Web browsers prompt for permissions contextually, but native apps often need upfront verification. This component forces the user to grant Bluetooth and Camera permissions upon opening the native app before accessing core features.

## 5. Static Export State Management Fixes
Because the app is built using Next.js static export (`next build` with `output: "export"`), server-side revalidation methods like `router.refresh()` are **no-ops**. We fixed several real-time UI bugs by migrating to local state callbacks:

*   **Profile Updates (`app/faculty/profile/page.tsx`, `app/student/profile/page.tsx`, `components/profile-form.tsx`):** Replaced `router.refresh()` with an `onProfileUpdated` callback that triggers an immediate Supabase re-fetch.
*   **Notifications (`components/faculty-notification-composer.tsx`):** Replaced `router.refresh()` with local state array mutations (`setBroadcasts`) when sending or deleting notifications.
*   **Course Management (`components/courses-manager.tsx`):** Replaced `router.refresh()` with local state mutations for creating, updating, and deleting courses.

## 6. Native Filesystem & Sharing (CSV Export)
The standard web approach to downloading files (creating a `Blob` and triggering `a.click()`) fails silently inside native WebViews.

*   **Fix (`components/live-lecture-roster.tsx`):** Integrated `@capacitor/filesystem` and `@capacitor/share`. On native devices, CSV data is written to the device cache and then shared via the native share sheet. It falls back to `a.click()` on the web.

## 7. UI / UX Improvements
*   **Mobile Responsive Charts (`components/analytics-charts.tsx`):** Fixed chart overflow on mobile devices by implementing a stacked layout (`grid-cols-1`), applying a horizontal overflow scroll wrapper with a calculated `minWidth`, and adjusting axis font sizes for readability.
*   **Android Resource Cleanup:** Deleted redundant `drawable-v24` folders to resolve Android Studio inspection warnings.

## 8. Dependency Audit (May 2026)
All dependencies were audited and updated to their latest stable 2026 versions.

*   **Safe Updates Applied:** Next.js (16.2.6), React/React-DOM (19.2.6), Capacitor ecosystem (8.3.4), Supabase JS (2.105.4), Tailwind CSS (4.3.0), Gradle Wrapper (8.14.5).
*   **Major Updates Applied (with code migrations):**
    *   `lucide-react` (v1.14.0) - Replaced brand icons.
    *   `sonner` (v2.0.7)
    *   `recharts` (v3.8.1) - Removed redundant standalone `ResponsiveContainer` imports (now built-in) and applied `accessibilityLayer={false}` to suppress unwanted focus outlines.
    *   `@google/genai` - Migrated from legacy `@google/generative-ai` to the new v1 SDK, updating AI actions to use `GoogleGenAI` class and `.models.generateContent` API.
*   **Skipped/Frozen Dependencies:**
    *   `typescript` kept at 5.7.3 (avoided TS 6.0 breaking default strictness).
    *   `zod` kept at 3.x (avoided Zod 4.x major API rewrite).

## Known Constraints
*   **iOS Builds:** `npx cap run ios` must be executed on a macOS environment with Xcode installed.
*   **BLE Testing:** Android Emulators do not support BLE hardware passthrough. BLE testing *must* be done on physical devices.
