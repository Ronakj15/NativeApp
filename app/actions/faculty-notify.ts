import { createClient } from '@/lib/supabase/client'

type NotifyPayload = {
  department: string  // "ALL" or specific dept
  year: string        // "ALL" or "1","2","3","4"
  division: string    // "ALL" or "A","B","C","D"
  notifType: string   // "reminder" | "news" | "lecture_change" | "assignment" | "general"
  title: string
  body: string
}

const TYPE_LABELS: Record<string, string> = {
  reminder: "⏰ Reminder",
  news: "📢 News",
  lecture_change: "🔄 Lecture Change",
  assignment: "📝 Assignment",
  general: "ℹ️ General",
}

export async function sendFacultyNotification(payload: NotifyPayload) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Build student query using demographic filters
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')

  if (payload.department !== "ALL") query = query.eq('department', payload.department)
  if (payload.year !== "ALL") query = query.eq('year', Number(payload.year))
  if (payload.division !== "ALL") query = query.eq('division', payload.division)

  const { data: students, error: fetchError } = await query
  if (fetchError) return { error: fetchError.message }
  if (!students || students.length === 0) return { error: "No students match the selected filters." }

  const typeLabel = TYPE_LABELS[payload.notifType] ?? payload.notifType
  const fullTitle = `${typeLabel}: ${payload.title}`

  // 1. Create Broadcast Record
  const { data: broadcast, error: broadcastError } = await supabase.from('broadcasts').insert({
    faculty_id: user.id,
    title: fullTitle,
    body: payload.body,
    type: payload.notifType,
    filters: { department: payload.department, year: payload.year, division: payload.division },
    audience_count: students.length
  }).select('id').single()

  if (broadcastError) return { error: "Failed to create broadcast record." }

  // 2. Insert in-app notifications linked to broadcast
  const notifsToInsert = students.map(s => ({
    user_id: s.id,
    broadcast_id: broadcast.id,
    title: fullTitle,
    body: payload.body,
    type: payload.notifType === "reminder" || payload.notifType === "lecture_change" ? "warning" : "info",
  }))
  await supabase.from('notifications').insert(notifsToInsert)

  return { success: true, count: students.length }
}

export async function deleteBroadcast(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from('broadcasts').delete().eq('id', id).eq('faculty_id', user.id)
  if (error) return { error: error.message }
  return { success: true }
}
