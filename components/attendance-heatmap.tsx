"use client"

import { useMemo } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Cell = { date: string; present: number; total: number; intensity: number }

export function AttendanceHeatmap({ cells }: { cells: Cell[] }) {
  // Group by ISO week (Mon-start). Build a 7-row grid with one column per week.
  const grid = useMemo(() => {
    const weeks: Cell[][] = []
    let currentWeek: (Cell | null)[] = new Array(7).fill(null)

    cells.forEach((cell, idx) => {
      const d = new Date(cell.date)
      const dow = (d.getDay() + 6) % 7 // 0 = Mon
      currentWeek[dow] = cell
      if (dow === 6 || idx === cells.length - 1) {
        weeks.push(currentWeek.map((c) => c ?? ({ date: "", present: 0, total: 0, intensity: -1 } as Cell)))
        currentWeek = new Array(7).fill(null)
      }
    })
    return weeks
  }, [cells])

  function colorClass(c: Cell) {
    if (c.intensity < 0) return "bg-muted"
    if (c.intensity >= 0.9) return "bg-success"
    if (c.intensity >= 0.75) return "bg-success/70"
    if (c.intensity >= 0.5) return "bg-warning/70"
    if (c.intensity > 0) return "bg-destructive/70"
    return "bg-destructive/40"
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px] min-w-max">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((c, di) =>
                c.date ? (
                  <Tooltip key={di}>
                    <TooltipTrigger asChild>
                      <div className={`size-3 rounded-[3px] ${colorClass(c)}`} />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{c.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.total ? `${c.present}/${c.total} attended` : "No lectures"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={di} className="size-3 rounded-[3px] bg-transparent" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <span className="size-3 rounded-[3px] bg-muted" />
        <span className="size-3 rounded-[3px] bg-destructive/40" />
        <span className="size-3 rounded-[3px] bg-warning/70" />
        <span className="size-3 rounded-[3px] bg-success/70" />
        <span className="size-3 rounded-[3px] bg-success" />
        <span>More</span>
      </div>
    </TooltipProvider>
  )
}
