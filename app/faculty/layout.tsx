"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { PageLoader } from "@/components/page-loader"

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace("/auth/login"); return }
    if (profile && profile.role !== "faculty" && profile.role !== "admin") { router.replace("/student"); return }
  }, [loading, user, profile, router])

  if (loading || !user || !profile) return <PageLoader />
  if (profile.role !== "faculty" && profile.role !== "admin") return <PageLoader message="Redirecting…" />

  return (
    <AppShell role="faculty" user={{ full_name: profile.full_name, email: profile.email, role: profile.role, avatar_url: profile.avatar_url }}>
      {children}
    </AppShell>
  )
}
