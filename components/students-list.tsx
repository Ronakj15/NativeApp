"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, SlidersHorizontal, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Users } from "lucide-react"

type Student = {
  id: string
  full_name: string
  email: string
  roll_no: string | null
  division: string | null
  year: number | null
  department: string | null
  avatar_url: string | null
  face_enrolled_at: string | null
}

type StudentWithStats = Student & {
  total: number
  present: number
  pct: number
}

export function StudentsList({ students, stats }: {
  students: Student[]
  stats: Record<string, { total: number; present: number }>
}) {
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [divFilter, setDivFilter] = useState("all")

  // Hardcoded filter options matching the rest of the app
  const departments = ["CE", "CS", "IT", "ENTC", "MECH", "CIVIL", "EE"]
  const years = [1, 2, 3, 4]
  const divisions = ["A", "B", "C", "D"]

  // Build enriched list
  const enriched: StudentWithStats[] = students.map(s => {
    const st = stats[s.id] ?? { total: 0, present: 0 }
    return {
      ...s,
      ...st,
      pct: st.total > 0 ? Math.round((st.present / st.total) * 100) : 0,
    }
  })

  // Apply filters
  const filtered = enriched.filter(s => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.roll_no || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    const matchesDept = deptFilter === "all" || s.department === deptFilter
    const matchesYear = yearFilter === "all" || s.year?.toString() === yearFilter
    const matchesDiv = divFilter === "all" || s.division === divFilter
    return matchesSearch && matchesDept && matchesYear && matchesDiv
  })

  return (
    <>
      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, roll no, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={divFilter} onValueChange={setDivFilter}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Div" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divs</SelectItem>
                  {divisions.map(d => (
                    <SelectItem key={d} value={d}>Div {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="size-6" />
                </EmptyMedia>
                <EmptyTitle>{search || deptFilter !== "all" || yearFilter !== "all" || divFilter !== "all" ? "No matching students" : "No students yet"}</EmptyTitle>
                <EmptyDescription>
                  {search || deptFilter !== "all" || yearFilter !== "all" || divFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Students will appear here once they sign up."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Roster ({filtered.length}{filtered.length !== students.length ? ` of ${students.length}` : ""})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {filtered.map((s) => {
                const initials = (s.full_name || s.email).slice(0, 2).toUpperCase()
                return (
                  <Link
                    key={s.id}
                    href={`/faculty/students/${s.id}`}
                    className="flex items-center gap-4 py-3 hover:bg-muted/50 -mx-6 px-6 transition-colors cursor-pointer"
                  >
                    <Avatar className="size-10">
                      {s.avatar_url && <AvatarImage src={s.avatar_url} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.full_name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.roll_no ? `${s.roll_no} · ` : ""}
                        {s.department ?? ""}
                        {s.division ? ` · Div ${s.division}` : ""}
                        {s.year ? ` · Year ${s.year}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.face_enrolled_at ? (
                        <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                          Face enrolled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                          No face
                        </Badge>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium tabular-nums">{s.pct}%</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {s.present}/{s.total}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
