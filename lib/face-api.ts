"use client"

// face-api.js loader. Models are served from a CDN to keep the repo light.
// We lazy-load both the library and the models on first use.

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models"

let loadingPromise: Promise<typeof import("face-api.js")> | null = null

export async function loadFaceApi() {
  if (typeof window === "undefined") {
    throw new Error("face-api can only be loaded in the browser")
  }
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    const faceapi = await import("face-api.js")
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ])
    return faceapi
  })()
  return loadingPromise
}

export function eyeAspectRatio(eye: { x: number; y: number }[]) {
  // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)
  const v1 = dist(eye[1], eye[5])
  const v2 = dist(eye[2], eye[4])
  const h = dist(eye[0], eye[3])
  return (v1 + v2) / (2 * h)
}

export function descriptorDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}
