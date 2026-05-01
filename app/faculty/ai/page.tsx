import { AiAssistant } from "@/components/ai-assistant"

export default function FacultyAiPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Scan timetables, auto-generate schedules, and chat with VISO AI.
        </p>
      </div>

      <AiAssistant />
    </div>
  )
}
