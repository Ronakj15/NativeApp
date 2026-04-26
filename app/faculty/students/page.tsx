import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Users } from "lucide-react"

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
    .select("id, full_name, email, roll_no, division, year, branch, face_enrolled_at")
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1">All enrolled students and their attendance</p>
      </div>

      {!students || students.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No students yet</EmptyTitle>
                <EmptyDescription>Students will appear here once they sign up.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Roster ({students.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {students.map((s) => {
                const st = stats.get(s.id) ?? { total: 0, present: 0 }
                const pct = st.total > 0 ? Math.round((st.present / st.total) * 100) : 0
                const initials = (s.full_name || s.email).slice(0, 2).toUpperCase()
                return (
                  <div key={s.id} className="flex items-center gap-4 py-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.full_name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.roll_no ? `${s.roll_no} · ` : ""}
                        {s.branch ?? ""}
                        {s.division ? ` · Div ${s.division}` : ""}
                        {s.year ? ` · Year ${s.year}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.face_enrolled_at ? (
                        <Badge variant="outline" className="text-xs">
                          Face enrolled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No face
                        </Badge>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium tabular-nums">{pct}%</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {st.present}/{st.total}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
