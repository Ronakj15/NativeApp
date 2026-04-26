"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useTransition } from "react"
import {
  ScanFace,
  LayoutDashboard,
  Bluetooth,
  History,
  CalendarDays,
  Calculator,
  Bell,
  UserRound,
  LogOut,
  Menu,
  Presentation,
  Users,
  BarChart3,
  Sun,
  Moon,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/mark", label: "Mark attendance", icon: Bluetooth },
  { href: "/student/history", label: "History", icon: History },
  { href: "/student/heatmap", label: "Heatmap", icon: CalendarDays },
  { href: "/student/calculator", label: "Bunk calculator", icon: Calculator },
  { href: "/student/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
  { href: "/student/profile", label: "Profile", icon: UserRound },
]

const FACULTY_NAV: NavItem[] = [
  { href: "/faculty", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faculty/lectures", label: "Lectures", icon: Presentation },
  { href: "/faculty/students", label: "Students", icon: Users },
  { href: "/faculty/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/faculty/profile", label: "Profile", icon: UserRound },
]

export function AppShell({
  role,
  user,
  children,
}: {
  role: "student" | "faculty"
  user: { full_name: string; email: string; role: string }
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
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 bg-sidebar border-r border-border flex flex-col">
            <div className="flex items-center justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <SidebarBody role={role} nav={nav} pathname={pathname} onNav={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

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
  return (
    <>
      <Link
        href={role === "faculty" ? "/faculty" : "/student"}
        className="flex items-center gap-2 font-semibold px-4 h-14 border-b border-border"
      >
        <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
          <ScanFace className="size-4" />
        </div>
        <span>Presence</span>
      </Link>
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href + "/")) ||
            (item.href === `/${role}` && pathname === `/${role}`)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 text-xs text-muted-foreground border-t border-border">
        Privacy-first attendance, on-device face checks.
      </div>
    </>
  )
}
