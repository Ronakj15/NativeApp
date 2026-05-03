import { createClient } from "@/lib/supabase/client"
import { GoogleGenerativeAI } from "@google/generative-ai"

// ── Available models ──
const MODELS = {
  // Best for complex vision tasks (timetable parsing)
  vision: "gemini-2.5-pro",
  // Fast + smart for chat & analytics
  chat: "gemini-2.5-flash",
  // Pro for deep analysis
  analysis: "gemini-2.5-pro",
} as const

const SYSTEM_PROMPT = `You are an expert timetable parser for a college attendance management system.
You will receive an image of a college timetable (printed, handwritten, or digital screenshot).

Your job is to extract EVERY lecture/class entry from the timetable and return structured JSON.

For each entry extract:
- "day": The day of the week (e.g. "Monday", "Tuesday")
- "subject": The full subject/course name
- "code": The course code if visible (e.g. "CS-301"), otherwise generate a reasonable one from the subject name
- "startTime": Start time in 24hr "HH:MM" format
- "endTime": End time in 24hr "HH:MM" format  
- "room": Room/lab number if visible, otherwise null
- "year": The year/semester if visible (1-4), otherwise null
- "department": Department abbreviation if visible (CS, IT, CE, ENTC, MECH, CIVIL, EE), otherwise null
- "division": Division if visible (A, B, C, D), otherwise null

Return ONLY valid JSON in this exact format:
{
  "entries": [...],
  "metadata": {
    "year": <number or null>,
    "department": "<string or null>",
    "division": "<string or null>",
    "semester": "<string or null>"
  }
}

Rules:
- If a cell spans multiple time slots, calculate the correct end time
- If the timetable has break/lunch slots, skip them
- Merge duplicate subjects (same subject on different days should still be separate entries)
- If you can determine the year, department, or division from headers or context, include it in metadata
- Be thorough - do NOT miss any entries
- Return ONLY the JSON, no markdown fences, no explanation`

export type TimetableEntry = {
  day: string
  subject: string
  code: string
  startTime: string
  endTime: string
  room: string | null
  year: number | null
  department: string | null
  division: string | null
}

export type ParsedTimetable = {
  entries: TimetableEntry[]
  metadata: {
    year: number | null
    department: string | null
    division: string | null
    semester: string | null
  }
}

// ── Timetable Image Parser (Vision Pro) ──
export async function parseTimetableImage(base64Image: string, mimeType: string): Promise<{ data?: ParsedTimetable; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || (profile.role !== "faculty" && profile.role !== "admin")) {
    return { error: "Only faculty can use the AI assistant" }
  }

  // In client-side mode, we need to get the API key from an environment variable
  // For Capacitor/native, this should be provided via a secure config
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return { error: "AI service not configured. Please add NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file." }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODELS.vision })

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      },
    ])

    const responseText = result.response.text()
    const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned) as ParsedTimetable

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return { error: "AI could not extract any timetable entries from this image. Please try a clearer photo." }
    }

    return { data: parsed }
  } catch (err: any) {
    console.error("AI timetable parse error:", err)
    if (err.message?.includes("API key")) {
      return { error: "Invalid API key. Please check your NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY." }
    }
    if (err.message?.includes("429") || err.message?.includes("quota")) {
      return { error: "API rate limit reached. Please wait a minute and try again." }
    }
    return { error: `Failed to parse timetable: ${err.message}` }
  }
}

// ── Create Courses & Lectures from parsed data ──
export async function createCoursesAndLectures(
  entries: TimetableEntry[],
  metadata: ParsedTimetable["metadata"],
  weekStartDate: string,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const dayToOffset: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  }

  const uniqueCourses = new Map<string, TimetableEntry>()
  for (const e of entries) {
    if (!uniqueCourses.has(e.code)) uniqueCourses.set(e.code, e)
  }

  const courseIdMap = new Map<string, string>()
  for (const [code, entry] of uniqueCourses) {
    const dept = entry.department || metadata.department || null
    const yr = entry.year || metadata.year || null
    const div = entry.division || metadata.division || null

    const { data: existing } = await supabase.from("courses").select("id").eq("code", code).maybeSingle()

    if (existing) {
      courseIdMap.set(code, existing.id)
    } else {
      const { data: created, error } = await supabase.from("courses").insert({
        name: entry.subject,
        code,
        faculty_id: user.id,
        department: dept,
        year: yr,
        division: div,
        total_lectures_planned: 60,
      }).select("id").single()

      if (error) {
        console.error("Failed to create course", code, error.message)
        continue
      }
      courseIdMap.set(code, created.id)
    }
  }

  const monday = new Date(weekStartDate)
  let lecturesCreated = 0

  for (const entry of entries) {
    const courseId = courseIdMap.get(entry.code)
    if (!courseId) continue

    const dayOffset = dayToOffset[entry.day.toLowerCase()]
    if (dayOffset === undefined) continue

    const lectureDate = new Date(monday)
    lectureDate.setDate(monday.getDate() + dayOffset)

    const [startH, startM] = entry.startTime.split(":").map(Number)
    const [endH, endM] = entry.endTime.split(":").map(Number)

    const scheduledStart = new Date(lectureDate)
    scheduledStart.setHours(startH, startM, 0, 0)

    const scheduledEnd = new Date(lectureDate)
    scheduledEnd.setHours(endH, endM, 0, 0)

    const { error } = await supabase.from("lectures").insert({
      course_id: courseId,
      faculty_id: user.id,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      room: entry.room,
      topic: entry.subject,
      status: "scheduled",
    })

    if (!error) lecturesCreated++
  }

  return {
    success: true,
    coursesCreated: courseIdMap.size,
    lecturesCreated,
  }
}

