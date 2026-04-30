import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsCharts } from "@/components/analytics-charts"

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (!profile || profile.role === "student") redirect("/student")

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false })

  const { data: lectures } = await supabase
    .from("lectures")
    .select("id, course_id, scheduled_start, status")
    .order("scheduled_start", { ascending: false })
    .limit(500)

  const { data: attendance } = await supabase
    .from("attendance")
    .select("lecture_id, status")

  const lectureMap = new Map();
  for (const lec of lectures ?? []) {
    lectureMap.set(lec.id, lec);
  }

  const courseStatsMap = new Map();
  for (const c of courses ?? []) {
    courseStatsMap.set(c.id, { name: c.code, value: 0, total: 0, present: 0 });
  }

  const dayMap = new Map<string, { total: number; present: number }>()
  for (const lec of lectures ?? []) {
    if (lec.status !== "completed") continue
    const day = new Date(lec.scheduled_start).toISOString().slice(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, { total: 0, present: 0 })
  }

  for (const a of attendance ?? []) {
    const lec = lectureMap.get(a.lecture_id)
    if (!lec) continue

    if (lec.status === "completed") {
      const courseStats = courseStatsMap.get(lec.course_id);
      if (courseStats) {
        courseStats.total += 1;
        if (a.status === "present" || a.status === "late") {
          courseStats.present += 1;
        }
      }
    }

    const day = new Date(lec.scheduled_start).toISOString().slice(0, 10)
    const e = dayMap.get(day) ?? { total: 0, present: 0 }
    e.total += 1
    if (a.status === "present" || a.status === "late") e.present += 1
    dayMap.set(day, e)
  }
  const courseStats = Array.from(courseStatsMap.values()).map(stats => {
    stats.value = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    return stats;
  });

  const dailyTrend = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([day, v]) => ({
      day: day.slice(5),
      pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }))

  const totalLectures = (lectures ?? []).filter((l) => l.status === "completed").length
  const totalRecords = (attendance ?? []).length
  const totalPresent = (attendance ?? []).filter((a) => a.status === "present" || a.status === "late").length
  const overall = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Department-wide attendance insights</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{overall}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed lectures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totalLectures}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{(courses ?? []).length}</div>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts courseStats={courseStats} dailyTrend={dailyTrend} />
    </div>
  )
}
