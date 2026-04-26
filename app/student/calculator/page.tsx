import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { BunkCalculator } from "@/components/bunk-calculator"

export default async function CalculatorPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("student_id", user.id)
  const courseIds = enrollments?.map((e) => e.course_id) ?? []

  const { data: courses } = courseIds.length
    ? await supabase.from("courses").select("*").in("id", courseIds)
    : { data: [] as any[] }

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status, lectures!inner(course_id)")
    .eq("student_id", user.id)

  const stats = (courses ?? []).map((c) => {
    const list = (attendance ?? []).filter((a: any) => a.lectures?.course_id === c.id)
    const present = list.filter((a) => a.status === "present" || a.status === "late").length
    const total = list.length
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      planned: c.total_lectures_planned ?? 60,
      present,
      total,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Bunk calculator</h1>
        <p className="text-muted-foreground">Plan absences without dropping below the 75% threshold.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How many lectures can I miss?</CardTitle>
          <CardDescription>Pick a course and target percentage.</CardDescription>
        </CardHeader>
        <CardContent>
          <BunkCalculator courses={stats} />
        </CardContent>
      </Card>
    </div>
  )
}
