import { FacultyNotificationComposer } from "@/components/faculty-notification-composer"
import { createClient } from "@/lib/supabase/server"

export default async function FacultyNotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let broadcasts: any[] = []
  if (user) {
    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('faculty_id', user.id)
      .order('created_at', { ascending: false })
      
    broadcasts = data || []
  }

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
