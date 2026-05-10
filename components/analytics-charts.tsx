"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

type CourseStat = { name: string; value: number; total: number; present: number }
type DailyPoint = { day: string; pct: number }

export function AnalyticsCharts({
  courseStats,
  dailyTrend,
}: {
  courseStats: CourseStat[]
  dailyTrend: DailyPoint[]
}) {
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Attendance by course</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {courseStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No course data yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <ChartContainer
                config={{
                  value: { label: "Attendance %", color: "var(--chart-1)" },
                }}
                className="h-[250px] sm:h-[300px] w-full"
                style={{ minWidth: Math.max(300, courseStats.length * 60) }}
              >
                <BarChart data={courseStats} margin={{ top: 5, right: 10, left: -15, bottom: 5 }} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} domain={[0, 100]} width={35} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Daily attendance trend</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {dailyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No completed lectures yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <ChartContainer
                config={{
                  pct: { label: "Attendance %", color: "var(--chart-2)" },
                }}
                className="h-[250px] sm:h-[300px] w-full"
                style={{ minWidth: Math.max(300, dailyTrend.length * 40) }}
              >
                <LineChart data={dailyTrend} margin={{ top: 5, right: 10, left: -15, bottom: 5 }} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} domain={[0, 100]} width={35} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="pct" stroke="var(--color-pct)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
