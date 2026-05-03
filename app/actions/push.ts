import { createClient } from '@/lib/supabase/client'

export async function notifyLectureStarted(courseId: string, courseCode: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Fetch the course targeting metadata
  const { data: course } = await supabase
    .from('courses')
    .select('department, year, division')
    .eq('id', courseId)
    .single()

  if (!course) return

  // Find all students matching this course's demographic who want lecture notifications
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .eq('notif_lectures', true)
  
  if (course.department) query = query.eq('department', course.department)
  if (course.year) query = query.eq('year', course.year)
  if (course.division) query = query.eq('division', course.division)

  const { data: targetStudents } = await query

  if (!targetStudents || targetStudents.length === 0) return

  const title = `Lecture Started: ${courseCode}`
  const body = `Your faculty has just started a live lecture for ${courseCode}. Mark your attendance now.`

  // Insert into in-app notifications table
  const notifsToInsert = targetStudents.map(s => ({
    user_id: s.id,
    title,
    body,
    type: 'alert'
  }))
  await supabase.from('notifications').insert(notifsToInsert)
}
