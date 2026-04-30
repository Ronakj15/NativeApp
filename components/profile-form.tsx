"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
  const [department, setDepartment] = useState(profile.department ?? "")
  const [facultyId, setFacultyId] = useState(profile.faculty_id ?? "")
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "")
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${profile.id}-${Math.random()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) {
      toast.error("Failed to upload image", { description: uploadError.message })
      setUploadingAvatar(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    
    // Save to profile immediately
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id)
    
    if (updateError) {
      toast.error("Failed to save avatar", { description: updateError.message })
    } else {
      setAvatarUrl(data.publicUrl)
      toast.success("Avatar updated successfully")
      router.refresh()
    }
    
    setUploadingAvatar(false)
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true)
    const supabase = createClient()

    // Try to extract the filename from the URL to delete from storage
    try {
      if (avatarUrl) {
        const urlObj = new URL(avatarUrl)
        const pathParts = urlObj.pathname.split('/')
        const fileName = pathParts[pathParts.length - 1]
        if (fileName) {
          await supabase.storage.from('avatars').remove([fileName])
        }
      }
    } catch (err) {
      // Ignore URL parsing errors, just clear the db field
    }

    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
    
    if (error) {
      toast.error("Failed to remove avatar", { description: error.message })
    } else {
      setAvatarUrl("")
      toast.success("Avatar removed")
      router.refresh()
    }
    setUploadingAvatar(false)
  }

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
        department,
      })
    } else {
      Object.assign(update, {
        faculty_id: facultyId,
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
      <div className="md:col-span-2 flex items-center gap-6 mb-2">
        <div className="relative">
          {avatarUrl ? (
            <Dialog>
              <DialogTrigger asChild>
                <Avatar className="size-20 border cursor-pointer hover:opacity-80 transition-opacity">
                  <AvatarImage src={avatarUrl} className="object-cover" />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {fullName ? fullName.slice(0, 2).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              </DialogTrigger>
              <DialogContent showCloseButton={false} className="max-w-sm p-0 grid place-items-center bg-transparent border-none shadow-none overflow-hidden">
                <DialogHeader className="sr-only">
                  <DialogTitle>View Profile Photo</DialogTitle>
                  <DialogDescription>Full-size view of the profile photo.</DialogDescription>
                </DialogHeader>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="Profile photo" className="rounded-full size-64 md:size-80 object-cover border-4 border-background shadow-2xl" />
              </DialogContent>
            </Dialog>
          ) : (
            <Avatar className="size-20 border">
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {fullName ? fullName.slice(0, 2).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleAvatarUpload}
          />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-medium text-lg leading-none">Profile Photo</h3>
          <div className="flex items-center gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar && <Loader2 className="mr-2 size-4 animate-spin" />}
              {avatarUrl ? "Change avatar" : "Add avatar"}
            </Button>
            {avatarUrl && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:bg-destructive/10 hover:text-destructive" 
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

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
            <Label>Division</Label>
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger>
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {["A", "B", "C", "D"].map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4"].map((y) => (
                  <SelectItem key={y} value={y}>Year {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {["CE", "CS", "IT", "ENTC", "MECH", "CIVIL", "EE"].map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="facultyId">Faculty ID</Label>
          <Input id="facultyId" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} />
        </div>
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
