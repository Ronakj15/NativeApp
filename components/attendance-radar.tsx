"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Radio,
  Bluetooth,
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

// Deterministic polar coords for a given lecture id; angle in radians, radius normalized 0..1
function polarFor(id: string, index: number, total: number) {
  const h = hashString(id + ":" + index)
  const baseAngle = (index / Math.max(total, 1)) * Math.PI * 2
  const jitter = ((h % 1000) / 1000 - 0.5) * 0.6
  const angle = baseAngle + jitter
  const radius = 0.45 + ((h >> 8) % 1000) / 1000 * 0.25 // 0.45–0.70
  return { angle, radius }
}

type Blip = {
  lecture: LiveLecture
  angle: number
  radius: number
  marked: boolean
  appearedAt: number
}

export function AttendanceRadar({ faceEnrolled }: { faceEnrolled: boolean }) {
  const [lectures, setLectures] = useState<LiveLecture[]>([])
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(null)
  const [scanningBle, setScanningBle] = useState(false)
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<LiveLecture | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const profileDataRef = useRef<{ year: number | null; department: string | null; division: string | null } | null>(null)
  const courseIdsRef = useRef<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // 1. Fetch profile for face descriptor AND matching criteria (year, department, division)
    if (!enrolledDescriptor || !profileDataRef.current) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("face_descriptor, year, department, division")
        .eq("id", user.id)
        .single()
      
      setEnrolledDescriptor((profile?.face_descriptor as number[] | null) ?? null)
      if (profile) {
        profileDataRef.current = { year: profile.year, department: profile.department, division: profile.division }
      }
    }

    const p = profileDataRef.current
    // If student hasn't completed profile, no courses will match
    if (!p || !p.year || !p.department || !p.division) {
      setLectures([])
      setLastUpdated(new Date())
      return
    }

    // 2. Fetch all courses matching the student's year, department, and division
    if (courseIdsRef.current.length === 0) {
      const { data: matchingCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("year", p.year)
        .eq("department", p.department)
        .eq("division", p.division)
      
      courseIdsRef.current = matchingCourses?.map((c) => c.id) ?? []
    }

    const courseIds = courseIdsRef.current
    if (courseIds.length === 0) {
      setLectures([])
      setLastUpdated(new Date())
      return
    }

    // 3. Fetch live lectures for those courses and existing attendance
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

  // Build blips with stable appearedAt for entrance animation
  const appearedAtRef = useRef<Map<string, number>>(new Map())
  const blips: Blip[] = useMemo(() => {
    const now = performance.now()
    return lectures.map((l, i) => {
      if (!appearedAtRef.current.has(l.id)) appearedAtRef.current.set(l.id, now)
      const { angle, radius } = polarFor(l.id, i, lectures.length)
      return {
        lecture: l,
        angle,
        radius,
        marked: markedIds.has(l.id),
        appearedAt: appearedAtRef.current.get(l.id) ?? now,
      }
    })
  }, [lectures, markedIds])

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
    setSelected(unmarkedLectures[0])
  }

  async function scanForBeacon(lectureId: string) {
    if (!(navigator as any).bluetooth) {
      toast.error("Web Bluetooth is not supported in your browser.")
      return
    }
    setScanningBle(true)
    try {
      const targetLecture = lectures.find((l) => l.id === lectureId)
      if (!targetLecture || !targetLecture.beacon_id) {
        toast.error("No valid beacon ID found for this lecture.")
        return
      }

      // Use acceptAllDevices for broader compatibility on Windows.
      // We validate the device name after the user selects it.
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access'],
      })

      const deviceName = device.name || device.id || ""
      if (deviceName.toLowerCase().includes(targetLecture.beacon_id.toLowerCase())) {
        toast.success(`Beacon verified: ${deviceName}`)
        setSelected(lectures.find((l) => l.id === lectureId) || null)
      } else {
        toast.error("Beacon mismatch", {
          description: `Expected: ${targetLecture.beacon_id}, Found: ${deviceName}`,
        })
      }
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        // NotFoundError = user cancelled the dialog, not a real error
        toast.error("Bluetooth scan failed", { description: err.message })
      }
    } finally {
      setScanningBle(false)
    }
  }

  return (
    <div className="relative glass brutal-lg rounded-3xl overflow-hidden text-foreground">
      <div className="relative px-5 py-7 md:px-8 md:py-8">
        {/* HUD top bar */}
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-radar-pulse" />
            <span className="text-foreground font-bold">Beacon Scan</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
            <Activity className="size-3" />
            <span>
              {hasActionable ? `${unmarkedLectures.length} signal${unmarkedLectures.length === 1 ? "" : "s"}` : "Idle"}
            </span>
          </div>
        </div>

        {/* Radar canvas + clickable blips */}
        <div className="relative mx-auto my-4 aspect-square w-full max-w-md">
          <RadarCanvas blips={blips} hoveredId={hovered} />

          {/* Click hit areas / tooltips on top of canvas */}
          <div className="absolute inset-0">
            {blips.map((b) => {
              const cx = 50 + Math.cos(b.angle) * b.radius * 50
              const cy = 50 + Math.sin(b.angle) * b.radius * 50
              return (
                <button
                  key={b.lecture.id}
                  onClick={async () => {
                    if (b.marked) return
                    if (!faceEnrolled) {
                      toast.error("Enroll your face first to mark attendance.")
                      return
                    }
                    await scanForBeacon(b.lecture.id)
                  }}
                  onMouseEnter={() => setHovered(b.lecture.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="absolute group focus:outline-none animate-blip-pop"
                  style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%,-50%)" }}
                  aria-label={`Lecture ${b.lecture.courses.code}`}
                >
                  <span className="block size-7 rounded-full bg-transparent" />
                  <span
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 -bottom-7 px-2 py-0.5 rounded-md font-mono text-[10px] tracking-widest uppercase border whitespace-nowrap",
                      b.marked
                        ? "bg-success text-success-foreground border-success"
                        : "bg-foreground text-background border-foreground",
                    )}
                  >
                    {b.lecture.courses.code}
                  </span>
                  <div className="absolute left-1/2 top-7 -translate-x-1/2 z-10 w-48 rounded-md p-2 glass brutal-sm opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none mt-3">
                    <p className="text-xs font-semibold truncate">{b.lecture.courses.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {b.lecture.room ?? "TBA"} • {formatTime(b.lecture.scheduled_start)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.marked ? "Already marked" : "Tap radar button to verify"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Lecture chips below radar */}
        {lectures.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {lectures.map((l) => {
              const marked = markedIds.has(l.id)
              return (
                <Badge
                  key={l.id}
                  variant="outline"
                  className={cn(
                    "gap-1.5 px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase border-2",
                    marked
                      ? "bg-success text-success-foreground border-success"
                      : "bg-foreground text-background border-foreground",
                  )}
                >
                  {marked ? <CheckCircle2 className="size-3" /> : <Radio className="size-3" />}
                  {l.courses.code}
                  <span className="opacity-80 normal-case font-normal hidden sm:inline">
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
              <Button asChild size="sm" className="brutal-sm brutal-lift bg-warning text-warning-foreground hover:bg-warning">
                <Link href="/student/enroll-face">
                  <ScanFace className="size-4" />
                  Enroll now
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={async () => {
                const unmarkedLectures = lectures.filter((l) => !markedIds.has(l.id))
                if (unmarkedLectures.length === 0) return
                await scanForBeacon(unmarkedLectures[0].id)
              }}
              disabled={!hasActionable || saving || scanningBle}
              className={cn(
                "brutal brutal-lift min-w-60 h-12 text-base font-bold tracking-wide rounded-xl",
                hasActionable
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "opacity-50",
              )}
            >
              {scanningBle ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Scanning BLE...
                </>
              ) : hasActionable ? (
                <>
                  <Bluetooth className="size-5 animate-pulse" />
                  Scan & Verify Face
                </>
              ) : (
                <>
                  <Radio className="size-5" />
                  No signals found
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
        <DialogContent className="max-w-xl glass brutal rounded-2xl">
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

/* ====================== Real radar canvas ====================== */

function RadarCanvas({ blips, hoveredId }: { blips: Blip[]; hoveredId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const sweepRef = useRef(0) // current sweep angle in radians
  const blipsRef = useRef<Blip[]>(blips)
  const hoveredRef = useRef<string | null>(hoveredId)
  const themeRef = useRef<{ primary: string; success: string; fg: string; bg: string }>({
    primary: "rgba(110, 80, 240, 1)",
    success: "rgba(60, 200, 130, 1)",
    fg: "rgba(20, 20, 30, 1)",
    bg: "rgba(255, 255, 255, 1)",
  })

  useEffect(() => {
    blipsRef.current = blips
  }, [blips])

  useEffect(() => {
    hoveredRef.current = hoveredId
  }, [hoveredId])

  // Use fallback hardcoded RGBA colors instead of complex CSS oklch variables
  // to ensure Canvas API never crashes from unparseable color strings.
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    themeRef.current = {
      primary: "rgba(180, 255, 60, 1)", // Electric Lime
      success: "rgba(50, 220, 100, 1)", // Green
      fg: isDark ? "rgba(255, 255, 255, 1)" : "rgba(20, 20, 20, 1)",
      bg: isDark ? "rgba(20, 20, 20, 1)" : "rgba(255, 255, 255, 1)",
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.max(1, window.devicePixelRatio || 1)

    function resize() {
      if (!canvas || !container || !ctx) return
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let lastTime = performance.now()
    const SWEEP_PERIOD = 4200 // ms per full revolution

    const draw = (now: number) => {
      const dt = now - lastTime
      lastTime = now
      sweepRef.current = (sweepRef.current + (Math.PI * 2 * dt) / SWEEP_PERIOD) % (Math.PI * 2)

      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2 - 4
      const theme = themeRef.current

      ctx.clearRect(0, 0, w, h)

      // Disc background (radial gradient)
      const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      discGrad.addColorStop(0, withAlpha(theme.primary, 0.12))
      discGrad.addColorStop(0.65, withAlpha(theme.primary, 0.05))
      discGrad.addColorStop(1, withAlpha(theme.primary, 0.02))
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = discGrad
      ctx.fill()

      // Concentric rings
      ctx.lineWidth = 1
      for (let i = 1; i <= 4; i++) {
        const r = (R * i) / 4
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = withAlpha(theme.fg, i === 4 ? 0.35 : 0.12)
        ctx.setLineDash(i === 3 ? [4, 6] : [])
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Crosshairs
      ctx.beginPath()
      ctx.moveTo(cx - R, cy)
      ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R)
      ctx.lineTo(cx, cy + R)
      ctx.strokeStyle = withAlpha(theme.fg, 0.1)
      ctx.stroke()

      // Bearing ticks every 30 deg
      ctx.strokeStyle = withAlpha(theme.fg, 0.35)
      ctx.lineWidth = 1
      for (let a = 0; a < 360; a += 30) {
        const rad = (a * Math.PI) / 180
        const x1 = cx + Math.cos(rad) * (R - 6)
        const y1 = cy + Math.sin(rad) * (R - 6)
        const x2 = cx + Math.cos(rad) * R
        const y2 = cy + Math.sin(rad) * R
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      // Sweep cone (stepped wedges fade behind the leading edge)
      const sweepAngle = sweepRef.current
      const coneAngle = Math.PI / 2 // 90 deg trail
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(sweepAngle)
      const steps = 28
      for (let i = 0; i < steps; i++) {
        const a0 = (coneAngle * i) / steps
        const a1 = (coneAngle * (i + 1)) / steps
        const alpha = 0.55 * Math.pow(1 - i / steps, 1.4)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, R, a0, a1)
        ctx.closePath()
        ctx.fillStyle = withAlpha(theme.primary, alpha)
        ctx.fill()
      }
      // Bright leading edge line
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(R, 0)
      ctx.strokeStyle = withAlpha(theme.primary, 0.95)
      ctx.lineWidth = 2
      ctx.shadowColor = withAlpha(theme.primary, 0.9)
      ctx.shadowBlur = 16
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()

      // Blips
      const cone = coneAngle
      for (const b of blipsRef.current) {
        const bx = cx + Math.cos(b.angle) * b.radius * R
        const by = cy + Math.sin(b.angle) * b.radius * R

        // angular distance behind the sweep leading edge in [0, 2π)
        let delta = (sweepAngle - b.angle) % (Math.PI * 2)
        if (delta < 0) delta += Math.PI * 2

        // brightness curve: bright when freshly painted, fades over the cone trail
        let intensity: number
        if (delta <= cone) {
          intensity = 1 - delta / cone
        } else {
          // base low brightness so bubbles never disappear entirely
          intensity = 0.18
        }

        // entrance animation
        const age = now - b.appearedAt
        const enter = Math.min(1, age / 280)
        intensity *= 0.25 + 0.75 * enter

        // Hover boost
        if (hoveredRef.current === b.lecture.id) intensity = Math.max(intensity, 0.85)

        const color = b.marked ? theme.success : theme.primary
        const baseR = 6
        const r = baseR * (0.9 + intensity * 0.6)

        // soft glow
        ctx.beginPath()
        ctx.arc(bx, by, r * 3.4, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(color, 0.25 * intensity)
        ctx.fill()

        // mid halo
        ctx.beginPath()
        ctx.arc(bx, by, r * 1.8, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(color, 0.45 * intensity + 0.05)
        ctx.fill()

        // core dot
        ctx.beginPath()
        ctx.arc(bx, by, r, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(color, 0.85 + 0.15 * intensity)
        ctx.shadowColor = withAlpha(color, 0.9 * intensity)
        ctx.shadowBlur = 18 * intensity
        ctx.fill()
        ctx.shadowBlur = 0

        // ring around hovered
        if (hoveredRef.current === b.lecture.id) {
          ctx.beginPath()
          ctx.arc(bx, by, r * 2.4, 0, Math.PI * 2)
          ctx.strokeStyle = withAlpha(theme.fg, 0.6)
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      // Center node
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha(theme.primary, 1)
      ctx.shadowColor = withAlpha(theme.primary, 0.9)
      ctx.shadowBlur = 14
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.beginPath()
      ctx.arc(cx, cy, 9, 0, Math.PI * 2)
      ctx.strokeStyle = withAlpha(theme.primary, 0.5)
      ctx.lineWidth = 1
      ctx.stroke()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {blips.length === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-foreground text-background text-[10px] font-mono uppercase tracking-widest border-2 border-foreground">
            No signals · Scanning
          </span>
        </div>
      )}
    </div>
  )
}

function withAlpha(color: string, alpha: number): string {
  // Handles "oklch(L C H)" or "rgba(...)"
  const a = Math.max(0, Math.min(1, alpha))
  if (color.startsWith("rgba(")) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${a})`)
  }
  if (color.startsWith("rgb(")) {
    return color.replace(/^rgb\((.*)\)$/, (_m, body) => `rgba(${body}, ${a})`)
  }
  // For oklch, lab, color, etc that support the slash syntax:
  if (color.match(/^[a-z-]+\(/)) {
    return color.replace(/\)$/, ` / ${a})`)
  }
  return color
}