// ── AI Chat (Flash — fast responses) ──
export async function aiChat(message: string): Promise<{ reply?: string; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return { error: "AI service not configured." }

  // Gather rich context
  const { data: courses } = await supabase.from("courses").select("id, name, code, year, division, department").eq("faculty_id", user.id)
  const { data: lectures } = await supabase.from("lectures").select("scheduled_start, scheduled_end, room, status, topic, courses!inner(name, code)").eq("faculty_id", user.id).order("scheduled_start", { ascending: false }).limit(30)
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

  // Get attendance stats per course
  const courseIds = (courses ?? []).map(c => c.id)
  let attendanceStats: any[] = []
  if (courseIds.length > 0) {
    const { data: att } = await supabase
      .from("attendance")
      .select("status, lecture_id, lectures!inner(course_id, faculty_id)")
      .eq("lectures.faculty_id", user.id)
    attendanceStats = (att ?? []).filter((a: any) => courseIds.includes(a.lectures?.course_id))
  }

  // Compute per-course stats
  const courseAttMap: Record<string, { present: number; late: number; absent: number; total: number }> = {}
  for (const a of attendanceStats) {
    const cid = (a as any).lectures?.course_id
    if (!cid) continue
    if (!courseAttMap[cid]) courseAttMap[cid] = { present: 0, late: 0, absent: 0, total: 0 }
    courseAttMap[cid].total++
    if (a.status === "present") courseAttMap[cid].present++
    else if (a.status === "late") courseAttMap[cid].late++
    else if (a.status === "absent") courseAttMap[cid].absent++
  }

  const now = new Date()
  const contextPrompt = `You are VISO AI, an intelligent assistant for the VISO Attendance Management System.
You help faculty manage their courses, lectures, and attendance with data-driven insights.

Current date/time: ${now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
Current faculty: ${profile?.full_name || "Professor"}

Their courses (${(courses ?? []).length} total):
${JSON.stringify(courses ?? [], null, 2)}

Attendance statistics per course:
${JSON.stringify(courseAttMap, null, 2)}

Recent lectures (last 30):
${JSON.stringify((lectures ?? []).map((l: any) => ({
  course: l.courses?.name,
  code: l.courses?.code,
  date: l.scheduled_start,
  room: l.room,
  status: l.status,
  topic: l.topic,
})), null, 2)}

Instructions:
- Be helpful, concise, and friendly. Use the faculty's name.
- Answer questions about their schedule, courses, attendance patterns, and statistics.
- Provide data-driven insights when discussing attendance (percentages, trends).
- If asked to do something you can't (like directly modify data), explain the steps in the app.
- When showing attendance stats, calculate percentages and highlight courses below 75%.
- Format responses with markdown for readability (bold, lists, etc).
- Keep responses under 300 words unless detailed analysis is requested.
- For schedule questions, reference actual dates and times from the data.

User message: ${message}`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODELS.chat })
    const result = await model.generateContent(contextPrompt)
    return { reply: result.response.text() }
  } catch (err: any) {
    console.error("AI chat error:", err)
    return { error: `AI error: ${err.message}` }
  }
}

// ── Deep Attendance Analytics (Pro — thorough analysis) ──
export async function aiAnalyze(courseId?: string): Promise<{ analysis?: string; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return { error: "AI service not configured." }

  // Get all faculty data
  const { data: courses } = await supabase.from("courses").select("id, name, code, year, division, department").eq("faculty_id", user.id)
  const targetCourses = courseId ? (courses ?? []).filter(c => c.id === courseId) : (courses ?? [])
  const ids = targetCourses.map(c => c.id)

  if (ids.length === 0) return { error: "No courses found." }

  const { data: lectures } = await supabase.from("lectures").select("id, course_id, scheduled_start, status, room, topic").in("course_id", ids).order("scheduled_start", { ascending: true })
  const lectureIds = (lectures ?? []).map(l => l.id)

  let attendance: any[] = []
  if (lectureIds.length > 0) {
    const { data } = await supabase.from("attendance").select("lecture_id, student_id, status, marked_at, method").in("lecture_id", lectureIds)
    attendance = data ?? []
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

  const prompt = `You are VISO AI Analytics Engine. Perform a deep analysis of the following attendance data for Professor ${profile?.full_name ?? "Faculty"}.

Courses: ${JSON.stringify(targetCourses, null, 2)}

Lectures (${(lectures ?? []).length} total):
${JSON.stringify(lectures ?? [], null, 2)}

Attendance records (${attendance.length} total):
${JSON.stringify(attendance, null, 2)}

Generate a comprehensive report covering:

1. **Overall Summary**: Total lectures, overall attendance rate, trend direction
2. **Per-Course Breakdown**: For each course — total lectures taken, avg attendance %, peak & lowest attendance days
3. **Time Patterns**: Which time slots have best/worst attendance
4. **Day-of-Week Analysis**: Attendance patterns by day (Mon-Sat)
5. **At-Risk Alerts**: Students or courses with attendance below 75%
6. **Verification Methods**: Breakdown of how attendance was marked (BLE, face, manual)
7. **Recommendations**: Actionable suggestions to improve engagement

Format with markdown: use headers, tables, bold stats, and emoji for visual clarity.
Be specific with numbers — don't say "some students", say "12 students (23%)".`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODELS.analysis })
    const result = await model.generateContent(prompt)
    return { analysis: result.response.text() }
  } catch (err: any) {
    console.error("AI analysis error:", err)
    return { error: `Analysis failed: ${err.message}` }
  }
}
