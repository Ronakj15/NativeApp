export function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-background"
    >
      {/* Drifting liquid blobs */}
      <div className="absolute -top-1/4 -left-1/4 size-[60vmax] rounded-full opacity-60 blur-3xl animate-blob-a bg-[radial-gradient(circle_at_30%_30%,oklch(0.7_0.18_265/0.55),transparent_60%)]" />
      <div className="absolute -bottom-1/3 -right-1/4 size-[55vmax] rounded-full opacity-55 blur-3xl animate-blob-b bg-[radial-gradient(circle_at_60%_40%,oklch(0.78_0.16_200/0.5),transparent_60%)]" />
      <div className="absolute top-1/3 left-1/3 size-[40vmax] rounded-full opacity-40 blur-3xl animate-blob-c bg-[radial-gradient(circle_at_50%_50%,oklch(0.75_0.18_330/0.4),transparent_60%)]" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.07] dark:opacity-[0.12] animate-grid-drift"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_30%,oklch(0.16_0.02_260/0.45)_100%)] dark:bg-[radial-gradient(circle_at_50%_30%,transparent_30%,oklch(0.05_0.01_260/0.6)_100%)]" />

      {/* Subtle noise */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.65'/></svg>\")",
        }}
      />
    </div>
  )
}
