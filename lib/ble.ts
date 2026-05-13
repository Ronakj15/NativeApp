/**
 * BLE Service – Native Capacitor Bluetooth Low Energy
 *
 * Faculty: Advertises a BLE peripheral with the lecture's beacon_id in the device name
 * Student: Scans for nearby BLE peripherals and matches the beacon_id
 *
 * Uses @capacitor-community/bluetooth-le which works on both Android & iOS.
 * Falls back to Web Bluetooth (navigator.bluetooth) when running in a desktop browser.
 */

import { BleClient, BleDevice, ScanResult, numberToUUID } from "@capacitor-community/bluetooth-le"
import { Capacitor } from "@capacitor/core"

// ── Constants ──
// We use a custom 128-bit UUID for the Viso attendance service
const VISO_SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb"
// Characteristic that holds the beacon identifier string
const BEACON_ID_CHAR_UUID = "0000ff01-0000-1000-8000-00805f9b34fb"

let initialized = false

// ── Initialize BLE ──
async function ensureInitialized() {
  if (initialized) return
  try {
    await BleClient.initialize({ androidNeverForLocation: true })
    initialized = true
  } catch (err) {
    console.error("[BLE] init failed:", err)
    throw err
  }
}

// ── Check Platform ──
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// ── Request Permissions (Android 12+) ──
export async function requestBlePermissions(): Promise<boolean> {
  try {
    await ensureInitialized()
    // On Android 12+, BleClient.initialize handles permission prompts
    // On iOS, permission prompt triggers on first scan/advertise
    const enabled = await BleClient.isEnabled()
    if (!enabled) {
      // Prompt user to turn on Bluetooth
      try {
        await BleClient.enable()
      } catch {
        return false
      }
    }
    return true
  } catch (err) {
    console.error("[BLE] permission error:", err)
    return false
  }
}

// ──────────────────────────────────────────────
// FACULTY: BLE Advertising (Broadcast beacon)
// ──────────────────────────────────────────────

let isAdvertising = false

/**
 * Start advertising the beacon ID via BLE.
 * The beacon ID is embedded in the local name of the BLE advertisement
 * so student devices can discover it by scanning.
 *
 * On native platforms: Uses BLE peripheral advertising
 * On web: No-op (faculty can use a physical BLE beacon instead)
 */
export async function startAdvertising(beaconId: string): Promise<boolean> {
  if (!isNative()) {
    console.log("[BLE] Web platform — skipping native BLE advertising. Use a physical beacon.")
    return false
  }

  try {
    await ensureInitialized()
    const enabled = await requestBlePermissions()
    if (!enabled) return false

    // Start BLE advertisement with the beacon ID as the device name
    // The @capacitor-community/bluetooth-le plugin supports advertising
    // via the startAdvertising method (available on Android & iOS)
    await BleClient.startAdvertising({
      name: beaconId,
      // Advertise with our custom Viso service UUID so students can filter by it
      services: [VISO_SERVICE_UUID],
      includeTxPowerLevel: false,
    })

    isAdvertising = true
    console.log(`[BLE] Advertising started: ${beaconId}`)
    return true
  } catch (err: any) {
    console.error("[BLE] startAdvertising failed:", err)
    // Some devices don't support peripheral mode — that's OK
    // Faculty can still use a physical BLE beacon
    return false
  }
}

/**
 * Stop BLE advertising
 */
export async function stopAdvertising(): Promise<void> {
  if (!isAdvertising) return
  try {
    await BleClient.stopAdvertising()
    isAdvertising = false
    console.log("[BLE] Advertising stopped")
  } catch (err) {
    console.error("[BLE] stopAdvertising failed:", err)
  }
}

export function getIsAdvertising(): boolean {
  return isAdvertising
}

// ──────────────────────────────────────────────
// STUDENT: BLE Scanning (Discover beacon)
// ──────────────────────────────────────────────

export type ScanStatus = "idle" | "scanning" | "found" | "not-found" | "error"

export type BeaconScanResult = {
  status: ScanStatus
  matchedDeviceName?: string
  rssi?: number
  error?: string
}

/**
 * Scan for a specific beacon ID broadcast by the faculty device.
 *
 * On native: Uses Capacitor BLE scanning (background-capable)
 * On web: Falls back to navigator.bluetooth.requestDevice() if available
 *
 * @param beaconId   The beacon_id from the lecture record (e.g. "VISO-A3X9K2")
 * @param timeoutMs  How long to scan before giving up (default 10s)
 */
