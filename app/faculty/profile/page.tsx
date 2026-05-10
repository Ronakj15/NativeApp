"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { ProfileForm } from "@/components/profile-form"
import { NotificationPreferencesForm } from "@/components/notification-preferences-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageLoader } from "@/components/page-loader"

export default function FacultyProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    setProfile(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading || !profile) return <PageLoader />

  const initials = (profile?.full_name || user?.email || "U").slice(0, 2).toUpperCase()

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
              <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} role="faculty" onProfileUpdated={fetchData} />
        </CardContent>
      </Card>

      <NotificationPreferencesForm profile={profile} />
    </div>
  )
}

