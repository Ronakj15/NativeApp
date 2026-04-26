"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Profile } from "@/lib/types"

export function ProfileForm({ profile, role }: { profile: Profile; role: "student" | "faculty" }) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.full_name ?? "")
  const [phone, setPhone] = useState(profile.phone ?? "")
  const [rollNo, setRollNo] = useState(profile.roll_no ?? "")
  const [division, setDivision] = useState(profile.division ?? "")
  const [year, setYear] = useState(profile.year?.toString() ?? "")
  const [branch, setBranch] = useState(profile.branch ?? "")
  const [facultyId, setFacultyId] = useState(profile.faculty_id ?? "")
  const [department, setDepartment] = useState(profile.department ?? "")
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const update: Partial<Profile> = {
      full_name: fullName,
      phone,
    }
    if (role === "student") {
      Object.assign(update, {
        roll_no: rollNo,
        division,
        year: year ? Number(year) : null,
        branch,
      })
    } else {
      Object.assign(update, {
        faculty_id: facultyId,
        department,
      })
    }
    const { error } = await supabase.from("profiles").update(update).eq("id", profile.id)
    if (error) {
      toast.error("Could not update profile", { description: error.message })
      setSaving(false)
      return
    }
    toast.success("Profile updated")
    setSaving(false)
    router.refresh()
  }

  return (
    <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile.email} disabled />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      {role === "student" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="rollNo">Roll number</Label>
            <Input id="rollNo" value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="division">Division</Label>
            <Input id="division" value={division} onChange={(e) => setDivision(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" min={1} max={5} value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch">Branch</Label>
            <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="facultyId">Faculty ID</Label>
            <Input id="facultyId" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </>
      )}

      <div className="md:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  )
}
