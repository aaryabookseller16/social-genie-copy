export default function HomeBackground() {
  return (
    <div className="absolute inset-0 z-0">
      {/* Light */}
      <div className="absolute inset-0 block dark:hidden bg-white">
        <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.35),transparent_60%)]" />
        <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_50%_75%,rgba(0,0,0,0.06),transparent_55%)]" />
      </div>

      {/* Dark */}
      <div className="absolute inset-0 hidden dark:block bg-black">
        <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.35),transparent_60%)]" />
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_70%,rgba(239,68,68,0.20),transparent_60%)]" />
      </div>

      {/* Subtle grain (optional) */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:url('/noise.png')] [background-size:180px_180px]" />
    </div>
  );
}
