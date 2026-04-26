import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatTime } from "@/lib/utils-format"
import { CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react"

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*, lectures!inner(scheduled_start, room, courses(name, code))")
    .eq("student_id", user.id)
    .order("marked_at", { ascending: false, nullsFirst: false })
    .limit(200)

  const total = attendance?.length ?? 0
  const present = attendance?.filter((a) => a.status === "present").length ?? 0
  const late = attendance?.filter((a) => a.status === "late").length ?? 0
  const absent = attendance?.filter((a) => a.status === "absent").length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Attendance history</h1>
        <p className="text-muted-foreground">All of your attendance records.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total" value={total} />
        <StatTile label="Present" value={present} tone="success" />
        <StatTile label="Late" value={late} tone="warning" />
        <StatTile label="Absent" value={absent} tone="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <CardDescription>Most recent first</CardDescription>
        </CardHeader>
        <CardContent>
          {attendance && attendance.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(a.lectures.scheduled_start)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{a.lectures.courses?.name}</span>
                          <span className="text-xs text-muted-foreground">{a.lectures.courses?.code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.lectures.room ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatTime(a.lectures.scheduled_start)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {a.method?.replace("_", " ") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No attendance records yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "success" | "warning" | "destructive"
}) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : ""
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
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
  if (status === "excused")
    return (
      <Badge variant="secondary">
        <MinusCircle className="size-3" />
        Excused
      </Badge>
    )
  return (
    <Badge variant="destructive">
      <XCircle className="size-3" />
      Absent
    </Badge>
  )
}
