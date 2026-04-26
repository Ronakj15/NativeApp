import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { AttendanceHeatmap } from "@/components/attendance-heatmap"

export default async function HeatmapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status, marked_at, lectures!inner(scheduled_start)")
    .eq("student_id", user.id)

  // Build day -> {present, total} map
  const days = new Map<string, { present: number; total: number; statuses: string[] }>()
  for (const a of attendance ?? []) {
    const d = new Date(((a as any).lectures.scheduled_start) as string)
    const key = d.toISOString().slice(0, 10)
    const cur = days.get(key) ?? { present: 0, total: 0, statuses: [] as string[] }
    cur.total += 1
    if (a.status === "present" || a.status === "late") cur.present += 1
    cur.statuses.push(a.status)
    days.set(key, cur)
  }

  const cells: { date: string; present: number; total: number; intensity: number }[] = []
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - (364 - i))
    const key = d.toISOString().slice(0, 10)
    const data = days.get(key) ?? { present: 0, total: 0, statuses: [] }
    const intensity = data.total ? data.present / data.total : -1
    cells.push({ date: key, present: data.present, total: data.total, intensity })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Attendance heatmap</h1>
        <p className="text-muted-foreground">A year-long view of your presence.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 12 months</CardTitle>
          <CardDescription>Each cell is one day. Greener = better attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap cells={cells} />
        </CardContent>
      </Card>
    </div>
  )
}
