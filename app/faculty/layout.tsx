import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { createClient } from "@/lib/supabase/server"

export default async function FacultyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) redirect("/auth/login")
  if (profile.role !== "faculty" && profile.role !== "admin") redirect("/student")

  return (
    <AppShell role="faculty" user={{ full_name: profile.full_name, email: profile.email, role: profile.role, avatar_url: profile.avatar_url }}>
      {children}
    </AppShell>
  )
}
