import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "@/lib/utils-format"
import { NotificationActions } from "@/components/notification-actions"
import { Bell, AlertTriangle, Info, CheckCircle2 } from "lucide-react"

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Updates from your faculty and the system.</p>
        </div>
        <NotificationActions />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>{notifications?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications && notifications.length ? (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id} className="py-3 flex items-start gap-3">
                  <NotifIcon type={n.type} read={n.read} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!n.read ? "" : "text-muted-foreground"}`}>{n.title}</p>
                      {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                </li>
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
