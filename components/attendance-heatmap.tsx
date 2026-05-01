"use client"

import { useMemo, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  CalendarDays,
  MapPin,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Cell = { date: string; present: number; total: number; intensity: number }

type DayRecord = {
  id: string
  status: string
  method: string | null
  marked_at: string | null
  confidence: number | null
  courseName: string
  courseCode: string
  room: string | null
  scheduledStart: string
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function AttendanceHeatmap({
  cells,
  dayRecords,
}: {
  cells: Cell[]
  dayRecords?: Record<string, DayRecord[]>
}) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const cellMap = useMemo(() => {
    const map = new Map<string, Cell>()
    for (const c of cells) map.set(c.date, c)
    return map
  }, [cells])

  const calendarWeeks = useMemo(() => {
    const first = new Date(year, month, 1)
    const total = new Date(year, month + 1, 0).getDate()
    const startDow = (first.getDay() + 6) % 7
    const weeks: (number | null)[][] = []
    let week: (number | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= total; d++) {
      week.push(d)
      if (week.length === 7) { weeks.push(week); week = [] }
    }
    if (week.length) { while (week.length < 7) week.push(null); weeks.push(week) }
    return weeks
  }, [month, year])

  const stats = useMemo(() => {
    let total = 0, present = 0, late = 0, absent = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      for (const r of dayRecords?.[k] ?? []) {
        total++
        if (r.status === "present") present++
        else if (r.status === "late") late++
        else if (r.status === "absent") absent++
      }
    }
    return { total, present, late, absent, pct: total ? Math.round(((present + late) / total) * 100) : 0 }
  }, [month, year, dayRecords])

  const dk = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const isFuture = (d: number) => new Date(year, month, d) > today

  // Neo-brutalist day styling based on intensity
  function dayStyle(day: number): { bg: string; border: string; shadow: string; text: string } {
    const cell = cellMap.get(dk(day))
    if (!cell || cell.intensity < 0) return { bg: "", border: "", shadow: "", text: "" }
    if (cell.intensity >= 0.9) return {
      bg: "bg-success/25",
      border: "border-success",
      shadow: "shadow-[2px_2px_0_0_var(--success)]",
      text: "text-success",
    }
    if (cell.intensity >= 0.75) return {
      bg: "bg-success/15",
      border: "border-success/60",
      shadow: "",
      text: "text-success",
    }
    if (cell.intensity >= 0.5) return {
      bg: "bg-warning/20",
      border: "border-warning/60",
      shadow: "",
      text: "text-warning",
    }
    if (cell.intensity > 0) return {
      bg: "bg-destructive/15",
      border: "border-destructive/60",
      shadow: "",
      text: "text-destructive",
    }
    return {
      bg: "bg-destructive/20",
      border: "border-destructive",
      shadow: "shadow-[2px_2px_0_0_var(--destructive)]",
      text: "text-destructive",
    }
  }

  function prev() { if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1) }
  function next() { if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1) }

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i)
  const recs = selectedDate && dayRecords ? dayRecords[selectedDate] ?? [] : []

  return (
    <>
      {/* ── Header: Nav + Selectors ────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={prev}
          className="brutal-sm brutal-lift size-9 rounded-lg bg-card"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-[120px] brutal-sm rounded-lg bg-primary text-primary-foreground font-bold text-sm border-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-[80px] brutal-sm rounded-lg bg-card font-bold text-sm border-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={next}
          className="brutal-sm brutal-lift size-9 rounded-lg bg-card"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* ── Stats ribbon ────────────────────────────────── */}
      {stats.total > 0 && (
        <div className="brutal-sm rounded-xl bg-card px-4 py-2.5 flex items-center gap-3 mb-4 text-xs">
          <div className={cn(
            "size-9 rounded-lg border-2 border-foreground grid place-items-center font-black text-sm",
            stats.pct >= 75 ? "bg-success text-success-foreground" : stats.pct >= 50 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground",
          )}>
            {stats.pct}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{stats.present + stats.late} / {stats.total} attended</p>
            <p className="text-muted-foreground text-[11px]">{MONTHS[month]} {year}</p>
          </div>
          <div className="flex gap-3 font-mono text-[11px]">
            {stats.present > 0 && <span className="text-success font-bold">{stats.present}P</span>}
            {stats.late > 0 && <span className="text-warning font-bold">{stats.late}L</span>}
            {stats.absent > 0 && <span className="text-destructive font-bold">{stats.absent}A</span>}
          </div>
        </div>
      )}

      {/* ── Calendar Grid ───────────────────────────────── */}
      <div className="max-w-md mx-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        <div className="grid gap-1.5">
          {calendarWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {week.map((day, di) => {
                if (day === null) return <div key={di} />

                const cell = cellMap.get(dk(day))
                const hasData = cell && cell.total > 0
                const future = isFuture(day)
                const todayMark = isToday(day)
                const style = hasData ? dayStyle(day) : null

                return (
                  <button
                    key={di}
                    onClick={() => hasData && setSelectedDate(dk(day))}
                    disabled={!hasData}
                    className={cn(
                      "relative h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all border",
                      // Base
                      !hasData && !future && "bg-muted/40 border-transparent",
                      future && "bg-transparent border-dashed border-foreground/10",
                      // Has data: brutalist colored cell
                      hasData && style?.bg,
                      hasData && "border-2 cursor-pointer",
                      hasData && style?.border,
                      hasData && style?.shadow,
                      hasData && "hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--foreground)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
                      // Today ring
                      todayMark && "ring-2 ring-offset-2 ring-primary",
                    )}
                  >
                    <span className={cn(
                      "text-xs tabular-nums leading-none",
                      future ? "text-muted-foreground/25"
                        : todayMark ? "font-black text-primary"
                        : hasData ? "font-bold" : "text-muted-foreground/50",
                    )}>
                      {day}
                    </span>

                    {hasData && (
                      <span className={cn("text-[9px] font-mono font-bold tabular-nums leading-none", style?.text)}>
                        {cell!.present}/{cell!.total}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-success bg-success/25 shadow-[1px_1px_0_0_var(--success)]" />100%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-success/60 bg-success/15" />≥75%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-warning/60 bg-warning/20" />≥50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-destructive bg-destructive/20 shadow-[1px_1px_0_0_var(--destructive)]" />&lt;50%
        </span>
        <span className="flex items-center gap-1.5 ml-1">
          <span className="size-3 rounded ring-2 ring-primary ring-offset-1" />Today
        </span>
      </div>

      {/* ── Day Detail Sheet ────────────────────────────── */}
      <Sheet open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <div className="size-9 rounded-lg bg-primary text-primary-foreground border-2 border-foreground grid place-items-center">
                <CalendarDays className="size-4" />
              </div>
              Day Details
            </SheetTitle>
            {selectedDate && (
              <SheetDescription>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {recs.filter(r => r.status === "present").length > 0 && (
              <Badge className="bg-success text-success-foreground border-2 border-foreground gap-1 font-bold">
                <CheckCircle2 className="size-3" />
                {recs.filter(r => r.status === "present").length} Present
              </Badge>
            )}
            {recs.filter(r => r.status === "late").length > 0 && (
              <Badge className="bg-warning text-warning-foreground border-2 border-foreground gap-1 font-bold">
                <Clock className="size-3" />
                {recs.filter(r => r.status === "late").length} Late
              </Badge>
            )}
            {recs.filter(r => r.status === "absent").length > 0 && (
              <Badge className="bg-destructive text-destructive-foreground border-2 border-foreground gap-1 font-bold">
                <XCircle className="size-3" />
                {recs.filter(r => r.status === "absent").length} Absent
              </Badge>
            )}
            {recs.filter(r => r.status === "excused").length > 0 && (
              <Badge className="bg-secondary text-secondary-foreground border-2 border-foreground gap-1 font-bold">
                <MinusCircle className="size-3" />
                {recs.filter(r => r.status === "excused").length} Excused
              </Badge>
            )}
          </div>

          {/* Lecture cards */}
          <div className="flex flex-col gap-3">
            {recs.map((rec) => (
              <div
                key={rec.id}
                className={cn(
                  "brutal-sm rounded-xl p-4",
                  rec.status === "present" ? "bg-success/10 border-success"
                    : rec.status === "late" ? "bg-warning/10 border-warning"
                    : rec.status === "excused" ? "bg-secondary border-foreground"
                    : "bg-destructive/10 border-destructive",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                      <p className="font-bold truncate">{rec.courseName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono ml-6">{rec.courseCode}</p>
                  </div>
                  <StatusPill status={rec.status} />
                </div>
                <div className="mt-3 ml-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(rec.scheduledStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {rec.room && (
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{rec.room}</span>
                  )}
                  {rec.method && <span className="capitalize">{rec.method.replace("_", " ")}</span>}
                  {rec.confidence != null && <span className="tabular-nums">{Math.round(rec.confidence * 100)}%</span>}
                </div>
              </div>
            ))}
            {recs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No records for this day.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    present: { bg: "bg-success text-success-foreground border-2 border-foreground", icon: <CheckCircle2 className="size-3" />, label: "Present" },
    late: { bg: "bg-warning text-warning-foreground border-2 border-foreground", icon: <Clock className="size-3" />, label: "Late" },
    excused: { bg: "bg-secondary text-secondary-foreground border-2 border-foreground", icon: <MinusCircle className="size-3" />, label: "Excused" },
    absent: { bg: "bg-destructive text-destructive-foreground border-2 border-foreground", icon: <XCircle className="size-3" />, label: "Absent" },
  }
  const s = map[status] ?? map.absent
  return <Badge className={cn(s.bg, "shrink-0 gap-1 font-bold")}>{s.icon}{s.label}</Badge>
}
