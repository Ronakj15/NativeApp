export function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-background"
    >
      {/* Paper / brutalism grid */}
      <div
        className="absolute inset-0 opacity-[0.08] dark:opacity-[0.16] animate-grid-drift text-foreground"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Drifting brutalist colour fields (lime / hot pink / cyan) */}
      <div className="absolute -top-1/4 -left-1/4 size-[60vmax] rounded-full opacity-50 blur-3xl animate-blob-a bg-[radial-gradient(circle_at_30%_30%,oklch(0.88_0.22_125/0.55),transparent_60%)]" />
      <div className="absolute -bottom-1/3 -right-1/4 size-[55vmax] rounded-full opacity-45 blur-3xl animate-blob-b bg-[radial-gradient(circle_at_60%_40%,oklch(0.78_0.22_340/0.45),transparent_60%)]" />
      <div className="absolute top-1/3 left-1/3 size-[40vmax] rounded-full opacity-35 blur-3xl animate-blob-c bg-[radial-gradient(circle_at_50%_50%,oklch(0.78_0.16_220/0.5),transparent_60%)]" />

      {/* Diagonal stripes corner accents (brutalist sticker) */}
      <div className="absolute top-6 right-6 size-24 rotate-12 opacity-25 stripes" />
      <div className="absolute bottom-6 left-6 size-20 -rotate-6 opacity-20 stripes" />

      {/* Subtle noise for paper feel */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-multiply dark:mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.65'/></svg>\")",
        }}
      />
    </div>
  )
}
