"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { ScanFace, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

type Role = "student" | "faculty"

function SignUpForm() {
  const router = useRouter()
  const params = useSearchParams()
  const initial = (params.get("role") as Role) || "student"
  const [role, setRole] = useState<Role>(initial)

  useEffect(() => {
    setRole(initial)
  }, [initial])

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  // student fields
  const [rollNo, setRollNo] = useState("")
  const [division, setDivision] = useState("A")
  const [year, setYear] = useState("1")
  // faculty fields
  const [facultyId, setFacultyId] = useState("")
  const [department, setDepartment] = useState("CS")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName,
          role,
          ...(role === "student"
            ? { roll_no: rollNo, division, year, department }
            : { faculty_id: facultyId }),
        },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push("/auth/sign-up-success")
  }

  return (
    <>
      <Tabs value={role} onValueChange={(v) => setRole(v as Role)} className="mb-4">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="faculty">Faculty</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {role === "student" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rollNo">Roll no.</Label>
              <Input id="rollNo" required value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="division">Division</Label>
              <Select value={division} onValueChange={setDivision}>
                <SelectTrigger id="division">
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
            <div className="grid gap-2">
              <Label htmlFor="year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="year">
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
              <Label htmlFor="department">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["CE", "CS", "IT", "ENTC", "MECH", "CIVIL", "EE"].map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="facultyId">Faculty ID</Label>
            <Input id="facultyId" required value={facultyId} onChange={(e) => setFacultyId(e.target.value)} />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Create account
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Already registered?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </>
  )
}

export default function SignUpPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-10 bg-background">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold mb-6">
          <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <ScanFace className="size-4" />
          </div>
          <span>Viso</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Choose your role to get the right experience.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
              <SignUpForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
