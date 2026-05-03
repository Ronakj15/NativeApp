// DEPRECATED: Push notifications are now handled via Capacitor native push plugin
// This file is retained for reference but is not imported anywhere
// OS-level push notifications will be implemented via:
// - @capacitor/push-notifications for native iOS/Android
// - In-app notifications via Supabase table queries (already working)

export async function sendPushNotification(_userId: string, _title: string, _body: string) {
  console.warn("sendPushNotification is deprecated. Use Capacitor push notifications instead.")
}
