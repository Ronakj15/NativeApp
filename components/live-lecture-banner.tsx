"use client"

import Link from "next/link"
import { Radio } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LiveLectureBanner({
  lectures,
}: {
  lectures: { id: string; courses: { name: string; code: string }; room: string | null }[]
}) {
  return (
    <div className="rounded-xl border border-success/40 bg-success/5 p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
      <div className="size-10 rounded-lg bg-success text-success-foreground grid place-items-center shrink-0 relative">
        <span className="absolute inset-0 rounded-lg bg-success animate-ping opacity-40" />
        <Radio className="size-5 relative" />
      </div>
      <div className="flex-1">
        <p className="font-medium">
          {lectures.length === 1
            ? `${lectures[0].courses.name} is live`
            : `${lectures.length} lectures are live right now`}
        </p>
        <p className="text-sm text-muted-foreground">
          {lectures.length === 1
            ? `Beacon detected in ${lectures[0].room ?? "your area"}. Mark attendance now.`
            : "Multiple beacons detected. Open mark attendance to choose one."}
        </p>
      </div>
      <Button asChild>
        <Link href="/student/mark">Mark now</Link>
      </Button>
    </div>
  )
}