export async function scanForBeaconId(
  beaconId: string,
  timeoutMs: number = 10000
): Promise<BeaconScanResult> {
  if (!isNative()) {
    return scanForBeaconWeb(beaconId)
  }
  return scanForBeaconNative(beaconId, timeoutMs)
}

// ── Native scan (Capacitor) ──
async function scanForBeaconNative(
  beaconId: string,
  timeoutMs: number
): Promise<BeaconScanResult> {
  try {
    await ensureInitialized()
    const enabled = await requestBlePermissions()
    if (!enabled) {
      return { status: "error", error: "Bluetooth is not enabled. Please turn on Bluetooth." }
    }

    return new Promise<BeaconScanResult>((resolve) => {
      let resolved = false
      const foundDevices: ScanResult[] = []

      // Set a timeout to stop scanning
      const timer = setTimeout(async () => {
        if (resolved) return
        resolved = true
        try { await BleClient.stopLEScan() } catch { /* ignore */ }

        // Check all found devices for a match
        const match = foundDevices.find(
          (d) =>
            d.localName?.toLowerCase().includes(beaconId.toLowerCase()) ||
            d.device?.name?.toLowerCase().includes(beaconId.toLowerCase())
        )

        if (match) {
          resolve({
            status: "found",
            matchedDeviceName: match.localName || match.device?.name || "Unknown",
            rssi: match.rssi,
          })
        } else {
          resolve({
            status: "not-found",
            error: `No beacon with ID "${beaconId}" found nearby. Scanned ${foundDevices.length} devices.`,
          })
        }
      }, timeoutMs)

      // Start scanning
      BleClient.requestLEScan(
        {
          // Scan for our specific Viso service UUID first
          services: [VISO_SERVICE_UUID],
          allowDuplicates: false,
        },
        (result: ScanResult) => {
          foundDevices.push(result)
          const name = result.localName || result.device?.name || ""
          console.log(`[BLE] Found device: ${name} (RSSI: ${result.rssi})`)

          // Immediate match — don't wait for timeout
          if (name.toLowerCase().includes(beaconId.toLowerCase())) {
            if (!resolved) {
              resolved = true
              clearTimeout(timer)
              BleClient.stopLEScan().catch(() => {})
              resolve({
                status: "found",
                matchedDeviceName: name,
                rssi: result.rssi,
              })
            }
          }
        }
      ).catch((err) => {
        // If service-filtered scan fails, retry with unfiltered scan
        console.log("[BLE] Service-filtered scan failed, trying unfiltered scan...")
        BleClient.requestLEScan(
          { allowDuplicates: false },
          (result: ScanResult) => {
            foundDevices.push(result)
            const name = result.localName || result.device?.name || ""
            console.log(`[BLE] Found device: ${name} (RSSI: ${result.rssi})`)
            if (name.toLowerCase().includes(beaconId.toLowerCase())) {
              if (!resolved) {
                resolved = true
                clearTimeout(timer)
                BleClient.stopLEScan().catch(() => {})
                resolve({
                  status: "found",
                  matchedDeviceName: name,
                  rssi: result.rssi,
                })
              }
            }
          }
        ).catch((scanErr) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ status: "error", error: scanErr.message })
          }
        })
      })
    })
  } catch (err: any) {
    return { status: "error", error: err.message }
  }
}

// ── Web fallback scan (Chrome Web Bluetooth) ──
async function scanForBeaconWeb(beaconId: string): Promise<BeaconScanResult> {
  if (!(navigator as any).bluetooth) {
    return {
      status: "error",
      error: "Web Bluetooth is not supported in this browser. Use the native app for BLE scanning.",
    }
  }

  try {
    const device: any = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["generic_access"],
    })

    const deviceName = device.name || device.id || ""
    if (deviceName.toLowerCase().includes(beaconId.toLowerCase())) {
      return { status: "found", matchedDeviceName: deviceName }
    } else {
      return {
        status: "not-found",
        error: `Expected beacon "${beaconId}", found "${deviceName}"`,
      }
    }
  } catch (err: any) {
    if (err.name === "NotFoundError") {
      // User cancelled the Bluetooth picker
      return { status: "idle" }
    }
    return { status: "error", error: err.message }
  }
}
