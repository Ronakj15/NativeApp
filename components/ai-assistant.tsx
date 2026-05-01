"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Upload, Loader2, Sparkles, Check, X, Calendar, BookOpen, Clock,
  MapPin, Send, Bot, User, Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { toast } from "sonner"
import {
  parseTimetableImage,
  createCoursesAndLectures,
  aiChat,
  aiAnalyze,
  type TimetableEntry,
  type ParsedTimetable,
} from "@/app/actions/ai-timetable"

type ChatMessage = { role: "user" | "ai"; content: string }

export function AiAssistant() {
  const router = useRouter()

  // Timetable Scanner State
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageData, setImageData] = useState<{ base64: string; mime: string } | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedTimetable | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [creating, setCreating] = useState(false)
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    return monday.toISOString().slice(0, 10)
  })
  const [showScanner, setShowScanner] = useState(true)

  // Analytics State
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ----- Timetable Scanner -----
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", { description: "Max file size is 10MB" })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      const base64 = result.split(",")[1]
      setImageData({ base64, mime: file.type })
      setParsed(null)
      setSelectedEntries(new Set())
    }
    reader.readAsDataURL(file)
  }, [])

  async function handleParse() {
    if (!imageData) return
    setParsing(true)

    const result = await parseTimetableImage(imageData.base64, imageData.mime)

    if (result.error) {
      toast.error("Parse failed", { description: result.error })
    } else if (result.data) {
      setParsed(result.data)
      setSelectedEntries(new Set(result.data.entries.map((_, i) => i)))
      toast.success(`Found ${result.data.entries.length} lecture entries!`)
    }
    setParsing(false)
  }

  function toggleEntry(idx: number) {
    setSelectedEntries(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleAll() {
    if (!parsed) return
    if (selectedEntries.size === parsed.entries.length) setSelectedEntries(new Set())
    else setSelectedEntries(new Set(parsed.entries.map((_, i) => i)))
  }

  async function handleCreate() {
    if (!parsed) return
    const entries = parsed.entries.filter((_, i) => selectedEntries.has(i))
    if (entries.length === 0) { toast.error("Select at least one entry"); return }

    setCreating(true)
    const result = await createCoursesAndLectures(entries, parsed.metadata, weekStart)

    if (result.error) {
      toast.error("Failed", { description: result.error })
    } else {
      toast.success("Schedule created!", {
        description: `${result.coursesCreated} courses, ${result.lecturesCreated} lectures`,
      })
      router.refresh()
    }
    setCreating(false)
  }

  function clearScanner() {
    setImagePreview(null)
    setImageData(null)
    setParsed(null)
    setSelectedEntries(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ----- Chat -----
  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault()
    const msg = chatInput.trim()
    if (!msg) return

    setChatMessages(prev => [...prev, { role: "user", content: msg }])
    setChatInput("")
    setChatLoading(true)

    const result = await aiChat(msg)

    if (result.error) {
      setChatMessages(prev => [...prev, { role: "ai", content: `❌ ${result.error}` }])
    } else {
      setChatMessages(prev => [...prev, { role: "ai", content: result.reply || "No response" }])
    }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  // ----- Analytics -----
  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalysisResult(null)
    const result = await aiAnalyze()
    if (result.error) {
      toast.error("Analysis failed", { description: result.error })
    } else {
      setAnalysisResult(result.analysis ?? null)
    }
    setAnalyzing(false)
  }

  // ----- Day grouping for parsed entries -----
  const groupedByDay = parsed
    ? parsed.entries.reduce((acc, e, i) => {
        const day = e.day
        if (!acc[day]) acc[day] = []
        acc[day].push({ ...e, _idx: i })
        return acc
      }, {} as Record<string, (TimetableEntry & { _idx: number })[]>)
    : {}

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const sortedDays = Object.keys(groupedByDay).sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Timetable Scanner */}
      <div className="lg:col-span-2 space-y-6">
        {/* Upload Card */}
        <Card className="overflow-hidden">
          <CardHeader className="cursor-pointer" onClick={() => setShowScanner(!showScanner)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white grid place-items-center">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <CardTitle>AI Timetable Scanner</CardTitle>
                  <CardDescription>Upload a photo of your timetable to auto-generate courses & lectures</CardDescription>
                </div>
              </div>
              {showScanner ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
            </div>
          </CardHeader>

          {showScanner && (
            <CardContent className="space-y-4">
              {/* Upload zone */}
              {!imagePreview ? (
                <label
                  htmlFor="timetable-upload"
                  className="flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl
                           cursor-pointer transition-all
                           hover:border-primary/60 hover:bg-primary/5
                           border-border bg-secondary/20"
                >
                  <div className="size-14 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <Upload className="size-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Drop your timetable image here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supports JPG, PNG, WebP • Max 10MB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="timetable-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border bg-secondary/30">
                    <img
                      src={imagePreview}
                      alt="Uploaded timetable"
                      className="w-full max-h-[400px] object-contain"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 size-8"
                      onClick={clearScanner}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleParse}
                      disabled={parsing}
                      className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                    >
                      {parsing ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Analyzing with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          Extract Timetable
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Parsed Results */}
        {parsed && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="size-5 text-green-500" />
                    Extracted {parsed.entries.length} Entries
                  </CardTitle>
                  <CardDescription>
                    Review and select entries to import. Existing courses will be skipped.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {parsed.metadata.department && (
                    <Badge variant="secondary">{parsed.metadata.department}</Badge>
                  )}
                  {parsed.metadata.year && (
                    <Badge variant="secondary">Year {parsed.metadata.year}</Badge>
                  )}
                  {parsed.metadata.division && (
                    <Badge variant="secondary">Div {parsed.metadata.division}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Week selector + controls */}
              <div className="flex items-end gap-3 flex-wrap p-3 rounded-lg bg-secondary/30 border">
                <div className="grid gap-1.5">
                  <Label htmlFor="week-start" className="text-xs">
                    Schedule for week starting
                  </Label>
                  <Input
                    id="week-start"
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-44"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedEntries.size === parsed.entries.length ? "Deselect all" : "Select all"}
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedEntries.size} of {parsed.entries.length} selected
                </div>
              </div>

              {/* Day-grouped entries */}
              <div className="space-y-4">
                {sortedDays.map(day => (
                  <div key={day}>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Calendar className="size-4 text-primary" />
                      {day}
                    </h4>
                    <div className="grid gap-2">
                      {groupedByDay[day].map(entry => {
                        const selected = selectedEntries.has(entry._idx)
                        return (
                          <button
                            key={entry._idx}
                            type="button"
                            onClick={() => toggleEntry(entry._idx)}
                            className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                              selected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border bg-secondary/20 opacity-60 hover:opacity-80"
                            }`}
                          >
                            <div className={`mt-0.5 size-5 rounded-md border-2 grid place-items-center shrink-0 transition-colors ${
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                            }`}>
                              {selected && <Check className="size-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{entry.subject}</span>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {entry.code}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {entry.startTime} – {entry.endTime}
                                </span>
                                {entry.room && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="size-3" />
                                    {entry.room}
                                  </span>
                                )}
                                {(entry.department || entry.year) && (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="size-3" />
                                    {[entry.department, entry.year && `Y${entry.year}`, entry.division && `Div ${entry.division}`]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Import button */}
              <div className="sticky bottom-0 pt-3 bg-card">
                <Button
                  size="lg"
                  className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  onClick={handleCreate}
                  disabled={creating || selectedEntries.size === 0}
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating courses & lectures...
                    </>
                  ) : (
                    <>
                      <BookOpen className="size-4" />
                      Import {selectedEntries.size} Lecture{selectedEntries.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: AI Chat */}
      <div className="lg:col-span-1">
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white grid place-items-center">
                <Bot className="size-5" />
              </div>
              <div>
                <CardTitle>VISO AI Chat</CardTitle>
                <CardDescription>Ask me anything about your schedule</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 py-10">
                <div className="size-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                  <Sparkles className="size-7" />
                </div>
                <div>
                  <p className="font-medium text-foreground">How can I help?</p>
                  <p className="text-sm mt-1">
                    Ask about your schedule, courses, or attendance stats.
                  </p>
                </div>
                <div className="grid gap-2 w-full max-w-xs mt-2">
                  {[
                    "Show my schedule summary",
                    "Which course has lowest attendance?",
                    "How many lectures did I take this week?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setChatInput(q)
                      }}
                      className="text-sm text-left px-3 py-2 rounded-lg border border-border hover:bg-secondary/60 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "ai" && (
                  <div className="size-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white grid place-items-center shrink-0 mt-0.5">
                    <Bot className="size-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 border"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="size-7 rounded-lg bg-primary/20 text-primary grid place-items-center shrink-0 mt-0.5">
                    <User className="size-3.5" />
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-2 items-start">
                <div className="size-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white grid place-items-center shrink-0">
                  <Bot className="size-3.5" />
                </div>
                <div className="bg-secondary/60 border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </CardContent>

          <div className="p-4 border-t shrink-0">
            <form onSubmit={handleChatSend} className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask VISO AI anything..."
                disabled={chatLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}>
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
      </div>

      {/* Analytics Card — full width below */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white grid place-items-center">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <CardTitle>Deep Analytics</CardTitle>
                <CardDescription>AI-powered attendance report using Gemini Pro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!analysisResult ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a comprehensive report with per-course breakdowns, time patterns, at-risk alerts, and recommendations.
                </p>
                <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
                  {analyzing ? (
                    <><Loader2 className="size-4 animate-spin" />Analyzing with Gemini Pro...</>
                  ) : (
                    <><BarChart3 className="size-4" />Generate Report</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {analysisResult}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing} className="gap-1.5">
                    {analyzing ? <Loader2 className="size-3 animate-spin" /> : <BarChart3 className="size-3" />}
                    Regenerate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAnalysisResult(null)}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
