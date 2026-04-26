import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/server"
import { LecturesManager } from "@/components/lectures-manager"
import { CoursesManager } from "@/components/courses-manager"

export default async function LecturesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("faculty_id", user.id)
    .order("created_at", { ascending: false })

  const courseIds = (courses ?? []).map((c) => c.id)
  const { data: lectures } = courseIds.length
    ? await supabase
        .from("lectures")
        .select("*, courses!inner(name, code)")
        .in("course_id", courseIds)
        .order("scheduled_start", { ascending: false })
        .limit(100)
    : { data: [] as any[] }

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
              <LecturesManager lectures={(lectures as any[]) ?? []} courses={courses ?? []} />
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
              <CoursesManager courses={courses ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
