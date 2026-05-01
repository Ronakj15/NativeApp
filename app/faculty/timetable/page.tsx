import { FacultyTimetable } from "@/components/faculty-timetable"

export default function FacultyTimetablePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Timetable Management</h1>
        <p className="text-muted-foreground">
          View and create timetables for any department, year, and division.
        </p>
      </div>
      <FacultyTimetable />
    </div>
  )
}
