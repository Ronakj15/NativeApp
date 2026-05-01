"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Radio, Bluetooth, BluetoothSearching, Signal, StopCircle, Play,
  Users, MapPin, Loader2, Hash, Activity, Wifi,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

type Course = { id: string; name: string; code: string; year: number | null; division: string | null }
type LiveSession = {
  lectureId: string; courseId: string; courseName: string; courseCode: string
  beaconId: string; room: string; startedAt: Date; attendeeCount: number
}
type StudentBlip = { id: string; name: string; status: string; arrivedAt: number; angle: number; radius: number }

const MAX_BLIPS = 4

function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0 } return h }

export function FacultyBroadcast() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [room, setRoom] = useState("")
  const [topic, setTopic] = useState("")
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [elapsed, setElapsed] = useState("00:00")
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [recentStudents, setRecentStudents] = useState<StudentBlip[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  const fetchLive = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: c } = await supabase.from("courses").select("id, name, code, year, division").eq("faculty_id", user.id)
    setCourses(c ?? [])
    const { data: live } = await supabase
      .from("lectures")
      .select("id, course_id, beacon_id, room, started_at, courses!inner(name, code)")
      .eq("faculty_id", user.id).eq("status", "live").limit(1).maybeSingle()
    if (live) {
      const { count } = await supabase.from("attendance").select("id", { count: "exact", head: true })
        .eq("lecture_id", live.id).in("status", ["present", "late"])
      setLiveSession({
        lectureId: live.id, courseId: live.course_id,
        courseName: (live.courses as any)?.name ?? "", courseCode: (live.courses as any)?.code ?? "",
        beaconId: live.beacon_id ?? "", room: live.room ?? "TBA",
        startedAt: new Date(live.started_at!), attendeeCount: count ?? 0,
      })
      setAttendeeCount(count ?? 0)
    }
  }, [])

  useEffect(() => { fetchLive() }, [fetchLive])

  // Elapsed timer
  useEffect(() => {
    if (liveSession) {
      const tick = () => {
        const d = Math.floor((Date.now() - liveSession.startedAt.getTime()) / 1000)
        setElapsed(`${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`)
      }
      tick(); timerRef.current = setInterval(tick, 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    } else { setElapsed("00:00") }
  }, [liveSession])

  // Poll attendance + build FIFO blips
  useEffect(() => {
    if (!liveSession) { seenIdsRef.current.clear(); setRecentStudents([]); return }
    const poll = async () => {
      const supabase = createClient()
      const { data, count } = await supabase
        .from("attendance")
        .select("id, student_id, status, marked_at, profiles!inner(full_name)", { count: "exact" })
        .eq("lecture_id", liveSession.lectureId)
        .in("status", ["present", "late"])
        .order("marked_at", { ascending: false })
        .limit(10)
      setAttendeeCount(count ?? 0)
      if (data) {
        const now = performance.now()
        setRecentStudents(prev => {
          const newBlips = [...prev]
          for (const row of data) {
            if (seenIdsRef.current.has(row.student_id)) continue
            seenIdsRef.current.add(row.student_id)
            const h = hashStr(row.student_id)
            const angle = ((h % 360) / 360) * Math.PI * 2
            const radius = 0.35 + ((h >> 8) % 1000) / 1000 * 0.35
            newBlips.push({
              id: row.student_id,
              name: (row.profiles as any)?.full_name ?? "Student",
              status: row.status,
              arrivedAt: now,
              angle, radius,
            })
          }
          // FIFO: keep only last MAX_BLIPS
          return newBlips.slice(-MAX_BLIPS)
        })
      }
    }
    poll()
    pollRef.current = setInterval(poll, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [liveSession])

  function generateBeaconId() {
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let id = "VISO-"; for (let i = 0; i < 6; i++) id += c[Math.floor(Math.random() * c.length)]
    return id
  }

  async function handleStart() {
    if (!selectedCourseId) { toast({ title: "Please select a course", variant: "destructive" }); return }
    setStarting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStarting(false); return }
    const beaconId = generateBeaconId()
    const now = new Date()
    const { data, error } = await supabase.from("lectures").insert({
      course_id: selectedCourseId, faculty_id: user.id,
      scheduled_start: now.toISOString(), scheduled_end: new Date(now.getTime() + 3600000).toISOString(),
      started_at: now.toISOString(), room: room || "TBA", topic: topic || null,
      beacon_id: beaconId, status: "live",
    }).select("id, course_id, beacon_id, room, started_at, courses!inner(name, code)").single()
    if (error) { toast({ title: "Failed to start session", description: error.message, variant: "destructive" }); setStarting(false); return }
    setLiveSession({
      lectureId: data.id, courseId: data.course_id,
      courseName: (data.courses as any)?.name ?? "", courseCode: (data.courses as any)?.code ?? "",
      beaconId: data.beacon_id!, room: data.room ?? "TBA",
      startedAt: new Date(data.started_at!), attendeeCount: 0,
    })
    setAttendeeCount(0); seenIdsRef.current.clear(); setRecentStudents([])
    setShowStartDialog(false); setStarting(false)
    setSelectedCourseId(""); setRoom(""); setTopic("")
    toast({ title: "Session started!", description: `Broadcasting as ${beaconId}` })
  }

  async function handleStop() {
    if (!liveSession) return
    setStopping(true)
    const supabase = createClient()
    const { error } = await supabase.from("lectures")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", liveSession.lectureId)
    if (error) { toast({ title: "Failed to end session", description: error.message, variant: "destructive" }); setStopping(false); return }
    toast({ title: "Session ended", description: `${attendeeCount} student${attendeeCount !== 1 ? "s" : ""} marked present` })
    setLiveSession(null); setStopping(false)
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div className="glass brutal-lg rounded-3xl overflow-hidden text-foreground">
      <div className="relative px-5 py-6 md:px-8 md:py-7">
        {/* HUD header */}
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest mb-4">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", liveSession ? "bg-success animate-pulse" : "bg-muted-foreground/40")} />
            <span className="font-bold">Beacon Broadcast</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="size-3" />
            <span>{liveSession ? "Broadcasting" : "Idle"}</span>
          </div>
        </div>

        {liveSession ? (
          <>
            {/* Radar with student blips */}
            <div className="relative mx-auto aspect-square w-full max-w-[280px] mb-5">
              <FacultyRadarCanvas blips={recentStudents} />
              {/* Student blip labels */}
              <div className="absolute inset-0 pointer-events-none">
                {recentStudents.map((b) => {
                  const cx = 50 + Math.cos(b.angle) * b.radius * 50
                  const cy = 50 + Math.sin(b.angle) * b.radius * 50
                  return (
                    <div key={b.id} className="absolute animate-blip-pop" style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%,-50%)" }}>
                      <span className={cn(
                        "absolute left-1/2 -translate-x-1/2 -bottom-6 px-2 py-0.5 rounded-md font-mono text-[9px] tracking-wider uppercase border whitespace-nowrap",
                        b.status === "late" ? "bg-warning text-warning-foreground border-warning" : "bg-success text-success-foreground border-success",
                      )}>
                        {b.name.split(" ")[0]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Timer + count below radar, right-aligned */}
            <div className="flex items-center justify-end gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg brutal-sm bg-primary/10">
                <Radio className="size-4 text-primary animate-pulse" />
                <span className="font-mono text-lg font-black tabular-nums tracking-tight text-primary">{elapsed}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg brutal-sm bg-success/10">
                <Users className="size-3.5 text-success" />
                <span className="font-mono text-sm font-bold text-success">{attendeeCount} joined</span>
              </div>
            </div>

            {/* Session info */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <InfoTile icon={Bluetooth} label="Beacon ID" value={liveSession.beaconId} accent />
              <InfoTile icon={MapPin} label="Room" value={liveSession.room} />
            </div>

            {/* Course banner */}
            <div className="brutal-sm rounded-xl bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 mb-4">
              <div className="size-9 rounded-lg bg-foreground text-background grid place-items-center border-2 border-foreground font-bold text-sm shrink-0">
                {liveSession.courseCode.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{liveSession.courseName}</p>
                <p className="text-xs opacity-80 font-mono">{liveSession.courseCode}</p>
              </div>
              <Badge className="bg-foreground text-background border-2 border-foreground font-bold shrink-0">LIVE</Badge>
            </div>

            {/* Recent students FIFO list */}
            {recentStudents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {recentStudents.map((s) => (
                  <Badge key={s.id} className={cn(
                    "gap-1 border-2 border-foreground font-bold text-xs",
                    s.status === "late" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground",
                  )}>
                    <span className="size-1.5 rounded-full bg-current animate-pulse" />
                    {s.name.split(" ")[0]}
                  </Badge>
                ))}
              </div>
            )}

            <Button onClick={handleStop} disabled={stopping} size="lg"
              className="w-full brutal brutal-lift h-12 text-base font-bold tracking-wide rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive">
              {stopping ? <><Loader2 className="size-5 animate-spin" />Ending...</> : <><StopCircle className="size-5" />End Session</>}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="size-20 rounded-2xl bg-muted/60 border-2 border-foreground/10 grid place-items-center">
                <BluetoothSearching className="size-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg tracking-tight">No active session</p>
                <p className="text-sm text-muted-foreground">Start broadcasting to enable student attendance</p>
              </div>
            </div>
            <Button onClick={() => setShowStartDialog(true)} disabled={courses.length === 0} size="lg"
              className="w-full brutal brutal-lift h-12 text-base font-bold tracking-wide rounded-xl bg-primary text-primary-foreground hover:bg-primary">
              <Play className="size-5" />Start Attendance
            </Button>
            {courses.length === 0 && <p className="text-xs text-muted-foreground text-center mt-2">Create a course first to start a session.</p>}
          </>
        )}
      </div>

      {/* Start dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="bg-background border-2 border-foreground rounded-2xl max-w-md shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-9 rounded-lg bg-primary text-primary-foreground border-2 border-foreground grid place-items-center"><Radio className="size-4" /></div>
              Start Attendance Session
            </DialogTitle>
            <DialogDescription>Choose a course and start broadcasting. Students in range will be able to mark attendance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-widest">Course *</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="brutal-sm rounded-lg h-11"><SelectValue placeholder="Select a course..." /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs font-mono">{c.code}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest">Room</Label>
                <Input placeholder="e.g. Room 301" value={room} onChange={(e) => setRoom(e.target.value)} className="brutal-sm rounded-lg h-11" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest">Topic</Label>
                <Input placeholder="e.g. Deadlocks" value={topic} onChange={(e) => setTopic(e.target.value)} className="brutal-sm rounded-lg h-11" />
              </div>
            </div>
            <div className="brutal-sm rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2"><Hash className="size-3" /><span>A unique Beacon ID will be auto-generated</span></div>
              <div className="flex items-center gap-2"><Wifi className="size-3" /><span>Students must be in Bluetooth range to verify</span></div>
            </div>
            <Button onClick={handleStart} disabled={starting || !selectedCourseId} size="lg"
              className="w-full brutal brutal-lift h-12 text-base font-bold tracking-wide rounded-xl bg-success text-success-foreground hover:bg-success">
              {starting ? <><Loader2 className="size-5 animate-spin" />Starting...</> : <><Radio className="size-5" />Go Live</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Radar Canvas (reuses student radar pattern) ── */

function FacultyRadarCanvas({ blips }: { blips: StudentBlip[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const sweepRef = useRef(0)
  const blipsRef = useRef<StudentBlip[]>(blips)

  useEffect(() => { blipsRef.current = blips }, [blips])

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const isDark = document.documentElement.classList.contains("dark")
    const theme = {
      primary: "rgba(180,255,60,1)", success: "rgba(50,220,100,1)",
      warning: "rgba(255,190,50,1)",
      fg: isDark ? "rgba(255,255,255,1)" : "rgba(20,20,20,1)",
    }

    function resize() {
      if (!canvas || !container || !ctx) return
      const r = container.getBoundingClientRect()
      canvas.width = r.width * dpr; canvas.height = r.height * dpr
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(container)
    let last = performance.now()

    const draw = (now: number) => {
      const dt = now - last; last = now
      sweepRef.current = (sweepRef.current + (Math.PI * 2 * dt) / 4200) % (Math.PI * 2)
      const w = canvas.width / dpr, h = canvas.height / dpr
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 4
      ctx.clearRect(0, 0, w, h)

      // Disc bg
      const dg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      dg.addColorStop(0, a(theme.primary, 0.12)); dg.addColorStop(0.65, a(theme.primary, 0.05)); dg.addColorStop(1, a(theme.primary, 0.02))
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = dg; ctx.fill()

      // Rings
      ctx.lineWidth = 1
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2)
        ctx.strokeStyle = a(theme.fg, i === 4 ? 0.35 : 0.12)
        ctx.setLineDash(i === 3 ? [4, 6] : []); ctx.stroke()
      }
      ctx.setLineDash([])

      // Cross
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.strokeStyle = a(theme.fg, 0.1); ctx.stroke()

      // Ticks
      ctx.strokeStyle = a(theme.fg, 0.35); ctx.lineWidth = 1
      for (let d = 0; d < 360; d += 30) {
        const r2 = (d * Math.PI) / 180
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(r2) * (R - 6), cy + Math.sin(r2) * (R - 6))
        ctx.lineTo(cx + Math.cos(r2) * R, cy + Math.sin(r2) * R); ctx.stroke()
      }

      // Sweep
      const sa = sweepRef.current, cone = Math.PI / 2
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(sa)
      for (let i = 0; i < 28; i++) {
        const a0 = (cone * i) / 28, a1 = (cone * (i + 1)) / 28
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath()
        ctx.fillStyle = a(theme.primary, 0.55 * Math.pow(1 - i / 28, 1.4)); ctx.fill()
      }
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0)
      ctx.strokeStyle = a(theme.primary, 0.95); ctx.lineWidth = 2
      ctx.shadowColor = a(theme.primary, 0.9); ctx.shadowBlur = 16; ctx.stroke()
      ctx.shadowBlur = 0; ctx.restore()

      // Student blips
      for (const b of blipsRef.current) {
        const bx = cx + Math.cos(b.angle) * b.radius * R
        const by = cy + Math.sin(b.angle) * b.radius * R
        let delta = (sa - b.angle) % (Math.PI * 2); if (delta < 0) delta += Math.PI * 2
        let intensity = delta <= cone ? 1 - delta / cone : 0.18
        const age = now - b.arrivedAt
        intensity *= 0.25 + 0.75 * Math.min(1, age / 300)
        const color = b.status === "late" ? theme.warning : theme.success
        const r2 = 6 * (0.9 + intensity * 0.6)

        ctx.beginPath(); ctx.arc(bx, by, r2 * 3.4, 0, Math.PI * 2)
        ctx.fillStyle = a(color, 0.25 * intensity); ctx.fill()
        ctx.beginPath(); ctx.arc(bx, by, r2 * 1.8, 0, Math.PI * 2)
        ctx.fillStyle = a(color, 0.45 * intensity + 0.05); ctx.fill()
        ctx.beginPath(); ctx.arc(bx, by, r2, 0, Math.PI * 2)
        ctx.fillStyle = a(color, 0.85 + 0.15 * intensity)
        ctx.shadowColor = a(color, 0.9 * intensity); ctx.shadowBlur = 18 * intensity
        ctx.fill(); ctx.shadowBlur = 0
      }

      // Center
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = a(theme.primary, 1); ctx.shadowColor = a(theme.primary, 0.9)
      ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2)
      ctx.strokeStyle = a(theme.primary, 0.5); ctx.lineWidth = 1; ctx.stroke()

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {blipsRef.current.length === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-foreground text-background text-[10px] font-mono uppercase tracking-widest border-2 border-foreground">
            Waiting for students
          </span>
        </div>
      )}
    </div>
  )
}

function a(color: string, alpha: number): string {
  const v = Math.max(0, Math.min(1, alpha))
  if (color.startsWith("rgba(")) return color.replace(/,\s*[\d.]+\)$/, `, ${v})`)
  return color
}

function InfoTile({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean
}) {
  return (
    <div className={cn("brutal-sm rounded-lg px-3 py-2.5 flex items-center gap-2.5", accent ? "bg-primary/10" : "bg-card")}>
      <Icon className={cn("size-4 shrink-0", accent ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-bold truncate tabular-nums", accent && "text-primary")}>{value}</p>
      </div>
    </div>
  )
}
