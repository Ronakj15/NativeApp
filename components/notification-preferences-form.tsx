"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Profile } from "@/lib/types"

export function NotificationPreferencesForm({ profile }: { profile: Profile }) {
  const [notifSound, setNotifSound] = useState(profile.notif_sound ?? true)
  const [notifLectures, setNotifLectures] = useState(profile.notif_lectures ?? true)
  const [notifAttendance, setNotifAttendance] = useState(profile.notif_attendance ?? true)

  async function updatePreference(key: string, value: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ [key]: value })
      .eq("id", profile.id)

    if (error) {
      toast.error("Failed to update preference")
      return false
    }
    return true
  }

  async function handleSoundChange(v: boolean) {
    setNotifSound(v)
    await updatePreference("notif_sound", v)
  }

  async function handleLecturesChange(v: boolean) {
    setNotifLectures(v)
    await updatePreference("notif_lectures", v)
  }

  async function handleAttendanceChange(v: boolean) {
    setNotifAttendance(v)
    await updatePreference("notif_attendance", v)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Control how and when you want to be alerted.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-base">Push Sounds</Label>
              <p className="text-[0.8rem] text-muted-foreground">Play a sound on native push notifications.</p>
            </div>
            <Switch checked={notifSound} onCheckedChange={handleSoundChange} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-base">Live Lectures</Label>
              <p className="text-[0.8rem] text-muted-foreground">Get notified when a lecture starts.</p>
            </div>
            <Switch checked={notifLectures} onCheckedChange={handleLecturesChange} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-base">Attendance Updates</Label>
              <p className="text-[0.8rem] text-muted-foreground">Alerts when you are marked absent.</p>
            </div>
            <Switch checked={notifAttendance} onCheckedChange={handleAttendanceChange} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
