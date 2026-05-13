/**
 * BLE Service – Native Capacitor Bluetooth Low Energy
 *
 * Faculty: Advertises a BLE peripheral with the lecture's beacon_id in the device name
 * Student: Scans for nearby BLE peripherals and matches the beacon_id
 *
 * Uses @capgo/capacitor-bluetooth-low-energy which works on both Android & iOS,
 * and supports BOTH Peripheral (advertising) and Central (scanning) roles.
 */

import { BluetoothLowEnergy, BleDevice } from "@capgo/capacitor-bluetooth-low-energy"
import { Capacitor } from "@capacitor/core"

// ── Constants ──
// We use a custom 128-bit UUID for the Viso attendance service
const VISO_SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb"

let initializedCentral = false
let initializedPeripheral = false

// ── Initialize BLE ──
async function ensureInitialized(mode: "central" | "peripheral" = "central") {
  if (mode === "central" && initializedCentral) return
  if (mode === "peripheral" && initializedPeripheral) return
  
  try {
    await BluetoothLowEnergy.initialize({ mode })
    if (mode === "central") initializedCentral = true
    if (mode === "peripheral") initializedPeripheral = true
  } catch (err) {
    console.error(`[BLE] init (${mode}) failed:`, err)
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
    const { bluetooth } = await BluetoothLowEnergy.checkPermissions()
    if (bluetooth !== 'granted') {
      const result = await BluetoothLowEnergy.requestPermissions()
      if (result.bluetooth !== 'granted') return false
    }

    const { enabled } = await BluetoothLowEnergy.isEnabled()
    if (!enabled) {
      if (Capacitor.getPlatform() === 'android') {
        // Prompt user to turn on Bluetooth via settings
        await BluetoothLowEnergy.openBluetoothSettings()
        // We assume they turned it on. A more robust way would check isEnabled again after resume.
      } else {
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
 */
export async function startAdvertising(beaconId: string): Promise<boolean> {
  if (!isNative()) {
    console.log("[BLE] Web platform — skipping native BLE advertising. Use a physical beacon.")
    return false
  }

  try {
    await ensureInitialized("peripheral")
    const enabled = await requestBlePermissions()
    if (!enabled) return false

    await BluetoothLowEnergy.startAdvertising({
      name: beaconId,
      services: [VISO_SERVICE_UUID],
      includeTxPowerLevel: false,
    })

    isAdvertising = true
    console.log(`[BLE] Advertising started: ${beaconId}`)
    return true
  } catch (err: any) {
    console.error("[BLE] startAdvertising failed:", err)
    return false
  }
}

/**
 * Stop BLE advertising
 */
export async function stopAdvertising(): Promise<void> {
  if (!isAdvertising) return
  try {
    await BluetoothLowEnergy.stopAdvertising()
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
    await ensureInitialized("central")
    const enabled = await requestBlePermissions()
    if (!enabled) {
      return { status: "error", error: "Bluetooth is not enabled. Please turn on Bluetooth." }
    }

    return new Promise<BeaconScanResult>((resolve) => {
      let resolved = false
      let listenerHandle: any = null

      const finish = async (result: BeaconScanResult) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        if (listenerHandle) listenerHandle.remove()
        try { await BluetoothLowEnergy.stopScan() } catch { /* ignore */ }
        resolve(result)
      }

      // Set a timeout to stop scanning
      const timer = setTimeout(async () => {
        finish({
          status: "not-found",
          error: `No beacon with ID "${beaconId}" found nearby.`,
        })
      }, timeoutMs)

      // Start listening
      BluetoothLowEnergy.addListener("deviceScanned", (event) => {
        const device = event.device as any // BleDevice
        // Check localName (from advertisement) or name (from device config)
        const name = device.localName || device.name || ""
        console.log(`[BLE] Found device: ${name} (RSSI: ${device.rssi})`)

        if (name.toLowerCase().includes(beaconId.toLowerCase())) {
          finish({
            status: "found",
            matchedDeviceName: name,
            rssi: device.rssi,
          })
        }
      }).then(handle => {
        listenerHandle = handle
      })

      // Start scanning
      BluetoothLowEnergy.startScan({
        services: [VISO_SERVICE_UUID],
        allowDuplicates: false,
      }).catch((err) => {
        console.log("[BLE] Service-filtered scan failed, trying unfiltered scan...")
        BluetoothLowEnergy.startScan({ allowDuplicates: false }).catch((scanErr) => {
          finish({ status: "error", error: scanErr.message })
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
      return { status: "idle" }
    }
    return { status: "error", error: err.message }
  }
}
