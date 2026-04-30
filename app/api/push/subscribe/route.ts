import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { subscription, platform } = await req.json()
  if (!subscription || !platform) return new NextResponse('Bad Request', { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .insert({
      user_id: user.id,
      platform,
      token: subscription
    })

  // Duplicate key errors are fine, it means they are already subscribed on this device
  if (error && error.code !== '23505') { 
    console.error("Failed to insert sub:", error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  return NextResponse.json({ success: true })
}
