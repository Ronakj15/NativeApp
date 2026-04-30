# Testing Real BLE Functionality

This guide explains how to test the real Bluetooth Low Energy (BLE) functionality of the Attendance Management App using a physical mobile device to broadcast the beacon signal, and Windows/Chrome to receive it.

## 1. Broadcaster App Recommendations

To simulate the physical BLE beacon used in classrooms, you will need a BLE peripheral/broadcaster app on your smartphone.

**Recommended Apps:**
* **Android:**
  * [nRF Connect for Mobile](https://play.google.com/store/apps/details?id=no.nordicsemi.android.mcp) (Highly recommended, standard for BLE development)
  * [LightBlue](https://play.google.com/store/apps/details?id=com.punchthrough.lightblueexplorer)
  * [BLE Peripheral Simulator](https://play.google.com/store/apps/details?id=io.vokal.bleperipheral)
* **iOS:**
  * [LightBlue](https://apps.apple.com/us/app/lightblue/id557428110)
  * [nRF Connect for Mobile](https://apps.apple.com/us/app/nrf-connect-for-mobile/id1054362403)

## 2. Step-by-Step Testing Workflow

Since the app dynamically generates a unique beacon ID (e.g., `beacon-a1b2c3d4`) for every lecture, you will need to manually configure your mobile app with this generated ID for each test.

### Step 1: Start the Lecture (Faculty Side)
1. Open the Faculty dashboard in your browser.
2. Start a live lecture.
3. The app will generate a random beacon ID. You will need to retrieve this `beacon_id`. Since the UI might not directly display the raw ID string for students, you can find it in your Supabase `lectures` table for the active lecture (look for the `beacon_id` column).

### Step 2: Configure the Broadcaster App (Mobile Device)
1. Open your chosen app (e.g., **nRF Connect**) on your mobile device.
2. Navigate to the **Advertiser** tab (in nRF Connect).
3. Add a new advertising record.
4. **Configuration Details:**
   * **Display Name / Complete Local Name:** Set this **exactly** to the `beacon_id` you retrieved from the database (e.g., `beacon-a1b2c3d4`). *This is critical, as the web app scans for devices with this specific name prefix.*
   * **Advertising Interval:** Set to `100ms - 250ms` for fast discovery.
   * **Connectable:** Ensure this is toggled **ON**. (Chrome's Web Bluetooth often ignores non-connectable devices depending on the platform).
5. Start broadcasting. Your phone is now acting as the classroom beacon!

### Step 3: Scan for the Beacon (Student Side on Windows/Chrome)
1. Ensure **Bluetooth is turned ON** on your Windows machine.
2. Open the Student dashboard in **Google Chrome**. *(Note: Web Bluetooth requires a secure context, so ensure you are accessing the app via `localhost` or an `https://` connection).*
3. When prompted on the Attendance Radar, click the **Scan & Verify Face** button.
4. Chrome will display a native browser dialog listing nearby Bluetooth devices. It is explicitly filtering for devices whose names match the `beacon_id`.
5. Select the device broadcasted by your phone and click **Pair/Connect**.
6. The app will recognize the beacon and proceed to the Face Verification step.

### Troubleshooting
* **Chrome finds no devices:** Ensure your phone screen is awake and the broadcaster app is running in the foreground. Mobile operating systems often throttle or stop BLE advertising when the app is backgrounded.
* **Permissions:** Verify that Chrome has permission to access Bluetooth devices in your Windows settings.
* **Browser Support:** Always use Chrome or Edge for this test. Firefox and Safari currently lack support for the Web Bluetooth API.
