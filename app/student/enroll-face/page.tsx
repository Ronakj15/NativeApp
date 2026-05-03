"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ScanFace, ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FaceCheck, type FaceCheckResult } from "@/components/face-check"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function EnrollFacePage() {
  const router = useRouter()
  const [started, setStarted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enrolled, setEnrolled] = useState(false)

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("profiles").select("face_descriptor").eq("id", user.id).single()
      if (data?.face_descriptor) setEnrolled(true)
    })()
  }, [])

  async function handleSuccess(res: FaceCheckResult) {
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from("profiles")
      .update({
        face_descriptor: res.descriptor,
        face_enrolled_at: new Date().toISOString(),
      })
      .eq("id", user.id)
    if (error) {
      toast.error("Could not save face descriptor", { description: error.message })
      setSaving(false)
      return
    }
    toast.success("Face enrolled successfully")
    setSaving(false)
    setEnrolled(true)
    setStarted(false)
    router.push("/student")
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Enroll your face</h1>
        <p className="text-muted-foreground">
          One-time setup. After this, marking attendance is a quick face check.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <ScanFace className="size-5" />
            </div>
            <div>
              <CardTitle>Face enrollment</CardTitle>
              <CardDescription>
                {enrolled
                  ? "You're already enrolled. Re-enroll to update your face descriptor."
                  : "Follow the on-screen prompts."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!started ? (
            <div className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="size-4 mt-0.5 text-success" />
                  Models run entirely in your browser. No images leave your device.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="size-4 mt-0.5 text-success" />
                  We store a numeric descriptor only — never a photo.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="size-4 mt-0.5 text-success" />
                  You&apos;ll be asked to blink and smile to confirm liveness.
                </li>
              </ul>
              <Button onClick={() => setStarted(true)} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {enrolled ? "Re-enroll face" : "Start enrollment"}
              </Button>
            </div>
          ) : (
            <FaceCheck mode="enroll" onSuccess={handleSuccess} onCancel={() => setStarted(false)} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
