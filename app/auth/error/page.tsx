import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="size-10 rounded-lg bg-destructive/10 text-destructive grid place-items-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <CardTitle>Authentication problem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t complete that sign-in. The link may be expired or invalid.
          </p>
          <Button asChild className="w-full">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
