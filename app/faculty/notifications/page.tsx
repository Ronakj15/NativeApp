"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { FacultyNotificationComposer } from "@/components/faculty-notification-composer"
import { PageLoader } from "@/components/page-loader"

export default function FacultyNotificationsPage() {
  const { user } = useAuth()
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("faculty_id", user!.id)
        .order("created_at", { ascending: false })
      setBroadcasts(data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Send custom notifications to your students.</p>
      </div>

      <FacultyNotificationComposer broadcasts={broadcasts} />
    </div>
  )
}
