import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, CalendarCheck, CalendarX, TrendingUp, GraduationCap } from "lucide-react"

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!myProfile || myProfile.role === "student") redirect("/student")

  const { data: student } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "student")
    .single()

  if (!student) notFound()

  // Get all attendance records for this student, joined with lectures
  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, lecture_id, status, marked_at, method")
    .eq("student_id", id)

  // Get all lectures for context
  const lectureIds = [...new Set((attendance ?? []).map(a => a.lecture_id))]
  const { data: lectures } = lectureIds.length > 0
    ? await supabase
        .from("lectures")
        .select("id, course_id, scheduled_start, topic, status")
        .in("id", lectureIds)
    : { data: [] as any[] }

  // Get courses for names
  const courseIds = [...new Set((lectures ?? []).map(l => l.course_id))]
  const { data: courses } = courseIds.length > 0
    ? await supabase
        .from("courses")
        .select("id, name, code")
        .in("id", courseIds)
    : { data: [] as any[] }

  const courseMap = new Map<string, { name: string; code: string }>()
  for (const c of courses ?? []) courseMap.set(c.id, { name: c.name, code: c.code })

  const lectureMap = new Map<string, { course_id: string; scheduled_start: string; topic: string | null; status: string }>()
  for (const l of lectures ?? []) lectureMap.set(l.id, l)

  // Stats
  const totalRecords = (attendance ?? []).length
  const presentCount = (attendance ?? []).filter(a => a.status === "present" || a.status === "late").length
  const absentCount = (attendance ?? []).filter(a => a.status === "absent").length
  const lateCount = (attendance ?? []).filter(a => a.status === "late").length
  const overallPct = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0

  // Per-course breakdown
  const courseBreakdown = new Map<string, { total: number; present: number }>()
  for (const a of attendance ?? []) {
    const lec = lectureMap.get(a.lecture_id)
    if (!lec) continue
    const entry = courseBreakdown.get(lec.course_id) ?? { total: 0, present: 0 }
    entry.total += 1
    if (a.status === "present" || a.status === "late") entry.present += 1
    courseBreakdown.set(lec.course_id, entry)
  }

  // Recent attendance (last 20)
  const recentAttendance = [...(attendance ?? [])]
    .sort((a, b) => new Date(b.marked_at ?? 0).getTime() - new Date(a.marked_at ?? 0).getTime())
    .slice(0, 20)

  const initials = (student.full_name || student.email).slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/faculty/students">
          <ArrowLeft className="size-4 mr-1" />
          Back to Students
        </Link>
      </Button>

      {/* Student Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="size-28 border-4 border-primary/20 shadow-lg">
              {student.avatar_url && <AvatarImage src={student.avatar_url} className="object-cover" />}
              <AvatarFallback className="text-3xl bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-semibold tracking-tight">{student.full_name || "Unnamed"}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                {student.roll_no && <Badge variant="outline">{student.roll_no}</Badge>}
                {student.department && <Badge variant="secondary">{student.department}</Badge>}
                {student.division && <Badge variant="secondary">Div {student.division}</Badge>}
                {student.year && <Badge variant="secondary">Year {student.year}</Badge>}
                {student.face_enrolled_at ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">Face Enrolled</Badge>
                ) : (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">No Face Data</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {student.email}
                </span>
                {student.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {student.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="size-3.5" /> Overall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{overallPct}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarCheck className="size-3.5" /> Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-green-600">{presentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarX className="size-3.5" /> Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-500">{absentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="size-3.5" /> Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{courseBreakdown.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Course Breakdown */}
      {courseBreakdown.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Course-wise Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(courseBreakdown.entries()).map(([courseId, data]) => {
                const course = courseMap.get(courseId)
                const pct = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
                return (
                  <div key={courseId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {course ? `${course.code} — ${course.name}` : courseId}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {data.present}/{data.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attendance records yet.</p>
          ) : (
            <div className="divide-y">
              {recentAttendance.map((a) => {
                const lec = lectureMap.get(a.lecture_id)
                const course = lec ? courseMap.get(lec.course_id) : null
                const date = a.marked_at ? new Date(a.marked_at) : null
                return (
                  <div key={a.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {course ? course.code : "Unknown"}{lec?.topic ? ` — ${lec.topic}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {date
                          ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
                            " · " +
                            date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </div>
                    </div>
                    <Badge
                      variant={a.status === "present" ? "default" : a.status === "late" ? "secondary" : "destructive"}
                      className={
                        a.status === "present"
                          ? "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20"
                          : a.status === "late"
                          ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20"
                          : ""
                      }
                    >
                      {a.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
