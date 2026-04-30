import Link from "next/link"
import { redirect } from "next/navigation"
import { Bluetooth, ScanFace, BarChart3, ShieldCheck, ArrowRight, GraduationCap, Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/post-signin")
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <ScanFace className="size-4" />
            </div>
            <span>Viso</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Beacon + Face verification, in seconds
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-balance max-w-3xl">
            Attendance that proves <span className="text-primary">presence</span>, not just a tap.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl text-pretty leading-relaxed">
            Bluetooth beacons confirm a student is physically in the classroom. Live face recognition with liveness
            detection confirms it&apos;s really them. Faculty get the analytics they actually need.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button asChild size="lg">
              <Link href="/auth/sign-up?role=student">
                <GraduationCap className="size-4" />
                I&apos;m a student
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/sign-up?role=faculty">
                <Presentation className="size-4" />
                I&apos;m faculty
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Bluetooth,
              title: "Proximity beacons",
              body: "Lectures broadcast a unique beacon. Students mark attendance only when their device is in range.",
            },
            {
              icon: ScanFace,
              title: "Face + liveness",
              body: "On-device face recognition with blink, head-turn and smile prompts to defeat spoofing attempts.",
            },
            {
              icon: BarChart3,
              title: "Faculty analytics",
              body: "Heatmaps, trends, at-risk students and one-click exports — built for actual teaching workflows.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-medium">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-card p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-success/15 text-success grid place-items-center">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h3 className="font-medium">Privacy-first by design</h3>
              <p className="text-sm text-muted-foreground">
                Face descriptors are computed on-device. We store presence, not photos.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href="/auth/login">Sign in to your account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row gap-2 justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Viso. All rights reserved.</span>
          <span>Built for schools, colleges and corporate training.</span>
        </div>
      </footer>
    </main>
  )
}
