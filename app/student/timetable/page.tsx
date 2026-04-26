import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { DAYS } from "@/lib/utils-format"
import { CalendarDays } from "lucide-react"

export default async function TimetablePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("student_id", user.id)
  const courseIds = enrollments?.map((e) => e.course_id) ?? []

  const { data: slots } = courseIds.length
    ? await supabase
        .from("timetable_slots")
        .select("*, courses!inner(name, code, color)")
        .in("course_id", courseIds)
        .order("start_time", { ascending: true })
    : { data: [] as any[] }

  // Group by day_of_week (1..6 Mon-Sat)
  const byDay = new Map<number, any[]>()
  for (let d = 1; d <= 6; d++) byDay.set(d, [])
  for (const s of slots ?? []) {
    byDay.get(s.day_of_week)?.push(s)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Weekly timetable</h1>
        <p className="text-muted-foreground">Your recurring class schedule.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
          <CardDescription>Monday to Saturday</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from(byDay.entries()).map(([day, items]) => (
              <div key={day} className="rounded-lg border border-border bg-card p-3 min-h-40">
                <p className="text-sm font-medium mb-2">{DAYS[day]}</p>
                <div className="space-y-2">
                  {items.length ? (
                    items.map((s) => (
                      <div key={s.id} className="rounded-md bg-primary/5 border border-primary/20 p-2">
                        <p className="text-xs font-medium truncate">{s.courses?.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{s.room ?? "TBA"}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground flex items-center gap-2 py-3">
                      <CalendarDays className="size-4" />
                      No classes
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
