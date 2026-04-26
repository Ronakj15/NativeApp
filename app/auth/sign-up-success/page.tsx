import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="size-10 rounded-lg bg-success/15 text-success grid place-items-center mb-2">
            <MailCheck className="size-5" />
          </div>
          <CardTitle>Check your inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            We&apos;ve sent a confirmation link to your email. Click it to activate your account, then come back and
            sign in.
          </p>
          <Button asChild className="w-full" variant="secondary">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
