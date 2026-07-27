"use client";

import { motion } from "framer-motion";

function seedRandom(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function generateWorldDots(): [number, number][] {
  const dots: [number, number][] = [];
  const scatter = (
    n: number,
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    mask: (x: number, y: number) => boolean,
    seedOffset: number,
  ) => {
    for (let i = 0; i < n; i++) {
      const x = xMin + seedRandom(i + seedOffset, 1) * (xMax - xMin);
      const y = yMin + seedRandom(i + seedOffset, 2) * (yMax - yMin);
      if (mask(x, y)) dots.push([x, y]);
    }
  };

  // Increased density of dots by ~2.5x
  scatter(
    650,
    80,
    300,
    50,
    210,
    (x, y) => {
      if (x < 130 && y > 160) return false;
      if (x > 260 && y > 190) return false;
      return true;
    },
    100,
  );

  scatter(100, 170, 240, 200, 260, () => true, 200);

  scatter(
    450,
    200,
    310,
    260,
    440,
    (x, y) => {
      const cx = 255,
        cy = 350;
      const dx = (x - cx) / 55,
        dy = (y - cy) / 90;
      return dx * dx + dy * dy < 1;
    },
    300,
  );

  scatter(
    350,
    430,
    560,
    55,
    160,
    (x, y) => {
      if (x > 540 && y > 140) return false;
      return true;
    },
    400,
  );

  scatter(
    500,
    430,
    560,
    165,
    420,
    (x, y) => {
      const cx = 500,
        cy = 290;
      const dx = (x - cx) / 60,
        dy = (y - cy) / 130;
      return dx * dx + dy * dy < 1;
    },
    500,
  );

  scatter(250, 560, 680, 120, 260, () => true, 600);
  scatter(450, 540, 820, 40, 130, () => true, 700);
  scatter(500, 680, 850, 100, 250, () => true, 800);
  scatter(200, 720, 850, 250, 340, () => true, 900);
  scatter(
    220,
    740,
    870,
    340,
    420,
    (x, y) => {
      const cx = 805,
        cy = 378;
      const dx = (x - cx) / 65,
        dy = (y - cy) / 40;
      return dx * dx + dy * dy < 1;
    },
    1000,
  );

  return dots;
}

const WORLD_DOTS = generateWorldDots();

const NODES = [
  { x: 190, y: 130 },
  { x: 260, y: 310 },
  { x: 490, y: 100 },
  { x: 500, y: 270 },
  { x: 630, y: 150 },
  { x: 660, y: 220 },
  { x: 780, y: 170 },
  { x: 810, y: 380 },
  // Additional nodes
  { x: 100, y: 200 }, // 8
  { x: 350, y: 180 }, // 9
  { x: 550, y: 350 }, // 10
  { x: 700, y: 100 }, // 11
  { x: 880, y: 250 }, // 12
  { x: 50, y: 160 }, // 13: Pacific West (near America)
  { x: 940, y: 220 }, // 14: Pacific East (near Asia)
];

const ARCS: [number, number][] = [
  [0, 2], // NA to Europe
  [2, 4], // Europe to Asia
  [4, 6], // Asia to East Asia
  [2, 3], // Europe to Africa
  [0, 1], // NA to SA
  [6, 7], // East Asia to Aus
  [3, 5], // Africa to Middle East
  // Strategic connections
  [0, 13], // America to Pacific West
  [12, 14], // East Asia to Pacific East
];

function arcPath(from: (typeof NODES)[0], to: (typeof NODES)[0]) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const cy = my - dist * 0.28;
  const fmt = (v: number) => Number(v).toFixed(1);
  return `M${fmt(from.x)},${fmt(from.y)} Q${fmt(mx)},${fmt(cy)} ${fmt(to.x)},${fmt(to.y)}`;
}

export function WorldMapSvg() {
  return (
    <svg
      viewBox="0 0 1000 500"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMax slice"
      style={{ perspective: "1200px" }}
    >
      <defs>
        <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <motion.g
        animate={{
          x: [0, 1000],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {[-1000, 0].map((offsetX) => (
          <g
            key={`map-instance-${offsetX}`}
            transform={`translate(${offsetX}, 0)`}
          >
            {WORLD_DOTS.map(([x, y], i) => {
              const seed = seedRandom(i, 42);
              const isAccent = seed > 0.94;
              const isDim = seed < 0.2;
              return (
                <circle
                  key={`dot-${i}`}
                  cx={Number(x).toFixed(1)}
                  cy={Number(y).toFixed(1)}
                  r={isAccent ? "2.2" : "1.4"}
                  fill={isAccent ? "#4ade80" : "#4dd0e1"}
                  opacity={isAccent ? "0.4" : isDim ? "0.08" : "0.15"}
                />
              );
            })}

            {ARCS.map(([fi, ti], i) => {
              const d = arcPath(NODES[fi], NODES[ti]);
              const dur = 3.5 + (i % 8) * 0.4; // Modified duration math for more arcs
              return (
                <g key={`arc-${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#1a3e5e"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="#4dd0e1"
                    strokeWidth="1.2"
                    opacity="0.4"
                  />

                  {/* Restore moving traveler dot */}
                  <circle
                    r="3.5"
                    fill="#4dd0e1"
                    opacity="0.7"
                    filter="url(#node-glow)"
                  >
                    <animateMotion
                      dur={`${dur}s`}
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                  <circle r="1.5" fill="#fff" opacity="0.9">
                    <animateMotion
                      dur={`${dur}s`}
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                </g>
              );
            })}

            {NODES.map((n, i) => (
              <g key={`n-${i}`}>
                <circle
                  cx={Number(n.x).toFixed(1)}
                  cy={Number(n.y).toFixed(1)}
                  r="6"
                  fill="none"
                  stroke="#4dd0e1"
                  strokeWidth="1"
                  opacity="0.3"
                />
                <circle
                  cx={Number(n.x).toFixed(1)}
                  cy={Number(n.y).toFixed(1)}
                  r="3.5"
                  fill="#4dd0e1"
                  opacity="0.7"
                  filter="url(#node-glow)"
                />
                <circle
                  cx={Number(n.x).toFixed(1)}
                  cy={Number(n.y).toFixed(1)}
                  r="2"
                  fill="#fff"
                  opacity="0.9"
                />
              </g>
            ))}
          </g>
        ))}
      </motion.g>
    </svg>
  );
}
