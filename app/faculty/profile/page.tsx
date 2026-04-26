import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/profile-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default async function FacultyProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (!profile || profile.role === "student") redirect("/student")

  const initials = (profile?.full_name || user.email || "U").slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Your faculty information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{profile?.full_name || "Faculty"}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} role="faculty" />
        </CardContent>
      </Card>
    </div>
  )
}
