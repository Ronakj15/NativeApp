import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function PostSignInPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

  if (profile?.role === "faculty" || profile?.role === "admin") {
    redirect("/faculty")
  }
  redirect("/student")
}
