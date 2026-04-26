"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Attendance by course</CardTitle>
        </CardHeader>
        <CardContent>
          {courseStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No course data yet.</p>
          ) : (
            <ChartContainer
              config={{
                value: { label: "Attendance %", color: "var(--chart-1)" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily attendance trend</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No completed lectures yet.</p>
          ) : (
            <ChartContainer
              config={{
                pct: { label: "Attendance %", color: "var(--chart-2)" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="pct" stroke="var(--color-pct)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
