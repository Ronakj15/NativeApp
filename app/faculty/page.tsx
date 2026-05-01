import Link from "next/link"
import { Presentation, Users, BarChart3, Plus, ArrowRight, Radio, Clock, Calendar, CalendarClock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { formatTime, pct } from "@/lib/utils-format"
import { FacultyBroadcast } from "@/components/faculty-broadcast"

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

  // Upcoming lectures (scheduled, after now, next 7 days)
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: upcomingLectures } = await supabase
    .from("lectures")
    .select("*, courses!inner(name, code)")
    .eq("faculty_id", user.id)
    .eq("status", "scheduled")
    .gte("scheduled_start", new Date().toISOString())
    .lte("scheduled_start", next7)
    .order("scheduled_start", { ascending: true })
    .limit(6)

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

      {/* Broadcast card + Upcoming lectures side by side */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <FacultyBroadcast />

        <Card className="glass brutal rounded-2xl h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center border-2 border-foreground shrink-0">
                  <CalendarClock className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Upcoming Lectures</CardTitle>
                  <CardDescription className="text-xs">Next 7 days</CardDescription>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/faculty/lectures">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              // Group combined lectures (same created_at + scheduled_start)
              const grouped = Object.values(
                (upcomingLectures ?? []).reduce((acc: Record<string, any>, l: any) => {
                  const key = `${l.created_at}_${l.scheduled_start}`
                  if (!acc[key]) {
                    acc[key] = { ...l, allCourses: [l.courses] }
                  } else {
                    acc[key].allCourses.push(l.courses)
                  }
                  return acc
                }, {})
              ).sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()) as any[]

              if (grouped.length === 0) {
                return (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    No upcoming lectures.{" "}
                    <Link href="/faculty/lectures" className="text-primary hover:underline font-medium">
                      Schedule one →
                    </Link>
                  </div>
                )
              }

              return grouped.map((l: any) => {
                const dt = new Date(l.scheduled_start)
                const isToday = dt.toDateString() === today.toDateString()
                const isTomorrow = dt.toDateString() === new Date(today.getTime() + 86400000).toDateString()
                const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
                const isCombined = l.allCourses.length > 1
                const displayName = isCombined
                  ? `Combined (${l.allCourses.length} Courses)`
                  : l.allCourses[0]?.name
                const displayCodes = l.allCourses.map((c: any) => c.code).join(", ")

                return (
                  <Link
                    key={l.id}
                    href={`/faculty/lecture/${l.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-foreground/10 hover:border-primary/40 bg-card hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex flex-col items-center justify-center size-12 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                      <span className="text-lg font-black leading-none tabular-nums">{dt.getDate()}</span>
                      <span className="text-[9px] font-mono uppercase leading-none">{dt.toLocaleDateString("en-IN", { month: "short" })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {displayName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="font-mono">{displayCodes}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatTime(l.scheduled_start)}
                        </span>
                        {l.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {l.room}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-bold uppercase tracking-wider">
                      {dayLabel}
                    </Badge>
                  </Link>
                )
              })
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Today&apos;s completed</CardTitle>
                <CardDescription>Lectures finished today</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/faculty/lectures">
                  All lectures <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const completed = (todayLectures ?? [])
                .filter((l: any) => l.status === "completed")
                .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
              const visible = completed.slice(0, 4)
              const hasMore = completed.length > 4

              if (visible.length === 0) {
                return (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    No completed lectures today yet.
                  </div>
                )
              }

              return (
                <>
                  {visible.map((l: any) => (
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
                  ))}
                  {hasMore && (
                    <div className="text-center pt-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/faculty/lectures" className="text-primary font-medium">
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
