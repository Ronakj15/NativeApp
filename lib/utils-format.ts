export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

export function formatTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

export function formatDateTime(d: string | Date) {
  return `${formatDate(d)} • ${formatTime(d)}`
}

export function pct(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
