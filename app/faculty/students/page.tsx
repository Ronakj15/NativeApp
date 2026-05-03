"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { StudentsList } from "@/components/students-list"
import { PageLoader } from "@/components/page-loader"

export default function StudentsPage() {
  const { user, profile } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [statsObj, setStatsObj] = useState<Record<string, { total: number; present: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile) return
    const supabase = createClient()

    async function fetchData() {
      const { data: s } = await supabase
        .from("profiles")
        .select("id, full_name, email, roll_no, division, year, department, avatar_url, face_enrolled_at")
        .eq("role", "student")
        .order("roll_no", { ascending: true })
      setStudents(s ?? [])

      const { data: attendance } = await supabase.from("attendance").select("student_id, status")
      const stats = new Map<string, { total: number; present: number }>()
      for (const a of attendance ?? []) {
        const e = stats.get(a.student_id) ?? { total: 0, present: 0 }
        e.total += 1
        if (a.status === "present" || a.status === "late") e.present += 1
        stats.set(a.student_id, e)
      }

      const obj: Record<string, { total: number; present: number }> = {}
      stats.forEach((v, k) => { obj[k] = v })
      setStatsObj(obj)

      setLoading(false)
    }

    fetchData()
  }, [user, profile])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1">All enrolled students and their attendance</p>
      </div>

      <StudentsList
        students={students}
        stats={statsObj}
      />
    </div>
  )
}
