"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { LecturesManager } from "@/components/lectures-manager"
import { CoursesManager } from "@/components/courses-manager"
import { PageLoader } from "@/components/page-loader"

export default function LecturesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<any[]>([])
  const [lectures, setLectures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data: c } = await supabase
        .from("courses")
        .select("*")
        .eq("faculty_id", user!.id)
        .order("created_at", { ascending: false })
      setCourses(c ?? [])

      const courseIds = (c ?? []).map((course) => course.id)
      if (courseIds.length) {
        const { data: l } = await supabase
          .from("lectures")
          .select("*, courses!inner(name, code)")
          .in("course_id", courseIds)
          .order("scheduled_start", { ascending: false })
          .limit(100)
        setLectures(l ?? [])
      }

      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Lectures</h1>
        <p className="text-muted-foreground">Manage your courses and lectures.</p>
      </div>

      <Tabs defaultValue="lectures">
        <TabsList>
          <TabsTrigger value="lectures">Lectures</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>
        <TabsContent value="lectures">
          <Card>
            <CardHeader>
              <CardTitle>All lectures</CardTitle>
              <CardDescription>Schedule, start, and review lectures.</CardDescription>
            </CardHeader>
            <CardContent>
              <LecturesManager lectures={lectures as any[]} courses={courses} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Add and manage the courses you teach.</CardDescription>
            </CardHeader>
            <CardContent>
              <CoursesManager courses={courses} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
