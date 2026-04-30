"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Play, Square, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Course } from "@/lib/types"
import { formatDate, formatTime } from "@/lib/utils-format"
import { notifyLectureStarted } from "@/app/actions/push"

type LectureRow = {
  id: string
  course_id: string
  scheduled_start: string
  scheduled_end: string
  room: string | null
  topic: string | null
  status: string
  beacon_id: string | null
  created_at: string
  courses: { name: string; code: string }
}

export function LecturesManager({ lectures, courses }: { lectures: LectureRow[]; courses: Course[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [courseIds, setCourseIds] = useState<string[]>(courses.length > 0 ? [courses[0].id] : [])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [room, setRoom] = useState("")
  const [topic, setTopic] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function addCourseSelect() {
    const unselected = courses.find((c) => !courseIds.includes(c.id))
    setCourseIds([...courseIds, unselected ? unselected.id : ""])
  }

  function updateCourseSelect(index: number, newId: string) {
    const updated = [...courseIds]
    updated[index] = newId
    setCourseIds(updated)
  }

  function removeCourseSelect(index: number) {
    const updated = courseIds.filter((_, i) => i !== index)
    setCourseIds(updated)
  }

  async function createLecture(e: React.FormEvent) {
    e.preventDefault()
    if (courseIds.length === 0 || courseIds.includes("")) {
      toast.error("Please select a valid course for all options")
      return
    }
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const startISO = new Date(`${date}T${startTime}:00`).toISOString()
    const endISO = new Date(`${date}T${endTime}:00`).toISOString()
    const insertData = courseIds.map(cid => ({
      course_id: cid,
      faculty_id: user.id,
      scheduled_start: startISO,
      scheduled_end: endISO,
      room: room || null,
      topic: topic || null,
    }))
    
    const { error } = await supabase.from("lectures").insert(insertData)
    if (error) {
      toast.error("Could not create lecture", { description: error.message })
      setSaving(false)
      return
    }
    toast.success("Lecture scheduled")
    setSaving(false)
    setOpen(false)
    setRoom("")
    setTopic("")
    router.refresh()
  }

  async function startLecture(id: string, courseId: string, courseCode: string) {
    if (lectures.some(l => l.status === "live")) {
      toast.error("You already have a live lecture.", { description: "End the current one before starting another." })
      return
    }

    setBusyId(id)
    const supabase = createClient()
    const beaconId = `beacon-${crypto.randomUUID().slice(0, 8)}`
    
    // Find all scheduled lectures created at the exact same time (combined session)
    const targetLecture = lectures.find(l => l.id === id)
    const siblingIds = targetLecture 
      ? lectures.filter(l => l.created_at === targetLecture.created_at && l.status === "scheduled").map(l => l.id)
      : [id]

    const { error } = await supabase
      .from("lectures")
      .update({ status: "live", beacon_id: beaconId, started_at: new Date().toISOString() })
      .in("id", siblingIds)

    if (error) {
      toast.error("Could not start lecture", { description: error.message })
    } else {
      toast.success(siblingIds.length > 1 ? `Combined ${siblingIds.length} classes into live session.` : "Lecture is live. Please ensure your physical BLE beacon or native broadcaster app is active.")
      
      for (const siblingId of siblingIds) {
        const siblingLecture = lectures.find(l => l.id === siblingId)
        if (siblingLecture) {
          notifyLectureStarted(siblingLecture.course_id, siblingLecture.courses.code).catch(console.error)
        }
      }
    }
    setBusyId(null)
    router.refresh()
  }

  async function endLecture(id: string) {
    setBusyId(id)
    const supabase = createClient()

    const targetLecture = lectures.find(l => l.id === id)
    const siblingIds = targetLecture?.beacon_id 
      ? lectures.filter(l => l.beacon_id === targetLecture.beacon_id).map(l => l.id)
      : [id]

    // 1. Mark absentees for ALL combined lectures
    for (const sibId of siblingIds) {
      const { data: lec } = await supabase.from("lectures").select("course_id, courses(year, department, division)").eq("id", sibId).single()
      if (lec?.course_id && lec.courses) {
        const c = lec.courses as any
        const { data: enrolled } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "student")
          .eq("year", c.year)
          .eq("department", c.department)
          .eq("division", c.division)
        
        const { data: marked } = await supabase.from("attendance").select("student_id").eq("lecture_id", sibId)
        const markedSet = new Set((marked ?? []).map((m) => m.student_id))
        const missing = (enrolled ?? []).filter((e) => !markedSet.has(e.id))
        if (missing.length) {
          await supabase.from("attendance").upsert(
            missing.map((m) => ({
              lecture_id: sibId,
              student_id: m.id,
              status: "absent" as const,
              method: "manual" as const,
            })),
            { onConflict: "lecture_id,student_id" },
          )
        }
      }
    }

    // 2. End ALL combined lectures
    const query = targetLecture?.beacon_id 
      ? supabase.from("lectures").update({ status: "completed", ended_at: new Date().toISOString() }).eq("beacon_id", targetLecture.beacon_id)
      : supabase.from("lectures").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", id)

    const { error } = await query
    
    if (error) {
      toast.error("Could not end lecture", { description: error.message })
    } else {
      toast.success(siblingIds.length > 1 ? `Ended ${siblingIds.length} combined sessions — absentees recorded` : "Lecture ended — absentees recorded")
    }
    
    setBusyId(null)
    router.refresh()
  }

  async function deleteLecture(id: string) {
    setBusyId(id)
    const supabase = createClient()
    const targetLecture = lectures.find(l => l.id === id)
    const siblingIds = targetLecture 
      ? lectures.filter(l => l.created_at === targetLecture.created_at && l.status === targetLecture.status).map(l => l.id)
      : [id]

    const { error } = await supabase.from("lectures").delete().in("id", siblingIds)
    if (error) toast.error("Could not delete", { description: error.message })
    else toast.success(siblingIds.length > 1 ? `Deleted ${siblingIds.length} combined sessions` : "Lecture deleted")
    setBusyId(null)
    router.refresh()
  }

  // Group lectures by created_at and status so combined lectures show as one row
  const groupedLectures = Object.values(
    lectures.reduce((acc, l) => {
      // Use created_at + status + scheduled_start to safely group combined lectures created in a single batch
      const key = `${l.created_at}_${l.scheduled_start}_${l.status}`;
      if (!acc[key]) {
        acc[key] = { ...l, allCourses: [l.courses] };
      } else {
        acc[key].allCourses.push(l.courses);
      }
      return acc;
    }, {} as Record<string, any>)
  ).sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()) as (LectureRow & { allCourses: {name: string, code: string}[] })[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!courses.length}>
              <Plus className="size-4" />
              Schedule lecture
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule a lecture</DialogTitle>
              <DialogDescription>You can start it instantly from the list.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createLecture} className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Courses to Schedule</Label>
                {courseIds.map((cId, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Select value={cId} onValueChange={(val) => updateCourseSelect(index, val)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id} disabled={courseIds.includes(c.id) && c.id !== cId}>
                            {c.name} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {courseIds.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCourseSelect(index)}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
                
                {courseIds.length < courses.length && (
                  <Button type="button" variant="outline" size="sm" onClick={addCourseSelect} className="mt-2 w-fit">
                    <Plus className="size-4 mr-2" />
                    Combine another course
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">End</Label>
                <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="room">Room</Label>
                <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="LH-204" />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="topic">Topic</Label>
                <Textarea id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} />
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Schedule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!courses.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No courses to schedule</EmptyTitle>
            <EmptyDescription>Create a course in the Courses tab first.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : lectures.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No lectures yet</EmptyTitle>
            <EmptyDescription>Schedule your first lecture to start tracking attendance.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Schedule lecture
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedLectures.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {l.allCourses.length > 1 ? `Combined Lecture (${l.allCourses.length} Courses)` : l.courses.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.allCourses.map(c => c.code).join(", ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(l.scheduled_start)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {formatTime(l.scheduled_start)} – {formatTime(l.scheduled_end)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.room ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {l.status === "scheduled" && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => startLecture(l.id, l.course_id, l.courses.code)} 
                          disabled={busyId === l.id || lectures.some(l => l.status === "live")}
                        >
                          {busyId === l.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                          Start
                        </Button>
                      )}
                      {l.status === "live" && (
                        <Button size="sm" variant="destructive" onClick={() => endLecture(l.id)} disabled={busyId === l.id}>
                          {busyId === l.id ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
                          End
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/faculty/lecture/${l.id}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                      {l.status !== "live" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteLecture(l.id)}
                          disabled={busyId === l.id}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="bg-success text-success-foreground">Live</Badge>
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>
  return <Badge variant="outline">Scheduled</Badge>
}
