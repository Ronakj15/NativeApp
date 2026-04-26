"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Course } from "@/lib/types"

export function CoursesManager({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [division, setDivision] = useState("A")
  const [year, setYear] = useState("1")
  const [branch, setBranch] = useState("CS")
  const [planned, setPlanned] = useState("60")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function createCourse(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from("courses").insert({
      name,
      code,
      faculty_id: user.id,
      division,
      year: Number(year),
      branch,
      total_lectures_planned: Number(planned) || 60,
    })
    if (error) {
      toast.error("Could not create course", { description: error.message })
      setSaving(false)
      return
    }
    toast.success("Course created")
    setSaving(false)
    setOpen(false)
    setName("")
    setCode("")
    router.refresh()
  }

  async function deleteCourse(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from("courses").delete().eq("id", id)
    if (error) {
      toast.error("Could not delete course", { description: error.message })
    } else {
      toast.success("Course deleted")
      router.refresh()
    }
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a course</DialogTitle>
              <DialogDescription>Students enrolled in matching divisions can mark attendance.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createCourse} className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Course name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Operating Systems" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Course code</Label>
                <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS-301" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planned">Planned lectures</Label>
                <Input id="planned" type="number" min={1} value={planned} onChange={(e) => setPlanned(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4"].map((y) => (
                      <SelectItem key={y} value={y}>
                        Year {y}
                      </SelectItem>
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
                    {["A", "B", "C", "D"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Branch</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["CS", "IT", "ENTC", "MECH", "CIVIL", "EE"].map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Create course
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No courses yet</EmptyTitle>
            <EmptyDescription>Create your first course to start scheduling lectures.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New course
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Year/Div</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    Y{c.year ?? "—"} / {c.division ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.branch ?? "—"}</TableCell>
                  <TableCell>{c.total_lectures_planned}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCourse(c.id)}
                      disabled={deletingId === c.id}
                      aria-label={`Delete ${c.name}`}
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
