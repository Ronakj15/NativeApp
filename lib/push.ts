import webpush from 'web-push'
import { Expo } from 'expo-server-sdk'
import { createClient } from '@/lib/supabase/server'

const expo = new Expo()

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:test@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function sendPushNotification(userId: string, title: string, body: string) {
  const supabase = await createClient()
  
  // 1. Get all push subscriptions and user preferences for this user
  const [{ data: subs }, { data: profile }] = await Promise.all([
    supabase.from('push_subscriptions').select('*').eq('user_id', userId),
    supabase.from('profiles').select('notif_sound').eq('id', userId).single()
  ])

  if (!subs || subs.length === 0) return

  const soundEnabled = profile?.notif_sound ?? true
  const expoMessages = []
  
  for (const sub of subs) {
    if (sub.platform === 'web') {
      try {
        const payload = JSON.stringify({ title, body, silent: !soundEnabled })
        // @ts-ignore
        await webpush.sendNotification(sub.token, payload)
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid, delete it
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        console.error('Web push error:', err)
      }
    } else if (sub.platform === 'expo') {
      const tokenString = sub.token as string
      if (!Expo.isExpoPushToken(tokenString)) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        continue
      }
      expoMessages.push({
        to: tokenString,
        sound: soundEnabled ? 'default' : null,
        title,
        body,
        data: { },
      })
    }
  }

  // 2. Send the Expo Push Notifications in chunks
  if (expoMessages.length > 0) {
    // @ts-ignore
    const chunks = expo.chunkPushNotifications(expoMessages)
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk)
      } catch (err) {
        console.error('Expo push error:', err)
      }
    }
  }
}
