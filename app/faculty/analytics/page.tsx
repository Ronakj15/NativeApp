"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsCharts } from "@/components/analytics-charts"
import { PageLoader } from "@/components/page-loader"

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [courseStats, setCourseStats] = useState<any[]>([])
  const [dailyTrend, setDailyTrend] = useState<any[]>([])
  const [overall, setOverall] = useState(0)
  const [totalLectures, setTotalLectures] = useState(0)
  const [totalCourses, setTotalCourses] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data: courses } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false })
      setTotalCourses((courses ?? []).length)

      const { data: lectures } = await supabase
        .from("lectures")
        .select("id, course_id, scheduled_start, status")
        .order("scheduled_start", { ascending: false })
        .limit(500)

      const { data: attendance } = await supabase
        .from("attendance")
        .select("lecture_id, status")

      const lectureMap = new Map()
      for (const lec of lectures ?? []) lectureMap.set(lec.id, lec)

      const courseStatsMap = new Map()
      for (const c of courses ?? []) courseStatsMap.set(c.id, { name: c.code, value: 0, total: 0, present: 0 })

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
          const cs = courseStatsMap.get(lec.course_id)
          if (cs) {
            cs.total += 1
            if (a.status === "present" || a.status === "late") cs.present += 1
          }
        }

        const day = new Date(lec.scheduled_start).toISOString().slice(0, 10)
        const e = dayMap.get(day) ?? { total: 0, present: 0 }
        e.total += 1
        if (a.status === "present" || a.status === "late") e.present += 1
        dayMap.set(day, e)
      }

      const cs = Array.from(courseStatsMap.values()).map(stats => {
        stats.value = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
        return stats
      })
      setCourseStats(cs)

      const dt = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([day, v]) => ({
          day: day.slice(5),
          pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        }))
      setDailyTrend(dt)

      const tl = (lectures ?? []).filter((l) => l.status === "completed").length
      setTotalLectures(tl)
      const totalRecords = (attendance ?? []).length
      const totalPresent = (attendance ?? []).filter((a) => a.status === "present" || a.status === "late").length
      setOverall(totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0)

      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <PageLoader />

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
            <div className="text-3xl font-semibold">{totalCourses}</div>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts courseStats={courseStats} dailyTrend={dailyTrend} />
    </div>
  )
}
