"use client"

import { useEffect, useRef, useState } from "react"
import {
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smile,
  Eye,
  RotateCcw,
  ScanLine,
  Cpu,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { loadFaceApi, eyeAspectRatio } from "@/lib/face-api"

type Action = "blink" | "smile" | "turn_left" | "turn_right"

type Step = {
  action: Action
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

const ALL_STEPS: Record<Action, Step> = {
  blink: { action: "blink", label: "Blink twice", hint: "Close and open both eyes deliberately, twice.", icon: Eye },
  smile: { action: "smile", label: "Smile", hint: "Show a clear smile for a moment.", icon: Smile },
  turn_left: { action: "turn_left", label: "Turn head left", hint: "Slowly turn your head to your left.", icon: RotateCcw },
  turn_right: { action: "turn_right", label: "Turn head right", hint: "Slowly turn your head to your right.", icon: RotateCcw },
}

function pickRandomActions(): Action[] {
  const all: Action[] = ["blink", "smile", "turn_left", "turn_right"]
  const set = new Set<Action>(["blink"])
  while (set.size < 3) {
    set.add(all[Math.floor(Math.random() * all.length)])
  }
  return Array.from(set).sort(() => Math.random() - 0.5)
}

export type FaceCheckResult = {
  descriptor: number[]
  durationMs: number
}

export function FaceCheck({
  mode,
  expectedDescriptor,
  onSuccess,
  onCancel,
}: {
  mode: "enroll" | "verify"
  expectedDescriptor?: number[] | null
  onSuccess: (result: FaceCheckResult) => void
  onCancel?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)

  const [actions] = useState<Action[]>(() => (mode === "enroll" ? ["blink", "smile"] : pickRandomActions()))
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<"loading" | "warmup" | "running" | "done" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState("Loading face models")
  const [faceDetected, setFaceDetected] = useState(false)

  const stateRef = useRef({
    blinks: 0,
    eyesClosed: false,
    smileCount: 0,
    minYaw: 0,
    maxYaw: 0,
    baselineYaw: 0,
    haveBaseline: false,
    descriptors: [] as number[][],
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setStatusText("Loading face models")
        const faceapi = await loadFaceApi()
        if (cancelled) return

        setStatusText("Requesting camera")
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        })
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve()
        })
        await video.play()

        if (cancelled) return
        setPhase("warmup")
        setStatusText("Calibrating sensors")
        const warmupStart = performance.now()
        startedAtRef.current = warmupStart

        const tick = async () => {
          if (cancelled) return
          const v = videoRef.current
          const overlay = overlayRef.current
          if (!v || !overlay) return
          const w = v.videoWidth
          const h = v.videoHeight
          if (overlay.width !== w) overlay.width = w
          if (overlay.height !== h) overlay.height = h
          const ctx = overlay.getContext("2d")
          ctx?.clearRect(0, 0, w, h)

          const detection = await faceapi
            .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceExpressions()
            .withFaceDescriptor()

          if (detection) {
            setFaceDetected(true)
            const box = detection.detection.box
            if (ctx) {
              drawTargetBracket(ctx, box.x, box.y, box.width, box.height)
              drawLandmarks(ctx, detection.landmarks.positions)
            }

            const landmarks = detection.landmarks
            const leftEye = landmarks.getLeftEye()
            const rightEye = landmarks.getRightEye()
            const earL = eyeAspectRatio(leftEye)
            const earR = eyeAspectRatio(rightEye)
            const ear = (earL + earR) / 2

            const nose = landmarks.getNose()[3]
            const faceCenterX = box.x + box.width / 2
            const yaw = (nose.x - faceCenterX) / box.width

            const s = stateRef.current
            if (!s.haveBaseline && performance.now() - warmupStart > 800) {
              s.baselineYaw = yaw
              s.minYaw = yaw
              s.maxYaw = yaw
              s.haveBaseline = true
              s.descriptors.push(Array.from(detection.descriptor))
              setPhase("running")
              setStatusText("")
            }

            if (phaseRef.current === "running") {
              s.minYaw = Math.min(s.minYaw, yaw)
              s.maxYaw = Math.max(s.maxYaw, yaw)
              if (s.descriptors.length < 5) s.descriptors.push(Array.from(detection.descriptor))

              const currentAction = actions[stepIndexRef.current]
              const expressions = detection.expressions

              if (currentAction === "blink") {
                const closed = ear < 0.28
                if (closed && !s.eyesClosed) {
                  s.eyesClosed = true
                } else if (!closed && s.eyesClosed) {
                  s.eyesClosed = false
                  s.blinks += 1
                  setProgress(Math.min(100, (s.blinks / 2) * 100))
                  if (s.blinks >= 2) advanceStep()
                }
              }

              if (currentAction === "smile") {
                if (expressions.happy > 0.5) {
                  s.smileCount += 1
                  setProgress(Math.min(100, (s.smileCount / 8) * 100))
                  if (s.smileCount >= 8) advanceStep()
                }
              }

              if (currentAction === "turn_left") {
                const delta = s.maxYaw - s.baselineYaw
                setProgress(Math.min(100, (delta / 0.15) * 100))
                if (delta > 0.15) advanceStep()
              }

              if (currentAction === "turn_right") {
                const delta = s.baselineYaw - s.minYaw
                setProgress(Math.min(100, (delta / 0.15) * 100))
                if (delta > 0.15) advanceStep()
              }
            }
          } else {
            setFaceDetected(false)
            if (phaseRef.current === "running") {
              setStatusText("Center your face in the frame")
            }
          }

          rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not access camera or models."
        setError(msg)
        setPhase("error")
      }
    })()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stepIndexRef = useRef(stepIndex)
  useEffect(() => {
    stepIndexRef.current = stepIndex
  }, [stepIndex])
  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  function advanceStep() {
    setProgress(0)
    setStepIndex((i) => {
      const next = i + 1
      const s = stateRef.current
      s.blinks = 0
      s.smileCount = 0
      s.minYaw = s.baselineYaw
      s.maxYaw = s.baselineYaw
      s.eyesClosed = false
      if (next >= actions.length) {
        finish()
      }
      return next
    })
  }

  function averageDescriptor(list: number[][]): number[] {
    if (!list.length) return []
    const len = list[0].length
    const out = new Array(len).fill(0)
    for (const d of list) {
      for (let i = 0; i < len; i++) out[i] += d[i]
    }
    for (let i = 0; i < len; i++) out[i] /= list.length
    return out
  }

  function finish() {
    if (phaseRef.current === "done") return
    setPhase("done")
    setStatusText("Identity confirmed")
    const avg = averageDescriptor(stateRef.current.descriptors)
    if (mode === "verify" && expectedDescriptor && expectedDescriptor.length === avg.length) {
      let sum = 0
      for (let i = 0; i < avg.length; i++) {
        const d = avg[i] - expectedDescriptor[i]
        sum += d * d
      }
      const distance = Math.sqrt(sum)
      if (distance > 0.55) {
        setError(`Face does not match enrolled face (distance ${distance.toFixed(2)})`)
        setPhase("error")
        return
      }
    }
    onSuccess({ descriptor: avg, durationMs: performance.now() - startedAtRef.current })
  }

  const currentStep = actions[stepIndex] ? ALL_STEPS[actions[stepIndex]] : null
  const Icon = currentStep?.icon

  return (
    <div className="flex flex-col gap-4">
      {/* HUD frame */}
      <div className="relative rounded-2xl brutal bg-foreground p-1">
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-foreground/95">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none" />

          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,oklch(0_0_0/0.4)_100%)]" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.7 0.18 265 / 0.4) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.18 265 / 0.4) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage:
                "radial-gradient(circle at center, black 30%, transparent 80%)",
            }}
          />

          {/* Corner brackets (HUD) */}
          <CornerBrackets active={faceDetected && phase === "running"} />

          {/* Vertical scan line */}
          {(phase === "warmup" || phase === "running") && (
            <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none overflow-hidden">
              <div className="absolute inset-x-0 h-12 animate-scan-line bg-gradient-to-b from-transparent via-primary/40 to-transparent shadow-[0_0_20px_oklch(0.7_0.18_265/0.6)]" />
            </div>
          )}

          {/* Top HUD strip */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-2 bg-background/70 backdrop-blur-md rounded-full px-2.5 py-1 border border-primary/30 shadow-[0_0_15px_oklch(0.7_0.18_265/0.3)]">
              <span className="size-1.5 rounded-full bg-primary animate-radar-pulse shadow-[0_0_8px_oklch(0.7_0.18_265)]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground">
                {mode === "enroll" ? "Enrollment" : "Auth"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-background/70 backdrop-blur-md rounded-full px-2.5 py-1 border border-border">
              <Cpu className="size-3 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground">
                {phase === "loading"
                  ? "Booting"
                  : phase === "warmup"
                    ? "Calibrating"
                    : phase === "running"
                      ? faceDetected
                        ? "Tracking"
                        : "Searching"
                      : phase === "done"
                        ? "Verified"
                        : "Error"}
              </span>
            </div>
          </div>

          {/* Step prompt */}
          {phase === "running" && currentStep && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 bg-background/80 backdrop-blur-md rounded-xl px-3 py-2 border border-primary/30 shadow-[0_0_20px_oklch(0.7_0.18_265/0.25)]">
              <div className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0 animate-float-y border border-primary/30">
                {Icon ? <Icon className="size-4" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentStep.label}</p>
                <p className="text-[11px] text-muted-foreground truncate font-mono uppercase tracking-wider">
                  {currentStep.hint}
                </p>
              </div>
              <ProgressArc value={progress} />
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="flex gap-1">
                  {actions.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-1.5 rounded-full transition-colors",
                        i < stepIndex
                          ? "bg-success"
                          : i === stepIndex
                            ? "bg-primary animate-radar-pulse"
                            : "bg-border",
                      )}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
                  {stepIndex + 1}/{actions.length}
                </span>
              </div>
            </div>
          )}

          {/* Loading / warmup overlay */}
          {(phase === "loading" || phase === "warmup") && (
            <div className="absolute inset-0 grid place-items-center bg-foreground/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 px-5 py-4 rounded-xl border border-primary/30 bg-background/80 shadow-[0_0_30px_oklch(0.7_0.18_265/0.3)]">
                <div className="relative">
                  <Loader2 className="size-7 animate-spin text-primary" />
                  <div className="absolute inset-0 size-7 rounded-full bg-primary/30 blur-md" />
                </div>
                <p className="text-sm font-mono uppercase tracking-[0.18em] text-foreground">{statusText}</p>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {phase === "done" && (
            <div className="absolute inset-0 grid place-items-center bg-success/25 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 bg-success rounded-2xl px-6 py-4 text-success-foreground border-2 border-success-foreground/30 shadow-[0_0_40px_oklch(0.65_0.16_160/0.7)]">
                <div className="relative">
                  <CheckCircle2 className="size-9" />
                  <Sparkles className="size-4 absolute -top-1 -right-1 animate-radar-pulse" />
                </div>
                <p className="text-sm font-semibold tracking-wide">Identity Verified</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {phase === "error" && (
            <div className="absolute inset-0 grid place-items-center bg-foreground/60 backdrop-blur-sm p-4">
              <div className="flex flex-col items-center gap-2 bg-destructive rounded-xl px-5 py-4 text-destructive-foreground text-center max-w-sm border border-destructive-foreground/20">
                <AlertCircle className="size-7" />
                <p className="text-sm font-semibold">Verification Failed</p>
                <p className="text-xs opacity-90 font-mono">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground font-mono uppercase tracking-wider">
          <ScanLine className="size-3.5 text-primary" />
          <span>{phase === "running" ? statusText || "Hold steady — follow the prompt" : statusText}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Camera className="size-3.5" />
            <span className="font-mono">on-device</span>
          </div>
          {onCancel && phase !== "done" && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CornerBrackets({ active }: { active: boolean }) {
  const color = active ? "border-success shadow-[0_0_18px_oklch(0.65_0.16_160/0.8)]" : "border-primary/70"
  const padding = "inset-6 md:inset-10"
  return (
    <div className={cn("absolute pointer-events-none transition-colors", padding)}>
      {/* TL */}
      <span className={cn("absolute top-0 left-0 size-6 border-t-2 border-l-2 rounded-tl-md", color)} />
      {/* TR */}
      <span className={cn("absolute top-0 right-0 size-6 border-t-2 border-r-2 rounded-tr-md", color)} />
      {/* BL */}
      <span className={cn("absolute bottom-0 left-0 size-6 border-b-2 border-l-2 rounded-bl-md", color)} />
      {/* BR */}
      <span className={cn("absolute bottom-0 right-0 size-6 border-b-2 border-r-2 rounded-br-md", color)} />
    </div>
  )
}

function ProgressArc({ value }: { value: number }) {
  const r = 14
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} stroke="oklch(0.7 0.18 265 / 0.18)" strokeWidth="3" fill="none" />
      <circle
        cx="18"
        cy="18"
        r={r}
        stroke="oklch(0.7 0.18 265)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 18 18)"
        style={{ filter: "drop-shadow(0 0 4px oklch(0.7 0.18 265 / 0.7))", transition: "stroke-dashoffset 200ms linear" }}
      />
      <text
        x="18"
        y="22"
        textAnchor="middle"
        fontSize="10"
        fontFamily="ui-monospace, monospace"
        fill="oklch(0.7 0.18 265)"
      >
        {Math.round(value)}
      </text>
    </svg>
  )
}

function drawTargetBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const len = Math.min(w, h) * 0.18
  ctx.save()
  ctx.strokeStyle = "oklch(0.65 0.16 160)"
  ctx.lineWidth = 3
  ctx.shadowColor = "oklch(0.65 0.16 160 / 0.7)"
  ctx.shadowBlur = 10
  // top-left
  ctx.beginPath()
  ctx.moveTo(x, y + len)
  ctx.lineTo(x, y)
  ctx.lineTo(x + len, y)
  ctx.stroke()
  // top-right
  ctx.beginPath()
  ctx.moveTo(x + w - len, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + len)
  ctx.stroke()
  // bottom-left
  ctx.beginPath()
  ctx.moveTo(x, y + h - len)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + len, y + h)
  ctx.stroke()
  // bottom-right
  ctx.beginPath()
  ctx.moveTo(x + w - len, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y + h - len)
  ctx.stroke()
  ctx.restore()
}

function drawLandmarks(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  ctx.save()
  ctx.fillStyle = "oklch(0.7 0.18 265 / 0.85)"
  ctx.shadowColor = "oklch(0.7 0.18 265 / 0.6)"
  ctx.shadowBlur = 4
  for (const p of points) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
