"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, CheckCircle2, XCircle, Clock, MinusCircle, Loader2, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { AttendanceStatus } from "@/lib/types"
import { formatTime } from "@/lib/utils-format"

type RosterRow = {
  student: { id: string; full_name: string; email: string; roll_no: string | null; division: string | null }
  record: {
    id: string
    status: AttendanceStatus
    method: string | null
    marked_at: string | null
  } | null
}

export function LiveLectureRoster({
  lectureId,
  status,
  initialRoster,
}: {
  lectureId: string
  status: string
  initialRoster: RosterRow[]
}) {
  const [roster, setRoster] = useState<RosterRow[]>(initialRoster)
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const summary = useMemo(() => {
    const stats = {
      total: roster.length,
      present: 0,
      late: 0,
      absent: 0,
      unmarked: 0,
    }

    for (const r of roster) {
      if (!r.record) {
        stats.unmarked++
      } else {
        const status = r.record.status
        if (status === "present") stats.present++
        else if (status === "late") stats.late++
        else if (status === "absent") stats.absent++
      }
    }

    return stats
  }, [roster])

  // Realtime subscription for live updates
  useEffect(() => {
    if (status !== "live") return
    const supabase = createClient()
    const channel = supabase
      .channel(`attendance:${lectureId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `lecture_id=eq.${lectureId}` },
        async () => {
          // refetch attendance for this lecture
          const { data: attendance } = await supabase.from("attendance").select("*").eq("lecture_id", lectureId)
          if (!attendance) return
          const map = new Map(attendance.map((a) => [a.student_id, a]))
          setRoster((prev) =>
            prev.map((r) => ({
              ...r,
              record: (map.get(r.student.id) as any) ?? null,
            })),
          )
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [lectureId, status])

  async function setStatus(studentId: string, newStatus: AttendanceStatus) {
    setBusyId(studentId)
    const supabase = createClient()
    const { error } = await supabase.from("attendance").upsert(
      {
        lecture_id: lectureId,
        student_id: studentId,
        status: newStatus,
        method: "manual" as const,
        marked_at: newStatus === "absent" ? null : new Date().toISOString(),
      },
      { onConflict: "lecture_id,student_id" },
    )
    if (error) {
      toast.error("Could not update", { description: error.message })
    } else {
      setRoster((prev) =>
        prev.map((r) =>
          r.student.id === studentId
            ? {
                ...r,
                record: {
                  id: r.record?.id ?? "temp",
                  status: newStatus,
                  method: "manual",
                  marked_at: newStatus === "absent" ? null : new Date().toISOString(),
                },
              }
            : r,
        ),
      )
    }
    setBusyId(null)
  }

  function exportCsv() {
    const rows = [
      ["Roll", "Name", "Email", "Status", "Method", "Marked at"],
      ...roster.map((r) => [
        r.student.roll_no ?? "",
        r.student.full_name,
        r.student.email,
        r.record?.status ?? "unmarked",
        r.record?.method ?? "",
        r.record?.marked_at ?? "",
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${lectureId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = roster.filter((r) => {
    const q = query.toLowerCase()
    if (!q) return true
    return (
      r.student.full_name.toLowerCase().includes(q) ||
      r.student.email.toLowerCase().includes(q) ||
      (r.student.roll_no ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Tile label="Total" value={summary.total} />
        <Tile label="Present" value={summary.present} tone="success" />
        <Tile label="Late" value={summary.late} tone="warning" />
        <Tile label="Absent" value={summary.absent} tone="destructive" />
        <Tile label="Unmarked" value={summary.unmarked} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll no, email"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Marked</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.student.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(r.student.full_name || r.student.email)
                          .split(" ")
                          .map((s) => s[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium leading-tight">{r.student.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.student.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.student.roll_no ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize">
                  {r.record?.method?.replace("_", " ") ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {r.record?.marked_at ? formatTime(r.record.marked_at) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" disabled={busyId === r.student.id}>
                        {busyId === r.student.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <StatusBadge status={r.record?.status ?? null} />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStatus(r.student.id, "present")}>
                        <CheckCircle2 className="size-4 text-success" />
                        Mark present
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(r.student.id, "late")}>
                        <Clock className="size-4 text-warning" />
                        Mark late
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(r.student.id, "absent")}>
                        <XCircle className="size-4 text-destructive" />
                        Mark absent
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(r.student.id, "excused")}>
                        <MinusCircle className="size-4" />
                        Mark excused
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {roster.length === 0 ? "No students enrolled in this course yet." : "No matches."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "success" | "warning" | "destructive"
}) {
  const c =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : ""
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${c}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (status === "present")
    return (
      <Badge className="bg-success/15 text-success hover:bg-success/15">
        <CheckCircle2 className="size-3" />
        Present
      </Badge>
    )
  if (status === "late")
    return (
      <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20">
        <Clock className="size-3" />
        Late
      </Badge>
    )
  if (status === "absent")
    return (
      <Badge variant="destructive">
        <XCircle className="size-3" />
        Absent
      </Badge>
    )
  if (status === "excused")
    return (
      <Badge variant="secondary">
        <MinusCircle className="size-3" />
        Excused
      </Badge>
    )
  return <Badge variant="outline">Unmarked</Badge>
}
