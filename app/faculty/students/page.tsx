import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { StudentsList } from "@/components/students-list"

export default async function StudentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (!profile || profile.role === "student") redirect("/student")

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, email, roll_no, division, year, department, avatar_url, face_enrolled_at")
    .eq("role", "student")
    .order("roll_no", { ascending: true })

  const { data: attendance } = await supabase.from("attendance").select("student_id, status")
  const stats = new Map<string, { total: number; present: number }>()
  for (const a of attendance ?? []) {
    const e = stats.get(a.student_id) ?? { total: 0, present: 0 }
    e.total += 1
    if (a.status === "present" || a.status === "late") e.present += 1
    stats.set(a.student_id, e)
  }

  // Convert Map to a serialisable object for the client component
  const statsObj: Record<string, { total: number; present: number }> = {}
  stats.forEach((v, k) => { statsObj[k] = v })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1">All enrolled students and their attendance</p>
      </div>

      <StudentsList
        students={students ?? []}
        stats={statsObj}
      />
    </div>
  )
}
