"use client"

import { useState } from "react"
import { Send, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { sendFacultyNotification, deleteBroadcast } from "@/app/actions/faculty-notify"
import { useRouter } from "next/navigation"
import { formatDate, formatTime } from "@/lib/utils-format"

const DEPARTMENTS = ["ALL", "CE", "CS", "IT", "ENTC", "MECH", "CIVIL", "EE"]
const YEARS = ["ALL", "1", "2", "3", "4"]
const DIVISIONS = ["ALL", "A", "B", "C", "D"]

const NOTIF_TYPES = [
  { value: "reminder",       label: "⏰ Reminder",        desc: "Deadline or event reminder" },
  { value: "news",           label: "📢 News",            desc: "General announcement" },
  { value: "lecture_change",  label: "🔄 Lecture Change",  desc: "Schedule or room change" },
  { value: "assignment",     label: "📝 Assignment",      desc: "New or updated assignment" },
  { value: "general",        label: "ℹ️ General",         desc: "Miscellaneous notice" },
]

export function FacultyNotificationComposer({ broadcasts = [] }: { broadcasts?: any[] }) {
  const router = useRouter()
  const [department, setDepartment] = useState("ALL")
  const [year, setYear] = useState("ALL")
  const [division, setDivision] = useState("ALL")
  const [notifType, setNotifType] = useState("general")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ count: number } | null>(null)

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this notification? It will be removed from all students' inboxes.")) return
    
    setDeletingId(id)
    const result = await deleteBroadcast(id)
    if (result.error) toast.error("Failed to delete", { description: result.error })
    else {
      toast.success("Notification deleted successfully")
      router.refresh()
    }
    setDeletingId(null)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error("Please enter a title"); return }
    if (!body.trim()) { toast.error("Please enter a message"); return }

    setSending(true)
    setLastResult(null)

    const result = await sendFacultyNotification({
      department,
      year,
      division,
      notifType,
      title: title.trim(),
      body: body.trim(),
    })

    if (result.error) {
      toast.error("Failed to send", { description: result.error })
    } else {
      toast.success(`Notification sent to ${result.count} student${result.count === 1 ? "" : "s"}!`)
      setLastResult({ count: result.count! })
      setTitle("")
      setBody("")
      router.refresh()
    }
    setSending(false)
  }

  const audienceLabel = [
    department === "ALL" ? "All Depts" : department,
    year === "ALL" ? "All Years" : `Year ${year}`,
    division === "ALL" ? "All Divs" : `Div ${division}`,
  ].join(" · ")

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Targeting Card */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Audience</CardTitle>
          <CardDescription>Choose who should receive this notification.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d === "ALL" ? "All Departments" : d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>{y === "ALL" ? "All Years" : `Year ${y}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Division</Label>
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d === "ALL" ? "All Divisions" : `Division ${d}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">Target audience</p>
            <p className="text-sm font-medium mt-0.5">{audienceLabel}</p>
          </div>
        </CardContent>
      </Card>

      {/* Compose Card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Compose Notification</CardTitle>
          <CardDescription>This will be sent as both an in-app notification and a push notification.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Notification Type</Label>
              <div className="flex flex-wrap gap-2">
                {NOTIF_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNotifType(t.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      notifType === t.value
                        ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {NOTIF_TYPES.find((t) => t.value === notifType)?.desc}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notif-title">Title</Label>
              <Input
                id="notif-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lab session rescheduled"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notif-body">Message</Label>
              <Textarea
                id="notif-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message to students here..."
                rows={4}
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={sending} className="gap-2">
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {sending ? "Sending..." : "Send Notification"}
              </Button>
              {lastResult && (
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="size-3.5 text-success" />
                  Sent to {lastResult.count} student{lastResult.count === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History Card */}
      <Card className="lg:col-span-3 mt-6">
        <CardHeader>
          <CardTitle>Sent Notifications</CardTitle>
          <CardDescription>Review the history of notifications you have sent to students.</CardDescription>
        </CardHeader>
        <CardContent>
          {broadcasts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
              <p>No notifications sent yet.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_2fr_1fr_auto] gap-4 p-4 font-medium text-sm text-muted-foreground border-b bg-secondary/40 hidden md:grid">
                <div>Type / Audience</div>
                <div>Title & Message</div>
                <div>Sent At</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y">
                {broadcasts.map(b => (
                  <div key={b.id} className="grid md:grid-cols-[1fr_2fr_1fr_auto] gap-4 p-4 items-center">
                    <div className="space-y-1">
                      <Badge variant="outline" className="font-normal">{NOTIF_TYPES.find(t => t.value === b.type)?.label || b.type}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {b.filters.department === "ALL" ? "All Depts" : b.filters.department} · {b.filters.year === "ALL" ? "All Yrs" : `Yr ${b.filters.year}`} · {b.filters.division === "ALL" ? "All Divs" : `Div ${b.filters.division}`}
                      </div>
                      <div className="text-xs font-medium text-primary bg-primary/10 inline-block px-1.5 py-0.5 rounded">
                        {b.audience_count} recipient{b.audience_count !== 1 && 's'}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{b.body}</div>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(b.created_at)}
                      <br />
                      {formatTime(b.created_at)}
                    </div>
                    <div className="flex justify-end mt-4 md:mt-0">
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="w-full md:w-auto text-xs"
                        onClick={() => handleDelete(b.id)}
                        disabled={deletingId === b.id}
                      >
                        {deletingId === b.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
