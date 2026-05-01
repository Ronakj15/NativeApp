import Link from "next/link"
import { ScanFace, CalendarDays, TrendingUp, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/server"
import { formatTime } from "@/lib/utils-format"
import { AttendanceRadar } from "@/components/attendance-radar"

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Today's lectures via enrollments
  const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("student_id", user.id)
  const courseIds = enrollments?.map((e) => e.course_id) ?? []

  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  const { data: lectures } = courseIds.length
    ? await supabase
        .from("lectures")
        .select("*, courses!inner(name, code, color)")
        .in("course_id", courseIds)
        .gte("scheduled_start", start)
        .lt("scheduled_start", end)
        .order("scheduled_start", { ascending: true })
    : { data: [] as any[] }

  // Attendance stats
  const { data: attendance } = await supabase
    .from("attendance")
    .select("status, lecture_id, lectures!inner(course_id)")
    .eq("student_id", user.id)

  const totals = {
    total: attendance?.length ?? 0,
    present: 0,
    late: 0,
    absent: 0,
  }

  const courseCounts = new Map()

  if (attendance) {
    for (const a of attendance) {
      if (a.status === "present") totals.present++
      else if (a.status === "late") totals.late++
      else if (a.status === "absent") totals.absent++

      const cId = a.lectures?.course_id
      if (cId != null) {
        let counts = courseCounts.get(cId)
        if (!counts) {
          counts = { present: 0, total: 0 }
          courseCounts.set(cId, counts)
        }
        counts.total++
        if (a.status === "present" || a.status === "late") {
          counts.present++
        }
      }
    }
  }
  const overallPct = totals.total ? Math.round(((totals.present + totals.late) / totals.total) * 100) : 0

  // Per-course
  const { data: courses } = courseIds.length
    ? await supabase.from("courses").select("*").in("id", courseIds)
    : { data: [] as any[] }

  const courseStats = (courses ?? []).map((c) => {
    const counts = courseCounts.get(c.id) || { present: 0, total: 0 }
    const pct = counts.total ? Math.round((counts.present / counts.total) * 100) : 0
    return { course: c, present: counts.present, total: counts.total, pct }
  })

  const faceEnrolled = !!profile?.face_descriptor

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Hi, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-muted-foreground">Here&apos;s your attendance at a glance.</p>
      </div>

      {!faceEnrolled && (
        <Card className="glass brutal rounded-2xl border-warning text-foreground">
          <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5">
            <div className="size-11 rounded-lg bg-warning text-warning-foreground border-2 border-foreground grid place-items-center shrink-0">
              <ScanFace className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold tracking-tight">Enroll your face to start marking attendance</p>
              <p className="text-sm text-muted-foreground">
                A one-time setup. Your face descriptor is stored securely; we never store photos.
              </p>
            </div>
            <Button asChild className="brutal-sm brutal-lift bg-foreground text-background hover:bg-foreground">
              <Link href="/student/enroll-face">
                Enroll now <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <AttendanceRadar faceEnrolled={faceEnrolled} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass brutal rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono uppercase tracking-widest text-[11px]">
              Overall attendance
            </CardDescription>
            <CardTitle className="text-4xl font-bold tracking-tight">{overallPct}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallPct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {totals.present + totals.late} of {totals.total} lectures attended
            </p>
          </CardContent>
        </Card>
        <Card className="glass brutal rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono uppercase tracking-widest text-[11px]">Today</CardDescription>
            <CardTitle className="text-4xl font-bold tracking-tight">{lectures?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Lectures scheduled today</p>
          </CardContent>
        </Card>
        <Card className="glass brutal rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono uppercase tracking-widest text-[11px]">Status</CardDescription>
            <CardTitle className="text-4xl font-bold tracking-tight">
              {overallPct >= 75 ? (
                <span className="text-success">Safe</span>
              ) : overallPct >= 65 ? (
                <span className="text-warning">Borderline</span>
              ) : (
                <span className="text-destructive">At risk</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">75% threshold for exam eligibility</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass brutal rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="tracking-tight">Today&apos;s completed</CardTitle>
            <CardDescription>Lectures finished today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const completed = (lectures ?? [])
                .filter((l: any) => l.status === "completed")
                .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
              const visible = completed.slice(0, 4)
              const hasMore = completed.length > 4

              if (visible.length === 0) {
                return (
                  <div className="flex items-center justify-center text-sm text-muted-foreground py-10">
                    No completed lectures today yet.
                  </div>
                )
              }

              return (
                <>
                  {visible.map((l: any) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 border-foreground/15 bg-card/40 hover:border-foreground hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_var(--foreground)] transition-all"
                    >
                      <div className="size-10 rounded-md bg-foreground text-background border-2 border-foreground grid place-items-center shrink-0">
                        <CalendarDays className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{l.courses?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.courses?.code} • {l.room ?? "TBA"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm tabular-nums">{formatTime(l.scheduled_start)}</p>
                        <Badge variant="secondary" className="mt-1">Done</Badge>
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <div className="text-center pt-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/student/reports" className="text-primary font-medium">
                          View {completed.length - 4} more <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              )
            })()}
          </CardContent>
        </Card>

        <Card className="glass brutal rounded-2xl">
          <CardHeader>
            <CardTitle className="tracking-tight">By subject</CardTitle>
            <CardDescription>Your top courses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {courseStats.length ? (
              courseStats.slice(0, 6).map((s) => (
                <div key={s.course.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{s.course.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.present}/{s.total} • {s.pct}%
                    </span>
                  </div>
                  <Progress value={s.pct} className="h-1.5" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No courses yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard
          href="/student/reports?tab=calculator"
          title="Bunk calculator"
          desc="See how many lectures you can skip safely."
          icon={TrendingUp}
        />
        <ActionCard
          href="/student/reports"
          title="Reports"
          desc="History, heatmap and trends in one place."
          icon={CalendarDays}
        />
      </div>
    </div>
  )
}

function ActionCard({
  href,
  title,
  desc,
  icon: Icon,
}: {
  href: string
  title: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="glass brutal brutal-lift rounded-2xl p-5 flex flex-col gap-3 text-foreground"
    >
      <div className="size-10 rounded-lg bg-foreground text-background border-2 border-foreground grid place-items-center">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-bold tracking-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <span className="text-sm font-semibold inline-flex items-center gap-1">
        Open <ArrowRight className="size-3.5" />
      </span>
    </Link>
  )
}
