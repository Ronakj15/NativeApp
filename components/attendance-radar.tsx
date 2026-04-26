"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Radio,
  ScanFace,
  Loader2,
  CheckCircle2,
  Clock,
  MapPin,
  Activity,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FaceCheck, type FaceCheckResult } from "@/components/face-check"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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

function hashString(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h
}

// Deterministic position on the radar disc for a given lecture id
function bubblePosition(id: string, index: number, total: number) {
  const h = hashString(id + ":" + index)
  // Spread bubbles evenly by index, then jitter a little using the hash
  const baseAngle = (index / Math.max(total, 1)) * Math.PI * 2
  const jitter = ((h % 1000) / 1000 - 0.5) * 0.6 // ±0.3 rad
  const angle = baseAngle + jitter
  const radius = 26 + (h % 14) // 26%–40% from center
  const x = 50 + Math.cos(angle) * radius
  const y = 50 + Math.sin(angle) * radius
  return { x, y, angle: (angle * 180) / Math.PI }
}

export function AttendanceRadar({ faceEnrolled }: { faceEnrolled: boolean }) {
  const [lectures, setLectures] = useState<LiveLecture[]>([])
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(null)
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<LiveLecture | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const courseIdsRef = useRef<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    if (courseIdsRef.current.length === 0) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id)
      courseIdsRef.current = enrollments?.map((e) => e.course_id) ?? []
    }
    const courseIds = courseIdsRef.current
    if (!enrolledDescriptor) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("face_descriptor")
        .eq("id", user.id)
        .single()
      setEnrolledDescriptor((profile?.face_descriptor as number[] | null) ?? null)
    }
    if (courseIds.length === 0) {
      setLectures([])
      setLastUpdated(new Date())
      return
    }
    const [{ data: live }, { data: existing }] = await Promise.all([
      supabase
        .from("lectures")
        .select("*, courses!inner(name, code, color)")
        .in("course_id", courseIds)
        .eq("status", "live"),
      supabase
        .from("attendance")
        .select("lecture_id, status")
        .eq("student_id", user.id)
        .in("status", ["present", "late"]),
    ])
    setLectures((live as LiveLecture[]) ?? [])
    if (existing) setMarkedIds(new Set(existing.map((e) => e.lecture_id)))
    setLastUpdated(new Date())
  }, [enrolledDescriptor])

  useEffect(() => {
    fetchLive()
    intervalRef.current = setInterval(fetchLive, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchLive])

  const unmarkedLectures = useMemo(
    () => lectures.filter((l) => !markedIds.has(l.id)),
    [lectures, markedIds],
  )
  const hasActionable = unmarkedLectures.length > 0
  const positions = useMemo(
    () => lectures.map((l, i) => ({ lecture: l, ...bubblePosition(l.id, i, lectures.length) })),
    [lectures],
  )

  async function handleVerify(res: FaceCheckResult) {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
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
      icon: <CheckCircle2 className="size-4" />,
    })
    setMarkedIds((s) => new Set([...s, selected.id]))
    setSelected(null)
    setSaving(false)
    fetchLive()
  }

  function openVerify() {
    if (!faceEnrolled) {
      toast.error("Enroll your face first to mark attendance.")
      return
    }
    if (unmarkedLectures.length === 0) return
    // Pick the first unmarked live lecture
    setSelected(unmarkedLectures[0])
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div
        className={cn(
          "relative px-5 py-6 md:px-8 md:py-8 transition-colors",
          hasActionable
            ? "bg-[radial-gradient(circle_at_50%_30%,oklch(0.7_0.18_265/0.18),transparent_70%)]"
            : "bg-[radial-gradient(circle_at_50%_30%,oklch(0.55_0.18_265/0.08),transparent_70%)]",
        )}
      >
        {/* HUD top bar */}
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-radar-pulse shadow-[0_0_10px_oklch(0.7_0.18_265)]" />
            <span>Beacon scan</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Activity className="size-3" />
            <span>
              {hasActionable ? `${unmarkedLectures.length} signal${unmarkedLectures.length === 1 ? "" : "s"}` : "Idle"}
            </span>
          </div>
        </div>

        {/* Radar */}
        <div className="relative mx-auto my-4 aspect-square w-full max-w-sm md:max-w-md">
          <Radar
            lectures={positions}
            markedIds={markedIds}
            onPick={(l) => {
              if (markedIds.has(l.id)) return
              if (!faceEnrolled) {
                toast.error("Enroll your face first to mark attendance.")
                return
              }
              setSelected(l)
            }}
          />
        </div>

        {/* Lecture chips below radar */}
        {lectures.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {lectures.map((l) => {
              const marked = markedIds.has(l.id)
              return (
                <Badge
                  key={l.id}
                  variant={marked ? "secondary" : "default"}
                  className={cn(
                    "gap-1.5 px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase",
                    !marked && "bg-primary/15 text-primary border border-primary/30",
                    marked && "bg-success/10 text-success border border-success/30",
                  )}
                >
                  {marked ? <CheckCircle2 className="size-3" /> : <Radio className="size-3" />}
                  {l.courses.code}
                  <span className="text-muted-foreground/70 normal-case font-normal hidden sm:inline">
                    {l.room ?? "TBA"} • {formatTime(l.scheduled_start)}
                  </span>
                </Badge>
              )
            })}
          </div>
        )}

        {/* Mark attendance CTA */}
        <div className="mt-6 flex flex-col items-center gap-2">
          {!faceEnrolled ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-warning">
                <AlertCircle className="size-4" />
                Enroll your face to start marking attendance
              </div>
              <Button asChild size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10">
                <Link href="/student/enroll-face">
                  <ScanFace className="size-4" />
                  Enroll now
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={openVerify}
              disabled={!hasActionable || saving}
              className={cn(
                "min-w-56 h-12 text-base font-semibold tracking-wide transition-all",
                hasActionable
                  ? "bg-primary text-primary-foreground shadow-[0_0_30px_oklch(0.7_0.18_265/0.5)] hover:shadow-[0_0_40px_oklch(0.7_0.18_265/0.7)] animate-radar-pulse"
                  : "bg-secondary text-muted-foreground hover:bg-secondary",
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : hasActionable ? (
                <>
                  <ScanFace className="size-4" />
                  Mark attendance
                </>
              ) : (
                <>
                  <Radio className="size-4" />
                  No live beacons
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground font-mono">
            {lastUpdated
              ? `Last sync ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Initializing…"}
          </p>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Verify your face</DialogTitle>
            <DialogDescription>
              {selected ? (
                <span className="inline-flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider mt-1">
                  <span className="text-foreground">{selected.courses.code}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {selected.room ?? "TBA"}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatTime(selected.scheduled_start)}
                  </span>
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {selected && enrolledDescriptor && (
            <FaceCheck
              mode="verify"
              expectedDescriptor={enrolledDescriptor}
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

function Radar({
  lectures,
  markedIds,
  onPick,
}: {
  lectures: { lecture: LiveLecture; x: number; y: number }[]
  markedIds: Set<string>
  onPick: (l: LiveLecture) => void
}) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full border border-primary/20 shadow-[inset_0_0_60px_oklch(0.7_0.18_265/0.1)]" />
      {/* Concentric rings */}
      <div className="absolute inset-[10%] rounded-full border border-primary/15" />
      <div className="absolute inset-[25%] rounded-full border border-primary/12" />
      <div className="absolute inset-[40%] rounded-full border border-primary/10 border-dashed" />

      {/* Cross hairs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-px bg-primary/10" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-full w-px bg-primary/10" />
      </div>

      {/* Tick marks at 12, 3, 6, 9 */}
      {[0, 90, 180, 270].map((deg) => (
        <div
          key={deg}
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `rotate(${deg}deg)` }}
        >
          <div className="absolute top-1 left-1/2 -translate-x-1/2 h-2 w-px bg-primary/40" />
        </div>
      ))}

      {/* Rotating sweep */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 animate-radar-rotate origin-center"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.7 0.18 265 / 0.55) 0deg, oklch(0.7 0.18 265 / 0.18) 30deg, transparent 70deg, transparent 360deg)",
            maskImage:
              "radial-gradient(circle at center, black 0%, black 100%)",
          }}
        />
      </div>

      {/* Inner soft glow */}
      <div className="absolute inset-[35%] rounded-full bg-primary/10 blur-xl" />

      {/* Bubbles */}
      {lectures.map(({ lecture, x, y }) => {
        const marked = markedIds.has(lecture.id)
        return (
          <button
            key={lecture.id}
            onClick={() => onPick(lecture)}
            disabled={marked}
            className="absolute group focus:outline-none"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
          >
            <span className="relative inline-flex items-center justify-center">
              <span
                className={cn(
                  "absolute inset-0 rounded-full opacity-70 animate-ping",
                  marked ? "bg-success/60" : "bg-primary/60",
                )}
              />
              <span
                className={cn(
                  "absolute -inset-3 rounded-full blur-md",
                  marked ? "bg-success/30" : "bg-primary/40",
                )}
              />
              <span
                className={cn(
                  "relative px-2.5 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase border whitespace-nowrap shadow-lg",
                  marked
                    ? "bg-success text-success-foreground border-success/60"
                    : "bg-primary text-primary-foreground border-primary/60",
                )}
              >
                {lecture.courses.code}
              </span>
            </span>

            {/* Tooltip card */}
            <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-10 w-44 rounded-lg border border-border bg-popover text-popover-foreground p-2 shadow-md opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none">
              <p className="text-xs font-semibold truncate">{lecture.courses.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {lecture.room ?? "TBA"} • {formatTime(lecture.scheduled_start)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {marked ? "Already marked" : "Tap to verify"}
              </p>
            </div>
          </button>
        )
      })}

      {/* Center node */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="relative">
          <div className="size-3 rounded-full bg-primary shadow-[0_0_18px_oklch(0.7_0.18_265)] animate-radar-pulse" />
          <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
        </div>
      </div>

      {/* Empty state hint */}
      {lectures.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground/80 text-center">
          Searching…
        </div>
      )}
    </div>
  )
}
