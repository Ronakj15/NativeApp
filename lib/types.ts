export type UserRole = "student" | "faculty" | "admin"
export type LectureStatus = "scheduled" | "live" | "completed" | "cancelled"
export type AttendanceStatus = "present" | "absent" | "late" | "excused"
export type AttendanceMethod = "beacon_face" | "manual" | "qr" | "face_only"

export type Profile = {
  id: string
  role: UserRole
  full_name: string
  email: string
  roll_no: string | null
  division: string | null
  year: number | null
  branch: string | null
  faculty_id: string | null
  department: string | null
  avatar_url: string | null
  phone: string | null
  face_descriptor: number[] | null
  face_enrolled_at: string | null
  created_at: string
  updated_at: string
}

export type Course = {
  id: string
  name: string
  code: string
  faculty_id: string | null
  division: string | null
  year: number | null
  branch: string | null
  total_lectures_planned: number
  color: string | null
  created_at: string
}

export type Lecture = {
  id: string
  course_id: string
  faculty_id: string | null
  scheduled_start: string
  scheduled_end: string
  room: string | null
  beacon_id: string | null
  topic: string | null
  status: LectureStatus
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export type Attendance = {
  id: string
  lecture_id: string
  student_id: string
  status: AttendanceStatus
  method: AttendanceMethod | null
  marked_at: string | null
  confidence: number | null
  notes: string | null
}

export type Notification = {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string
  read: boolean
  created_at: string
}

export type TimetableSlot = {
  id: string
  course_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}
