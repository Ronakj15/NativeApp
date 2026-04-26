"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, CheckCircle2, AlertCircle, Smile, Eye, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
  // pick 3 in random order, always include blink
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
  const [statusText, setStatusText] = useState("Loading face models…")

  // Action state
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
        setStatusText("Loading face models…")
        const faceapi = await loadFaceApi()
        if (cancelled) return

        setStatusText("Requesting camera…")
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
        setStatusText("Hold still — calibrating…")
        // Warmup 1.5s to grab baseline yaw & a clean descriptor
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
            const box = detection.detection.box
            ctx?.strokeStyle && ((ctx as CanvasRenderingContext2D).strokeStyle = "#22c55e")
            ;(ctx as CanvasRenderingContext2D).lineWidth = 3
            ctx?.strokeRect(box.x, box.y, box.width, box.height)

            const landmarks = detection.landmarks
            const leftEye = landmarks.getLeftEye()
            const rightEye = landmarks.getRightEye()
            const earL = eyeAspectRatio(leftEye)
            const earR = eyeAspectRatio(rightEye)
            const ear = (earL + earR) / 2

            // Yaw approximation: nose x position vs face center x
            const nose = landmarks.getNose()[3] // tip
            const faceCenterX = box.x + box.width / 2
            const yaw = (nose.x - faceCenterX) / box.width // -0.5..0.5

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

              // Blink detection
              if (currentAction === "blink") {
                const closed = ear < 0.22
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
                if (expressions.happy > 0.7) {
                  s.smileCount += 1
                  setProgress(Math.min(100, (s.smileCount / 8) * 100))
                  if (s.smileCount >= 8) advanceStep()
                }
              }

              if (currentAction === "turn_left") {
                const delta = s.baselineYaw - s.minYaw
                setProgress(Math.min(100, (delta / 0.18) * 100))
                if (delta > 0.18) advanceStep()
              }

              if (currentAction === "turn_right") {
                const delta = s.maxYaw - s.baselineYaw
                setProgress(Math.min(100, (delta / 0.18) * 100))
                if (delta > 0.18) advanceStep()
              }
            }
          } else {
            setStatusText("Face not detected — center your face in the frame.")
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

  // Mirror state to refs to avoid stale closures
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
      // reset per-step counters
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
    setStatusText("Verified")
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
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-foreground/95">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none" />

        {(phase === "loading" || phase === "warmup") && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/40 text-background">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">{statusText}</p>
            </div>
          </div>
        )}

        {phase === "running" && currentStep && (
          <div className="absolute top-3 left-3 right-3 flex items-center gap-2 bg-background/90 backdrop-blur rounded-lg px-3 py-2 border border-border">
            {Icon ? <Icon className="size-4 text-primary" /> : null}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentStep.label}</p>
              <p className="text-xs text-muted-foreground truncate">{currentStep.hint}</p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {stepIndex + 1}/{actions.length}
            </span>
          </div>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 grid place-items-center bg-success/30 text-background">
            <div className="flex flex-col items-center gap-2 bg-success rounded-xl px-5 py-4">
              <CheckCircle2 className="size-8" />
              <p className="text-sm font-medium">Verified</p>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/60 text-background p-4">
            <div className="flex flex-col items-center gap-2 bg-destructive rounded-xl px-5 py-4 text-center max-w-sm">
              <AlertCircle className="size-6" />
              <p className="text-sm font-medium">Check failed</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}
      </div>

      {phase === "running" && <Progress value={progress} className="h-2" />}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Camera className="size-4" />
          <span>{phase === "running" ? statusText || "Follow the prompt above." : statusText}</span>
        </div>
        {onCancel && phase !== "done" && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
