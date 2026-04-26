"use client"

import { useMemo, useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

type Course = { id: string; name: string; code: string; planned: number; present: number; total: number }

export function BunkCalculator({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "")
  const [target, setTarget] = useState<number>(75)

  const course = courses.find((c) => c.id === courseId)

  const result = useMemo(() => {
    if (!course) return null
    const { present, total, planned } = course
    const remaining = Math.max(0, planned - total)
    // Required presents in remaining lectures so that final ≥ target%
    const targetFraction = target / 100
    const requiredFromTotalPlanned = Math.ceil(targetFraction * planned)
    const mustAttend = Math.max(0, requiredFromTotalPlanned - present)
    const canMiss = Math.max(0, remaining - mustAttend)
    const currentPct = total ? Math.round((present / total) * 100) : 0
    const projectedIfAllRemainingAttended = planned ? Math.round(((present + remaining) / planned) * 100) : 0
    const isFeasible = mustAttend <= remaining
    return { remaining, mustAttend, canMiss, currentPct, projectedIfAllRemainingAttended, isFeasible }
  }, [course, target])

  if (!courses.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No courses yet</EmptyTitle>
          <EmptyDescription>You haven&apos;t been enrolled in any courses.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Target attendance</Label>
            <span className="text-sm tabular-nums">{target}%</span>
          </div>
          <Slider value={[target]} onValueChange={(v) => setTarget(v[0])} min={50} max={100} step={1} />
        </div>

        {course && (
          <div className="rounded-lg border border-border p-4 bg-secondary/30">
            <p className="text-sm font-medium">{course.name}</p>
            <p className="text-xs text-muted-foreground mb-3">
              {course.present} of {course.total} attended so far • {course.planned} planned total
            </p>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Current</span>
              <span className="tabular-nums">{result?.currentPct}%</span>
            </div>
            <Progress value={result?.currentPct ?? 0} className="h-2" />
          </div>
        )}
      </div>

      {course && result && (
        <div className="space-y-3">
          <ResultTile
            label="You can safely miss"
            value={`${result.canMiss}`}
            sub={`out of ${result.remaining} remaining lectures`}
            tone={result.isFeasible ? "success" : "destructive"}
          />
          <ResultTile
            label="You must attend at least"
            value={`${result.mustAttend}`}
            sub="of remaining lectures to hit your target"
            tone={result.isFeasible ? "default" : "destructive"}
          />
          <ResultTile
            label="If you attend everything"
            value={`${result.projectedIfAllRemainingAttended}%`}
            sub="projected end-of-term attendance"
            tone="default"
          />
          {!result.isFeasible && (
            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
              Your target isn&apos;t reachable anymore. Lower the target or talk to your faculty.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ResultTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: "default" | "success" | "destructive"
}) {
  const c = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${c}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}
