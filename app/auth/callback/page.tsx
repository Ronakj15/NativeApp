"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Suspense } from "react"
import { PageLoader } from "@/components/page-loader"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/post-signin"

    if (code) {
      const supabase = createClient()
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          router.replace(next)
        } else {
          router.replace("/auth/error")
        }
      })
    } else {
      router.replace("/auth/error")
    }
  }, [searchParams, router])

  return <PageLoader message="Completing sign in…" />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<PageLoader message="Completing sign in…" />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
