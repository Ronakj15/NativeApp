"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { formatDateTime } from "@/lib/utils-format"
import { NotificationActions } from "@/components/notification-actions"
import { SwipeableNotification } from "@/components/swipeable-notification"
import { PushManager } from "@/components/push-manager"
import { Bell, AlertTriangle, Info, CheckCircle2 } from "lucide-react"
import { PageLoader } from "@/components/page-loader"

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
      setNotifications(data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Updates from your faculty and the system.</p>
        </div>
        <div className="flex items-center gap-2">
          <PushManager />
          <NotificationActions />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>{notifications.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length ? (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <SwipeableNotification key={n.id} notification={n}>
                  <NotifIcon type={n.type} read={n.read} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!n.read ? "" : "text-muted-foreground"}`}>{n.title}</p>
                      {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                </SwipeableNotification>
              ))}
            </ul>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No notifications</EmptyTitle>
                <EmptyDescription>You&apos;re all caught up.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NotifIcon({ type, read }: { type: string; read: boolean }) {
  const Icon = type === "warning" ? AlertTriangle : type === "success" ? CheckCircle2 : type === "alert" ? Bell : Info
  const bg =
    type === "warning"
      ? "bg-warning/15 text-warning"
      : type === "success"
        ? "bg-success/15 text-success"
        : type === "alert"
          ? "bg-destructive/15 text-destructive"
          : "bg-primary/10 text-primary"
  return (
    <div className={`size-9 rounded-lg grid place-items-center shrink-0 ${bg} ${read ? "opacity-60" : ""}`}>
      <Icon className="size-4" />
    </div>
  )
}
