"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function NotificationActions() {
  const router = useRouter()
  const [pending, start] = useTransition()
  async function markAllRead() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false)
    if (error) {
      toast.error("Could not update notifications", { description: error.message })
      return
    }
    start(() => router.refresh())
  }
  return (
    <Button variant="secondary" onClick={markAllRead} disabled={pending}>
      <CheckCheck className="size-4" />
      Mark all read
    </Button>
  )
}
