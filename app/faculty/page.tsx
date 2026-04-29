import Link from "next/link"
import { Presentation, Users, BarChart3, Plus, ArrowRight, Radio, Clock, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { formatTime, pct } from "@/lib/utils-format"

export default async function FacultyDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  const { data: myCourses } = await supabase.from("courses").select("*").eq("faculty_id", user.id)
  const courseIds = (myCourses ?? []).map((c) => c.id)
  const { count: studentCount } = await supabase
    .from("enrollments")
    .select("student_id", { count: "exact", head: true })
    .in("course_id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"])

  const { data: todayLectures } = await supabase
    .from("lectures")
    .select("*, courses!inner(name, code)")
    .eq("faculty_id", user.id)
    .gte("scheduled_start", start)
    .lt("scheduled_start", end)
    .order("scheduled_start", { ascending: true })

  const { data: liveLectures } = await supabase
    .from("lectures")
    .select("*, courses!inner(name, code)")
    .eq("faculty_id", user.id)
    .eq("status", "live")

  // Aggregate attendance for analytics ribbon
  const { data: attendanceRows } = courseIds.length
    ? await supabase
        .from("attendance")
        .select("status, lectures!inner(course_id, faculty_id)")
        .eq("lectures.faculty_id", user.id)
    : { data: [] as any[] }

  const totalA = attendanceRows?.length ?? 0
  const presentA = attendanceRows?.filter((a) => a.status === "present" || a.status === "late").length ?? 0
  const overallPct = pct(presentA, totalA)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Welcome, {profile?.full_name?.split(" ")[0] || "Professor"}
          </h1>
          <p className="text-muted-foreground">Manage your lectures, classes and analytics.</p>
        </div>
        <Button asChild>
          <Link href="/faculty/lectures">
            <Plus className="size-4" />
            Schedule lecture
          </Link>
        </Button>
      </div>

      {liveLectures && liveLectures.length > 0 && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="size-10 rounded-lg bg-success text-success-foreground grid place-items-center relative shrink-0">
              <span className="absolute inset-0 rounded-lg bg-success animate-ping opacity-40" />
              <Radio className="size-5 relative" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {liveLectures.length === 1
                  ? `${(liveLectures[0] as any).courses?.name} is broadcasting`
                  : `${liveLectures.length} lectures live`}
              </p>
              <p className="text-sm text-muted-foreground">Tap to view roster and end the session.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {liveLectures.slice(0, 2).map((l: any) => (
                <Button asChild key={l.id} size="sm" variant="secondary">
                  <Link href={`/faculty/lecture/${l.id}`}>
                    Open <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Courses" value={myCourses?.length ?? 0} icon={Presentation} />
        <StatCard label="Students" value={studentCount ?? 0} icon={Users} />
        <StatCard label="Today's lectures" value={todayLectures?.length ?? 0} icon={Calendar} />
        <StatCard label="Avg attendance" value={`${overallPct}%`} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Today&apos;s lectures</CardTitle>
                <CardDescription>Scheduled, live and completed</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/faculty/lectures">
                  All lectures <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayLectures && todayLectures.length ? (
              todayLectures.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/faculty/lecture/${l.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/40 transition"
                >
                  <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Presentation className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.courses?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.courses?.code} • {l.room ?? "TBA"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums flex items-center gap-1 justify-end">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {formatTime(l.scheduled_start)}
                    </p>
                    <StatusBadge status={l.status} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-sm text-muted-foreground py-10 text-center">
                Nothing scheduled today.{" "}
                <Link href="/faculty/lectures" className="text-primary hover:underline">
                  Schedule one →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your courses</CardTitle>
            <CardDescription>{myCourses?.length ?? 0} active</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {myCourses && myCourses.length ? (
              myCourses.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border"
                >
                  <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0 text-sm font-medium">
                    {c.code.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.code} • Year {c.year ?? "—"} • Div {c.division ?? "—"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No courses yet.{" "}
                <Link href="/faculty/lectures" className="text-primary hover:underline">
                  Create one
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="mt-1 bg-success text-success-foreground">Live</Badge>
  if (status === "completed") return <Badge variant="secondary" className="mt-1">Completed</Badge>
  if (status === "cancelled") return <Badge variant="destructive" className="mt-1">Cancelled</Badge>
  return <Badge variant="outline" className="mt-1">Scheduled</Badge>
}
