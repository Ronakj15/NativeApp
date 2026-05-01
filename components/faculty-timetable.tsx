"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Trash2, Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"

const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
]

// Time blocks removed in favor of customizable times

type Course = { id: string; name: string; code: string; color: string }
type TimetableSlot = { id: string; course_id: string; day_of_week: number; start_time: string; end_time: string; room: string | null; faculty_id: string | null; courses?: Course; profiles?: { full_name: string } }

export function FacultyTimetable() {
  const [department, setDepartment] = useState("")
  const [year, setYear] = useState("")
  const [division, setDivision] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [searched, setSearched] = useState(false)
  const [userId, setUserId] = useState<string>("")

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id || ""))
  }, [])

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [roomInput, setRoomInput] = useState("")
  const [startTimeInput, setStartTimeInput] = useState("09:00")
  const [endTimeInput, setEndTimeInput] = useState("10:00")
  const [isSaving, setIsSaving] = useState(false)

  const handleSearch = async () => {
    if (!department || !year || !division) {
      toast.error("Please fill all fields (Department, Year, Division).")
      return
    }

    setLoading(true)
    const supabase = createClient()

    // 1. Fetch courses matching criteria
    const { data: cData, error: cErr } = await supabase
      .from("courses")
      .select("id, name, code, color")
      .ilike("department", department)
      .eq("year", parseInt(year))
      .ilike("division", division)

    if (cErr) {
      toast.error("Error fetching courses", { description: cErr.message })
      setLoading(false)
      return
    }

    setCourses(cData || [])
    const courseIds = (cData || []).map(c => c.id)

    // 2. Fetch slots for those courses
    if (courseIds.length > 0) {
      const { data: sData, error: sErr } = await supabase
        .from("timetable_slots")
        .select("*, courses(id, name, code, color), profiles(full_name)")
        .in("course_id", courseIds)

      if (sErr) toast.error("Error fetching timetable", { description: sErr.message })
      else setSlots(sData || [])
    } else {
      setSlots([])
    }

    setSearched(true)
    setLoading(false)
  }

  const handleAddClick = (day: number) => {
    setEditingDay(day)
    setStartTimeInput("09:00")
    setEndTimeInput("10:00")
    setRoomInput("")
    setSelectedCourseId("")
    setOpenDialog(true)
  }

  const handleSaveSlot = async () => {
    if (!editingDay || !selectedCourseId || !startTimeInput || !endTimeInput) return
    setIsSaving(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("timetable_slots")
      .insert({
        course_id: selectedCourseId,
        day_of_week: editingDay,
        start_time: startTimeInput.length === 5 ? `${startTimeInput}:00` : startTimeInput,
        end_time: endTimeInput.length === 5 ? `${endTimeInput}:00` : endTimeInput,
        room: roomInput || null,
        faculty_id: userId || null,
      })
      .select("*, courses(id, name, code, color), profiles(full_name)")
      .single()

    if (error) {
      toast.error("Failed to add slot", { description: error.message })
    } else {
      toast.success("Slot added successfully")
      setSlots([...slots, data])
      setOpenDialog(false)
    }
    setIsSaving(false)
  }

  const handleDeleteSlot = async (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation()
    const supabase = createClient()
    const { error } = await supabase.from("timetable_slots").delete().eq("id", slotId)
    if (error) {
      toast.error("Failed to remove slot", { description: error.message })
    } else {
      setSlots(slots.filter(s => s.id !== slotId))
      toast.success("Slot removed")
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="grid gap-2 flex-1 w-full">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="Select Dept" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CS">Computer Science (CS)</SelectItem>
                <SelectItem value="CE">Computer Engineering (CE)</SelectItem>
                <SelectItem value="IT">Information Technology</SelectItem>
                <SelectItem value="AI">AI & Data Science</SelectItem>
                <SelectItem value="EXTC">Electronics & Telecom</SelectItem>
                <SelectItem value="ME">Mechanical</SelectItem>
                <SelectItem value="CV">Civil</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 flex-1 w-full">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1st Year</SelectItem>
                <SelectItem value="2">2nd Year</SelectItem>
                <SelectItem value="3">3rd Year</SelectItem>
                <SelectItem value="4">4th Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 flex-1 w-full">
            <Label>Division</Label>
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger><SelectValue placeholder="Select Div" /></SelectTrigger>
              <SelectContent>
                {["A", "B", "C", "D", "E", "F"].map(div => (
                  <SelectItem key={div} value={div}>Div {div}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={loading} className="w-full md:w-auto shrink-0">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            <span className="ml-2">Load Timetable</span>
          </Button>
        </CardContent>
      </Card>

      {/* Grid */}
      {searched && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {courses.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                No courses found for this criteria. Make sure courses are created first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {DAYS.map(day => {
                  const daySlots = slots
                    .filter(s => s.day_of_week === day.id)
                    .sort((a, b) => b.start_time.localeCompare(a.start_time))

                  return (
                    <div key={day.id} className="flex flex-col gap-3 bg-muted/20 rounded-xl p-3 border border-border">
                      <div className="flex items-center justify-between border-b border-border pb-2 mb-1">
                        <span className="font-semibold">{day.name}</span>
                        <Button variant="ghost" size="icon" className="size-6 h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary" onClick={() => handleAddClick(day.id)}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>

                      {daySlots.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4 italic opacity-70 border border-dashed rounded-md">No classes</div>
                      ) : (
                        daySlots.map(slot => (
                          <div key={slot.id} className={`p-3 rounded-lg border flex flex-col gap-1.5 shadow-sm bg-${slot.courses?.color || "primary"}/10 border-${slot.courses?.color || "primary"}/20 text-${slot.courses?.color || "primary"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold leading-tight line-clamp-2">{slot.courses?.name}</span>
                              <button onClick={(e) => handleDeleteSlot(e, slot.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <span className="text-xs font-mono opacity-80">{slot.courses?.code}</span>
                            
                            <div className="flex flex-col gap-0.5 mt-1">
                              {slot.profiles?.full_name && (
                                <span className="text-[10px] font-medium opacity-75">
                                  {slot.profiles.full_name}
                                </span>
                              )}
                              <div className="flex items-center justify-between text-[11px] font-medium opacity-90">
                                <span>{slot.start_time.slice(0,5)} - {slot.end_time.slice(0,5)}</span>
                                {slot.room && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="size-3" /> {slot.room}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lecture</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Course</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input type="time" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input type="time" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Room (Optional)</Label>
              <Input placeholder="e.g. Room 302" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSlot} disabled={!selectedCourseId || isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
