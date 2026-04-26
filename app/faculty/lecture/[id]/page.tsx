import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin, Radio } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatTime } from "@/lib/utils-format"
import { LiveLectureRoster } from "@/components/live-lecture-roster"

export default async function LectureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lecture } = await supabase
    .from("lectures")
    .select("*, courses!inner(id, name, code)")
    .eq("id", id)
    .maybeSingle()

  if (!lecture) notFound()

  const courseId = (lecture as any).courses.id

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, profiles!inner(id, full_name, email, roll_no, division)")
    .eq("course_id", courseId)
    .order("profiles(roll_no)", { ascending: true })

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("lecture_id", id)

  const attendanceMap = new Map((attendance ?? []).map((a) => [a.student_id, a]))
  const roster = (enrollments ?? []).map((e: any) => ({
    student: e.profiles,
    record: attendanceMap.get(e.student_id) ?? null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={lecture.status} />
          {lecture.beacon_id && lecture.status === "live" && (
            <Badge variant="outline" className="font-mono text-[11px]">
              <Radio className="size-3" />
              {lecture.beacon_id}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{(lecture as any).courses.name}</h1>
        <p className="text-muted-foreground">
          {(lecture as any).courses.code}
          {lecture.topic ? ` • ${lecture.topic}` : ""}
        </p>
        <div className="flex gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(lecture.scheduled_start)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3.5" />
            {formatTime(lecture.scheduled_start)} – {formatTime(lecture.scheduled_end)}
          </span>
          {lecture.room && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {lecture.room}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance roster</CardTitle>
          <CardDescription>
            {roster.length} students enrolled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LiveLectureRoster lectureId={id} status={lecture.status} initialRoster={roster as any} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="bg-success text-success-foreground">Live</Badge>
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>
  return <Badge variant="outline">Scheduled</Badge>
}
