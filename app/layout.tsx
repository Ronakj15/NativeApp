import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { AnimatedBackground } from "@/components/animated-bg"
import { AuthProvider } from "@/components/auth-provider"
import { PermissionsGate } from "@/components/permissions-gate"
import "./globals.css"

export const metadata: Metadata = {
  title: "Viso — Smart Attendance",
  description: "Beacon-verified, face-recognized attendance for modern campuses.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e17" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..900&family=Geist+Mono:wght@300..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased min-h-screen" style={{ fontFamily: "'Geist', sans-serif" }}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <PermissionsGate>
              <AnimatedBackground />
              {children}
              <Toaster richColors closeButton />
            </PermissionsGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
