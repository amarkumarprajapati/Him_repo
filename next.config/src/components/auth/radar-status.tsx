"use client";

const services = [
  { name: "API Server", status: "Online" },
  { name: "Database", status: "Online" },
  { name: "Telemetry Collector", status: "Online" },
] as const;

export function RadarStatus() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-2 xl:gap-8">
      <div className="relative -mt-10 xl:-mt-10 h-[280px] w-[280px] flex-shrink-0 xl:h-[360px] xl:w-[360px] 2xl:h-[400px] 2xl:w-[420px]">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          {[80, 60, 40, 20].map((r) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#1e3a50"
              strokeWidth="0.5"
              strokeDasharray="2 2.5"
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x2 = 100 + 80 * Math.cos(angle);
            const y2 = 100 + 80 * Math.sin(angle);
            return (
              <line
                key={i}
                x1="100"
                y1="100"
                x2={Number(x2).toFixed(1)}
                y2={Number(y2).toFixed(1)}
                stroke="#1e3a50"
                strokeWidth="0.4"
                strokeDasharray="2 2.5"
              />
            );
          })}

          {/* Sweep — single CSS animation */}
          <defs>
            <linearGradient
              id="sweep-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#4dd0e1" stopOpacity="0" />
              <stop offset="100%" stopColor="#4ade80" stopOpacity="0.4" />
            </linearGradient>
            <clipPath id="radar-clip">
              <circle cx="100" cy="100" r="80" />
            </clipPath>
          </defs>
          <g
            className="origin-center animate-radar-sweep"
            clipPath="url(#radar-clip)"
          >
            <path
              d="M100 100 L100 20 A80 80 0 0 1 180 100 Z"
              fill="url(#sweep-gradient)"
            />
          </g>

          {/* Static blips — no animation */}
          <circle cx="68" cy="115" r="2.5" fill="#4ade80" opacity="0.7" />
          <circle cx="135" cy="138" r="2.2" fill="#4ade80" opacity="0.6" />
          <circle cx="148" cy="72" r="1.8" fill="#4ade80" opacity="0.5" />
        </svg>
      </div>

      {/* System status card — no framer-motion */}
      <div className="relative z-10 w-full max-w-[280px] xl:max-w-[340px] 2xl:max-w-[390px]">
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#071323]/70 p-4 shadow-lg xl:rounded-xl xl:p-5">
          {/* subtle top highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4ade80]/40 to-transparent" />

          <h3 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-[0.2em] text-[#4dd0e1] xl:text-[12px]">
            <div className="h-2 w-2 rounded-full bg-[#4dd0e1]" />
            SYSTEM STATUS
          </h3>
          <ul className="space-y-3 xl:space-y-4">
            {services.map((s) => (
              <li
                key={s.name}
                className="group flex items-center justify-between"
              >
                <span className="flex items-center gap-3 text-[12px] font-medium text-slate-300 transition-colors group-hover:text-white xl:text-[14px]">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
                  </span>
                  {s.name}
                </span>
                <span className="text-[12px] font-bold tracking-wide text-[#4ade80] xl:text-[14px]">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
