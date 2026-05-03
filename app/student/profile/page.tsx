"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScanFace, CheckCircle2, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { ProfileForm } from "@/components/profile-form"
import { NotificationPreferencesForm } from "@/components/notification-preferences-form"
import { formatDateTime } from "@/lib/utils-format"
import { PageLoader } from "@/components/page-loader"

export default function StudentProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single()
      setProfile(data)
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading || !profile) return <PageLoader />

  const enrolled = !!profile.face_descriptor

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>This appears on attendance reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} role="student" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-lg grid place-items-center ${enrolled ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
            >
              {enrolled ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
            </div>
            <div>
              <CardTitle>Face recognition</CardTitle>
              <CardDescription>
                {enrolled
                  ? `Enrolled ${profile.face_enrolled_at ? formatDateTime(profile.face_enrolled_at) : ""}`
                  : "Not enrolled yet"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant={enrolled ? "secondary" : "default"}>
            <Link href="/student/enroll-face">
              <ScanFace className="size-4" />
              {enrolled ? "Re-enroll face" : "Enroll face"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <NotificationPreferencesForm profile={profile} />
    </div>
  )
}
