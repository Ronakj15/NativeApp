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

type LectureRow = {
  id: string
  course_id: string
  scheduled_start: string
  scheduled_end: string
  room: string | null
  topic: string | null
  status: string
  beacon_id: string | null
  courses: { name: string; code: string }
}

export function LecturesManager({ lectures, courses }: { lectures: LectureRow[]; courses: Course[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [room, setRoom] = useState("")
  const [topic, setTopic] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function createLecture(e: React.FormEvent) {
    e.preventDefault()
    if (!courseId) {
      toast.error("Please select a course")
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
    const { error } = await supabase.from("lectures").insert({
      course_id: courseId,
      faculty_id: user.id,
      scheduled_start: startISO,
      scheduled_end: endISO,
      room: room || null,
      topic: topic || null,
    })
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

  async function startLecture(id: string) {
    setBusyId(id)
    const supabase = createClient()
    const beaconId = `beacon-${crypto.randomUUID().slice(0, 8)}`
    const { error } = await supabase
      .from("lectures")
      .update({ status: "live", beacon_id: beaconId, started_at: new Date().toISOString() })
      .eq("id", id)
    if (error) toast.error("Could not start lecture", { description: error.message })
    else toast.success("Lecture is live — beacon broadcasting")
    setBusyId(null)
    router.refresh()
  }

  async function endLecture(id: string) {
    setBusyId(id)
    const supabase = createClient()
    // Mark missing students as absent
    const { data: lec } = await supabase.from("lectures").select("course_id").eq("id", id).single()
    if (lec?.course_id) {
      const { data: enrolled } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("course_id", lec.course_id)
      const { data: marked } = await supabase.from("attendance").select("student_id").eq("lecture_id", id)
      const markedSet = new Set((marked ?? []).map((m) => m.student_id))
      const missing = (enrolled ?? []).filter((e) => !markedSet.has(e.student_id))
      if (missing.length) {
        await supabase.from("attendance").upsert(
          missing.map((m) => ({
            lecture_id: id,
            student_id: m.student_id,
            status: "absent" as const,
            method: "manual" as const,
          })),
          { onConflict: "lecture_id,student_id" },
        )
      }
    }
    const { error } = await supabase
      .from("lectures")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", id)
    if (error) toast.error("Could not end lecture", { description: error.message })
    else toast.success("Lecture ended — absentees recorded")
    setBusyId(null)
    router.refresh()
  }

  async function deleteLecture(id: string) {
    setBusyId(id)
    const supabase = createClient()
    const { error } = await supabase.from("lectures").delete().eq("id", id)
    if (error) toast.error("Could not delete", { description: error.message })
    else toast.success("Lecture deleted")
    setBusyId(null)
    router.refresh()
  }

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
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {lectures.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{l.courses.name}</span>
                      <span className="text-xs text-muted-foreground">{l.courses.code}</span>
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
                        <Button size="sm" variant="secondary" onClick={() => startLecture(l.id)} disabled={busyId === l.id}>
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
