"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function PushManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      checkSubscription()
    }
  }, [])

  async function checkSubscription() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    setIsSubscribed(!!subscription)
  }

  // Helper to convert VAPID string to Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  async function subscribe() {
    try {
      setLoading(true)
      const registration = await navigator.serviceWorker.register('/sw.js')
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      
      if (!vapidPublicKey) {
         toast.error("VAPID Key missing. Please check .env.local")
         setLoading(false)
         return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      // Send to our backend
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, platform: 'web' })
      })

      setIsSubscribed(true)
      toast.success("Notifications enabled!")
    } catch (err: any) {
      toast.error("Failed to enable notifications", { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (!isSupported || isSubscribed) return null

  return (
    <Button variant="outline" size="sm" onClick={subscribe} disabled={loading} className="gap-2">
      <Bell className="size-4" />
      {loading ? "Enabling..." : "Enable Push Notifications"}
    </Button>
  )
}
