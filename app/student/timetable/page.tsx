"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { DAYS } from "@/lib/utils-format"
import { CalendarDays } from "lucide-react"
import { PageLoader } from "@/components/page-loader"

export default function TimetablePage() {
  const { user, profile } = useAuth()
  const [byDay, setByDay] = useState<Map<number, any[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile) return
    const supabase = createClient()

    async function fetchData() {
      let courseIds: string[] = []

      if (profile!.department && profile!.year && profile!.division) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id")
          .eq("department", profile!.department)
          .eq("year", profile!.year)
          .eq("division", profile!.division)
        courseIds = courses?.map(c => c.id) ?? []
      }

      const { data: slots } = courseIds.length
        ? await supabase
            .from("timetable_slots")
            .select("*, courses!inner(name, code, color), profiles(full_name)")
            .in("course_id", courseIds)
            .order("start_time", { ascending: false })
        : { data: [] as any[] }

      const map = new Map<number, any[]>()
      for (let d = 1; d <= 6; d++) map.set(d, [])
      for (const s of slots ?? []) {
        map.get(s.day_of_week)?.push(s)
      }
      setByDay(map)
      setLoading(false)
    }

    fetchData()
  }, [user, profile])

  if (loading) return <PageLoader />

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
                      <div key={s.id} className="rounded-md bg-primary/5 border border-primary/20 p-2 flex flex-col gap-0.5">
                        <p className="text-xs font-bold truncate">{s.courses?.name}</p>
                        {s.profiles?.full_name && (
                           <p className="text-[10px] font-medium opacity-75 truncate">{s.profiles.full_name}</p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                          <span>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                          <span>{s.room ?? "TBA"}</span>
                        </div>
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
