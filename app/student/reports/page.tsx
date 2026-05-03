"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatTime } from "@/lib/utils-format"
import { CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react"
import { AttendanceHeatmap } from "@/components/attendance-heatmap"
import { BunkCalculator } from "@/components/bunk-calculator"
import { PageLoader } from "@/components/page-loader"

export default function ReportsPage() {
  const { user } = useAuth()
  const [attendance, setAttendance] = useState<any[]>([])
  const [cells, setCells] = useState<any[]>([])
  const [dayRecords, setDayRecords] = useState<any>({})
  const [stats, setStats] = useState<any[]>([])
  const [totals, setTotals] = useState({ total: 0, present: 0, late: 0, absent: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data: att } = await supabase
        .from("attendance")
        .select("*, lectures!inner(scheduled_start, room, course_id, courses(name, code))")
        .eq("student_id", user!.id)
        .order("marked_at", { ascending: false, nullsFirst: false })
        .limit(200)

      const records = att ?? []
      setAttendance(records)

      let present = 0, late = 0, absent = 0
      for (const a of records) {
        if (a.status === "present") present++
        else if (a.status === "late") late++
        else if (a.status === "absent") absent++
      }
      setTotals({ total: records.length, present, late, absent })

      // Heatmap cells
      const days = new Map<string, { present: number; total: number }>()
      for (const a of records) {
        const d = new Date((a as any).lectures.scheduled_start as string)
        const key = d.toISOString().slice(0, 10)
        const cur = days.get(key) ?? { present: 0, total: 0 }
        cur.total += 1
        if (a.status === "present" || a.status === "late") cur.present += 1
        days.set(key, cur)
      }
      const cellsArr: any[] = []
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - (364 - i))
        const key = d.toISOString().slice(0, 10)
        const data = days.get(key) ?? { present: 0, total: 0 }
        const intensity = data.total ? data.present / data.total : -1
        cellsArr.push({ date: key, present: data.present, total: data.total, intensity })
      }
      setCells(cellsArr)

      // Day records for heatmap click-through
      const dr: any = {}
      for (const a of records) {
        const lec = (a as any).lectures
        const d = new Date(lec.scheduled_start as string)
        const key = d.toISOString().slice(0, 10)
        if (!dr[key]) dr[key] = []
        dr[key].push({
          id: a.id, status: a.status, method: a.method ?? null, marked_at: a.marked_at ?? null,
          confidence: a.confidence ?? null, courseName: lec.courses?.name ?? "Unknown",
          courseCode: lec.courses?.code ?? "—", room: lec.room ?? null, scheduledStart: lec.scheduled_start,
        })
      }
      setDayRecords(dr)

      // Calculator stats
      const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("student_id", user!.id)
      const courseIds = enrollments?.map((e) => e.course_id) ?? []
      if (courseIds.length) {
        const { data: courses } = await supabase.from("courses").select("*").in("id", courseIds)
        const s = (courses ?? []).map((c) => {
          const list = records.filter((a: any) => a.lectures?.course_id === c.id)
          const presentC = list.filter((a) => a.status === "present" || a.status === "late").length
          return { id: c.id, name: c.name, code: c.code, planned: c.total_lectures_planned ?? 60, present: presentC, total: list.length }
        })
        setStats(s)
      }

      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Your attendance records, trends, and projections — all in one place.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total" value={totals.total} />
        <StatTile label="Present" value={totals.present} tone="success" />
        <StatTile label="Late" value={totals.late} tone="warning" />
        <StatTile label="Absent" value={totals.absent} tone="destructive" />
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-flex">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="calculator">Bunk calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Records</CardTitle>
              <CardDescription>Last 7 days · most recent first</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                const recent = attendance.filter((a: any) =>
                  new Date(a.lectures.scheduled_start).getTime() >= weekAgo.getTime()
                )
                if (!recent.length) {
                  return <p className="text-sm text-muted-foreground py-10 text-center">No attendance records in the last 7 days.</p>
                }
                return (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(a.lectures.scheduled_start)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{a.lectures.courses?.name}</span>
                              <span className="text-xs text-muted-foreground">{a.lectures.courses?.code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{a.lectures.room ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {formatTime(a.lectures.scheduled_start)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">
                            {a.method?.replace("_", " ") ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge status={a.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Calendar</CardTitle>
              <CardDescription>Select a month and click any day to see lecture details.</CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceHeatmap cells={cells} dayRecords={dayRecords} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>How many lectures can I miss?</CardTitle>
              <CardDescription>Pick a course and target percentage.</CardDescription>
            </CardHeader>
            <CardContent>
              <BunkCalculator courses={stats} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : ""
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "present") return <Badge className="bg-success/15 text-success hover:bg-success/15"><CheckCircle2 className="size-3" />Present</Badge>
  if (status === "late") return <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20"><Clock className="size-3" />Late</Badge>
  if (status === "excused") return <Badge variant="secondary"><MinusCircle className="size-3" />Excused</Badge>
  return <Badge variant="destructive"><XCircle className="size-3" />Absent</Badge>
}
