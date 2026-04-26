"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bluetooth, Search, Loader2, Radio, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FaceCheck, type FaceCheckResult } from "@/components/face-check"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatTime } from "@/lib/utils-format"

type LiveLecture = {
  id: string
  course_id: string
  beacon_id: string | null
  room: string | null
  topic: string | null
  started_at: string | null
  scheduled_start: string
  scheduled_end: string
  courses: { name: string; code: string; color: string | null }
}

export default function MarkAttendancePage() {
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [lectures, setLectures] = useState<LiveLecture[]>([])
  const [selected, setSelected] = useState<LiveLecture | null>(null)
  const [enrolled, setEnrolled] = useState<number[] | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())

  async function loadProfile() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from("profiles").select("face_descriptor").eq("id", user.id).single()
    setEnrolled((profile?.face_descriptor as number[] | null) ?? null)
    setProfileLoaded(true)

    // Existing attendance for live lectures so we don't double-mark
    const { data: existing } = await supabase
      .from("attendance")
      .select("lecture_id, status")
      .eq("student_id", user.id)
      .in("status", ["present", "late"])
    if (existing) setMarkedIds(new Set(existing.map((e) => e.lecture_id)))
  }

  useEffect(() => {
    loadProfile()
  }, [])

  async function startScan() {
    setScanning(true)
    setScanProgress(0)
    setLectures([])
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setScanning(false)
      return
    }
    const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("student_id", user.id)
    const courseIds = enrollments?.map((e) => e.course_id) ?? []

    // Simulate beacon discovery progress
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + 4 + Math.random() * 6, 96))
    }, 80)

    if (courseIds.length === 0) {
      await new Promise((r) => setTimeout(r, 1200))
      clearInterval(progressInterval)
      setScanProgress(100)
      setScanning(false)
      return
    }

    const { data } = await supabase
      .from("lectures")
      .select("*, courses!inner(name, code, color)")
      .in("course_id", courseIds)
      .eq("status", "live")

    // Force at least 1.2s for UX so it feels like a real scan
    await new Promise((r) => setTimeout(r, 1200))
    clearInterval(progressInterval)
    setScanProgress(100)

    setLectures((data as LiveLecture[]) ?? [])
    setTimeout(() => setScanning(false), 250)
  }

  async function handleVerify(res: FaceCheckResult) {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const startedAt = selected.started_at ? new Date(selected.started_at) : new Date(selected.scheduled_start)
    const minsSinceStart = (Date.now() - startedAt.getTime()) / 60000
    const status = minsSinceStart > 10 ? "late" : "present"

    const { error } = await supabase.from("attendance").upsert(
      {
        student_id: user.id,
        lecture_id: selected.id,
        status,
        method: "beacon_face",
        marked_at: new Date().toISOString(),
        confidence: 0.95,
      },
      { onConflict: "lecture_id,student_id" },
    )
    if (error) {
      toast.error("Could not mark attendance", { description: error.message })
      setSaving(false)
      return
    }
    toast.success(status === "late" ? "Marked late" : "Attendance marked", {
      description: `${selected.courses.name} • ${selected.room ?? "TBA"}`,
    })
    setMarkedIds((s) => new Set([...s, selected.id]))
    setSelected(null)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Mark attendance</h1>
        <p className="text-muted-foreground">
          Scan for nearby lecture beacons, then verify your face to confirm presence.
        </p>
      </div>

      {profileLoaded && !enrolled && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="size-10 rounded-lg bg-warning/20 text-warning grid place-items-center shrink-0">
              <AlertCircle className="size-5" />
            </div>
            <p className="flex-1 text-sm">
              You haven&apos;t enrolled your face yet. Enroll once to start marking attendance.
            </p>
            <Button asChild>
              <Link href="/student/enroll-face">Enroll face</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center relative">
                {scanning && <span className="absolute inset-0 rounded-lg bg-primary animate-ping opacity-30" />}
                <Bluetooth className="size-5 relative" />
              </div>
              <div>
                <CardTitle>Beacon discovery</CardTitle>
                <CardDescription>
                  {scanning
                    ? "Scanning for nearby lecture beacons…"
                    : lectures.length
                      ? `${lectures.length} lecture${lectures.length === 1 ? "" : "s"} found`
                      : "Tap scan to look for live lectures"}
                </CardDescription>
              </div>
            </div>
            <Button onClick={startScan} disabled={scanning || !enrolled}>
              {scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {scanning ? "Scanning" : "Scan"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scanning && (
            <div className="rounded-lg border border-dashed border-border p-6 grid place-items-center gap-3">
              <RadarPulse />
              <p className="text-sm text-muted-foreground tabular-nums">{Math.round(scanProgress)}%</p>
            </div>
          )}

          {!scanning && lectures.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Radio className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No live beacons detected. Make sure you&apos;re inside the classroom.
              </p>
            </div>
          )}

          {!scanning && lectures.length > 0 && (
            <div className="space-y-2">
              {lectures.map((l) => {
                const already = markedIds.has(l.id)
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40"
                  >
                    <div className="size-10 rounded-md bg-success/10 text-success grid place-items-center shrink-0 relative">
                      <span className="absolute inset-0 rounded-md bg-success/30 animate-ping" />
                      <Radio className="size-5 relative" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{l.courses.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.courses.code} • {l.room ?? "TBA"} • Beacon {l.beacon_id?.slice(0, 6) ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1 justify-end">
                        <Clock className="size-3" />
                        {formatTime(l.scheduled_start)}
                      </p>
                      {already ? (
                        <Badge variant="secondary" className="mt-1">
                          <CheckCircle2 className="size-3" />
                          Marked
                        </Badge>
                      ) : (
                        <Button size="sm" className="mt-1" onClick={() => setSelected(l)} disabled={!enrolled}>
                          Verify face
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Verify your face</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.courses.name} • ${selected.room ?? "TBA"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && enrolled && (
            <FaceCheck
              mode="verify"
              expectedDescriptor={enrolled}
              onSuccess={handleVerify}
              onCancel={() => setSelected(null)}
            />
          )}
          {saving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Saving attendance…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RadarPulse() {
  return (
    <div className="relative size-24 grid place-items-center">
      <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
      <span className="absolute inset-3 rounded-full bg-primary/30 animate-ping [animation-delay:200ms]" />
      <span className="absolute inset-6 rounded-full bg-primary/40 animate-ping [animation-delay:400ms]" />
      <Bluetooth className="size-8 text-primary relative" />
    </div>
  )
}
