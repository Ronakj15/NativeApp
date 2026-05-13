"use client"

/**
 * PermissionsGate – Requests required native permissions on app startup.
 * 
 * On native platforms (Android/iOS), this component:
 * 1. Requests Bluetooth permissions (mandatory for attendance)
 * 2. Requests Camera permissions (needed for face recognition)
 * 3. Shows a blocking overlay until permissions are granted
 * 
 * On web, it renders children immediately (browser handles its own prompts).
 */

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { BleClient } from "@capacitor-community/bluetooth-le"
import { Camera } from "@capacitor/camera"
import { Bluetooth, CameraIcon, ShieldCheck, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PermissionStatus = "pending" | "granted" | "denied" | "error"

export function PermissionsGate({ children }: { children: React.ReactNode }) {
  const [isNative, setIsNative] = useState(false)
  const [bleStatus, setBleStatus] = useState<PermissionStatus>("pending")
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>("pending")
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setIsNative(false)
      setChecking(false)
      return
    }

    setIsNative(true)
    checkPermissions()
  }, [])

  async function checkPermissions() {
    setChecking(true)

    // Check BLE
    try {
      await BleClient.initialize({ androidNeverForLocation: true })
      const enabled = await BleClient.isEnabled()
      if (enabled) {
        setBleStatus("granted")
      } else {
        setBleStatus("denied")
      }
    } catch (err) {
      console.error("[Permissions] BLE check failed:", err)
      setBleStatus("error")
    }

    // Check Camera
    try {
      const cameraPerms = await Camera.checkPermissions()
      if (cameraPerms.camera === "granted") {
        setCameraStatus("granted")
      } else if (cameraPerms.camera === "denied") {
        setCameraStatus("denied")
      } else {
        setCameraStatus("pending")
      }
    } catch (err) {
      console.error("[Permissions] Camera check failed:", err)
      setCameraStatus("error")
    }

    setChecking(false)
  }

  async function requestBle() {
    try {
      setBleStatus("pending")
      await BleClient.initialize({ androidNeverForLocation: true })
      const enabled = await BleClient.isEnabled()
      if (!enabled) {
        try {
          await BleClient.enable()
        } catch {
          setBleStatus("denied")
          return
        }
      }
      setBleStatus("granted")
    } catch (err) {
      console.error("[Permissions] BLE request failed:", err)
      setBleStatus("denied")
    }
  }

  async function requestCamera() {
    try {
      setCameraStatus("pending")
      const result = await Camera.requestPermissions({ permissions: ["camera"] })
      if (result.camera === "granted") {
        setCameraStatus("granted")
      } else {
        setCameraStatus("denied")
      }
    } catch (err) {
      console.error("[Permissions] Camera request failed:", err)
      setCameraStatus("denied")
    }
  }

  async function requestAll() {
    await requestBle()
    await requestCamera()
  }

  // On web, skip the gate entirely
  if (!isNative && !checking) {
    return <>{children}</>
  }

  // Still checking
  if (checking) {
    return null
  }

  // All permissions granted — render the app
  const allGranted = bleStatus === "granted" && cameraStatus === "granted"
  if (allGranted) {
    return <>{children}</>
  }

  // Show the permission request screen
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto size-16 rounded-full bg-primary/10 grid place-items-center mb-4">
            <ShieldCheck className="size-8 text-primary" />
          </div>
          <CardTitle className="text-xl">App Permissions Required</CardTitle>
          <CardDescription className="mt-2">
            Viso needs Bluetooth and Camera access to work properly. These are required for attendance verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* BLE Permission */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${
              bleStatus === "granted" ? "bg-green-500/15 text-green-500" : 
              bleStatus === "denied" || bleStatus === "error" ? "bg-red-500/15 text-red-500" : 
              "bg-blue-500/15 text-blue-500"
            }`}>
              <Bluetooth className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Bluetooth</p>
              <p className="text-xs text-muted-foreground">
                {bleStatus === "granted" ? "✅ Enabled" :
                 bleStatus === "denied" ? "❌ Denied — tap to retry" :
                 bleStatus === "error" ? "⚠️ Not available" :
                 "Needed for proximity attendance"}
              </p>
            </div>
            {bleStatus !== "granted" && (
              <Button size="sm" variant="outline" onClick={requestBle}>
                Enable
              </Button>
            )}
          </div>

          {/* Camera Permission */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${
              cameraStatus === "granted" ? "bg-green-500/15 text-green-500" : 
              cameraStatus === "denied" || cameraStatus === "error" ? "bg-red-500/15 text-red-500" : 
              "bg-purple-500/15 text-purple-500"
            }`}>
              <CameraIcon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Camera</p>
              <p className="text-xs text-muted-foreground">
                {cameraStatus === "granted" ? "✅ Granted" :
                 cameraStatus === "denied" ? "❌ Denied — tap to retry" :
                 cameraStatus === "error" ? "⚠️ Not available" :
                 "Needed for face recognition"}
              </p>
            </div>
            {cameraStatus !== "granted" && (
              <Button size="sm" variant="outline" onClick={requestCamera}>
                Allow
              </Button>
            )}
          </div>

          {/* Warning for denied permissions */}
          {(bleStatus === "denied" || cameraStatus === "denied") && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                If permissions were denied, you may need to enable them manually in your device's Settings → Apps → Viso → Permissions.
              </p>
            </div>
          )}

          <Button className="w-full" size="lg" onClick={requestAll}>
            Grant All Permissions
          </Button>

          {/* Allow skipping (but show warning) */}
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground" 
            onClick={() => {
              // Force-grant to let user through (features will fail gracefully)
              setBleStatus("granted")
              setCameraStatus("granted")
            }}
          >
            Skip for now (limited functionality)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
