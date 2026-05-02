"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useTransition, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ScanFace,
  LayoutDashboard,
  CalendarDays,
  FileBarChart2,
  Bell,
  UserRound,
  LogOut,
  Menu,
  Presentation,
  Users,
  BarChart3,
  Send,
  Sun,
  Moon,
  X,
  Sparkles,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/student/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
  { href: "/student/profile", label: "Profile", icon: UserRound },
]

const FACULTY_NAV: NavItem[] = [
  { href: "/faculty", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faculty/lectures", label: "Lectures", icon: Presentation },
  { href: "/faculty/students", label: "Students", icon: Users },
  { href: "/faculty/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/faculty/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/faculty/notifications", label: "Notifications", icon: Send },
  { href: "/faculty/ai", label: "AI Assistant", icon: Sparkles },
  { href: "/faculty/profile", label: "Profile", icon: UserRound },
]

export function AppShell({
  role,
  user,
  children,
}: {
  role: "student" | "faculty"
  user: { full_name: string; email: string; role: string; avatar_url?: string | null }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [, startTransition] = useTransition()

  const nav = role === "faculty" ? FACULTY_NAV : STUDENT_NAV
  const initials = (user.full_name || user.email || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    startTransition(() => {
      router.push("/auth/login")
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <SidebarBody role={role} nav={nav} pathname={pathname} />
      </aside>

      {/* Sidebar — mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="relative w-72 bg-sidebar/95 backdrop-blur-xl border-r border-border flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-end p-2">
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <SidebarBody role={role} nav={nav} pathname={pathname} onNav={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center px-3 md:px-6 gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="size-4 hidden dark:block" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.full_name || user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <Avatar className="size-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 px-3 md:px-6 py-4 md:py-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}

function SidebarBody({
  role,
  nav,
  pathname,
  onNav,
}: {
  role: "student" | "faculty"
  nav: NavItem[]
  pathname: string
  onNav?: () => void
}) {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [draggedHref, setDraggedHref] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  return (
    <>
      <Link
        href={role === "faculty" ? "/faculty" : "/student"}
        className="flex items-center gap-2 font-semibold px-4 h-14 border-b border-border select-none"
      >
        <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
          <ScanFace className="size-4" />
        </div>
        <span>Viso</span>
      </Link>
      <nav
        ref={navRef}
        className="flex-1 p-3 flex flex-col gap-1 touch-none select-none relative"
        onPointerDown={(e) => {
          setIsDragging(true)
          e.currentTarget.setPointerCapture(e.pointerId)
          const navItem = (e.target as HTMLElement).closest("[data-nav-href]")
          if (navItem) {
            setDraggedHref(navItem.getAttribute("data-nav-href"))
          }
        }}
        onPointerMove={(e) => {
          if (!isDragging) return
          const el = document.elementFromPoint(e.clientX, e.clientY)
          const navItem = el?.closest("[data-nav-href]")
          if (navItem) {
            const href = navItem.getAttribute("data-nav-href")
            if (href && href !== draggedHref) setDraggedHref(href)
          }
        }}
        onPointerUp={(e) => {
          setIsDragging(false)
          e.currentTarget.releasePointerCapture(e.pointerId)
          if (draggedHref) {
            router.push(draggedHref)
            if (onNav) onNav()
            setDraggedHref(null)
          }
        }}
        onPointerCancel={(e) => {
          setIsDragging(false)
          e.currentTarget.releasePointerCapture(e.pointerId)
          setDraggedHref(null)
        }}
      >
        {(() => {
          const activeIndex = nav.findIndex((item) => {
            const isActivePath =
              pathname === item.href ||
              (item.href !== `/${role}` && pathname.startsWith(item.href + "/")) ||
              (item.href === `/${role}` && pathname === `/${role}`)
            return draggedHref ? item.href === draggedHref : isActivePath
          })

          return (
            <>
              {activeIndex !== -1 && (
                <motion.div
                  className="absolute left-3 right-3 rounded-md bg-primary shadow-md pointer-events-none"
                  initial={false}
                  animate={{
                    top: 12 + activeIndex * 44, // 12px padding + index * (40px height + 4px gap)
                    height: 40,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              {nav.map((item, i) => {
                const active = i === activeIndex
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-nav-href={item.href}
                    draggable={false}
                    onClick={(e) => {
                      if (isDragging) e.preventDefault()
                      else if (onNav) onNav()
                    }}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 h-10 text-sm transition-colors z-10",
                      active
                        ? "text-primary-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </>
          )
        })()}
      </nav>
      <div className="p-3 text-xs text-muted-foreground border-t border-border select-none">
        Privacy-first attendance, on-device face checks.
      </div>
    </>
  )
}
