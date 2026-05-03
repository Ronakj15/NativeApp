"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { PageLoader } from "@/components/page-loader"

export default function PostSignInPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/auth/login")
      return
    }
    if (profile) {
      if (profile.role === "faculty" || profile.role === "admin") {
        router.replace("/faculty")
      } else {
        router.replace("/student")
      }
    }
  }, [loading, user, profile, router])

  return <PageLoader message="Redirecting…" />
}
