import React, { useEffect, useState } from 'react'
import { motion, useSpring } from 'framer-motion'

const RADIUS = 90
const STROKE = 10
const CENTER = 110
const SVG_SIZE = 220

// Arc goes from 210° to 330° (total 300° sweep, clockwise from bottom-left to bottom-right)
const START_ANGLE = 210
const END_ANGLE = 510 // 210 + 300
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARC_FRACTION = 300 / 360

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function getColor(value) {
  // Low (0-30): deep orange, Mid (30-70): orange-red, High (70-100): bright red
  if (value <= 30) return { primary: '#FF8C00', secondary: '#FF6600', glow: 'rgba(255,140,0,0.6)' }
  if (value <= 60) return { primary: '#FF4400', secondary: '#FF2200', glow: 'rgba(255,68,0,0.7)' }
  return { primary: '#FF1A1A', secondary: '#CC0000', glow: 'rgba(255,26,26,0.9)' }
}

// Tick marks around the gauge
function Ticks({ cx, cy, r }) {
  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const angle = START_ANGLE + (i / 10) * 300
    const outer = polarToCartesian(cx, cy, r + 8, angle)
    const inner = polarToCartesian(cx, cy, r + (i % 5 === 0 ? 2 : 4), angle)
    ticks.push(
      <line
        key={i}
        x1={inner.x} y1={inner.y}
        x2={outer.x} y2={outer.y}
        stroke={i % 5 === 0 ? '#FF6600' : '#3a2010'}
        strokeWidth={i % 5 === 0 ? 2 : 1}
        opacity={i % 5 === 0 ? 0.9 : 0.5}
      />
    )
  }
  return <>{ticks}</>
}

export default function Gauge({ label, value = 0, unit = '%', icon }) {
  const springValue = useSpring(value, { stiffness: 90, damping: 18 })
  const [displayValue, setDisplayValue] = useState(value)
  const [animValue, setAnimValue] = useState(value)

  useEffect(() => {
    springValue.set(value)
  }, [value])

  useEffect(() => {
    const unsub = springValue.on('change', (v) => {
      setAnimValue(v)
      setDisplayValue(Math.round(v))
    })
    return unsub
  }, [springValue])

  const colors = getColor(value)
  const progress = Math.min(Math.max(animValue, 0), 100) / 100
  const arcLength = CIRCUMFERENCE * ARC_FRACTION
  const filledLength = arcLength * progress
  const trackPath = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + 300)
  const glowPath = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + 300 * progress)

  // Needle tip position
  const needleAngle = START_ANGLE + progress * 300
  const needleTip = polarToCartesian(CENTER, CENTER, RADIUS - 15, needleAngle)
  const needleBase1 = polarToCartesian(CENTER, CENTER, 10, needleAngle + 90)
  const needleBase2 = polarToCartesian(CENTER, CENTER, 10, needleAngle - 90)

  return (
    <div className="flex flex-col items-center select-none">
      {/* Gauge SVG */}
      <div className="relative" style={{ width: SVG_SIZE, height: SVG_SIZE }}>
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            background: `radial-gradient(circle at center, transparent 55%, ${colors.glow} 75%, transparent 85%)`,
            opacity: 0.3 + progress * 0.4,
          }}
        />

        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="relative z-10"
        >
          <defs>
            {/* Track gradient */}
            <linearGradient id={`track-grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a0800" />
              <stop offset="100%" stopColor="#2a1000" />
            </linearGradient>

            {/* Fill gradient - changes with value */}
            <linearGradient id={`fill-grad-${label}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF8C00" />
              <stop offset="50%" stopColor={colors.primary} />
              <stop offset="100%" stopColor={colors.secondary} />
            </linearGradient>

            {/* Glow filter */}
            <filter id={`glow-${label}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Intense glow filter */}
            <filter id={`glow-intense-${label}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="8" result="blur1" />
              <feGaussianBlur stdDeviation="3" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Clip path for arc progress */}
            <clipPath id={`arc-clip-${label}`}>
              <circle cx={CENTER} cy={CENTER} r={RADIUS + STROKE} />
            </clipPath>
          </defs>

          {/* Background circle */}
          <circle
            cx={CENTER} cy={CENTER} r={RADIUS + STROKE + 4}
            fill="none"
            stroke="#0d0d0d"
            strokeWidth="1"
            opacity="0.5"
          />

          {/* Tick marks */}
          <Ticks cx={CENTER} cy={CENTER} r={RADIUS + STROKE / 2} />

          {/* Track arc (background) */}
          <path
            d={trackPath}
            fill="none"
            stroke={`url(#track-grad-${label})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Glow arc (blurred behind fill) */}
          {progress > 0 && (
            <motion.path
              d={glowPath}
              fill="none"
              stroke={colors.primary}
              strokeWidth={STROKE + 6}
              strokeLinecap="round"
              opacity={0.3}
              filter={`url(#glow-intense-${label})`}
            />
          )}

          {/* Main fill arc */}
          {progress > 0 && (
            <motion.path
              d={glowPath}
              fill="none"
              stroke={`url(#fill-grad-${label})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              filter={`url(#glow-${label})`}
            />
          )}

          {/* Inner decorative ring */}
          <circle
            cx={CENTER} cy={CENTER} r={RADIUS - STROKE - 4}
            fill="none"
            stroke="#1a0800"
            strokeWidth="1"
            opacity="0.4"
          />

          {/* Inner dark background */}
          <circle
            cx={CENTER} cy={CENTER} r={RADIUS - STROKE - 6}
            fill="rgba(0,0,0,0.85)"
          />

          {/* Subtle inner glow */}
          <circle
            cx={CENTER} cy={CENTER} r={RADIUS - STROKE - 6}
            fill="none"
            stroke={colors.primary}
            strokeWidth="1"
            opacity={0.1 + progress * 0.2}
          />

          {/* Needle */}
          {progress > 0 && (
            <motion.polygon
              points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
              fill={colors.primary}
              opacity="0.6"
              filter={`url(#glow-${label})`}
            />
          )}

          {/* Center hub */}
          <circle cx={CENTER} cy={CENTER} r={8} fill="#0a0a0a" stroke={colors.primary} strokeWidth="2" opacity="0.9" />
          <circle cx={CENTER} cy={CENTER} r={4} fill={colors.primary} opacity="0.8" />

          {/* Value text */}
          <text
            x={CENTER} y={CENTER - 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Orbitron, monospace"
            fontWeight="800"
            fontSize="32"
            fill="#ffffff"
            style={{ filter: `drop-shadow(0 0 8px ${colors.primary})` }}
          >
            {displayValue}
          </text>
          <text
            x={CENTER} y={CENTER + 20}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Orbitron, monospace"
            fontWeight="400"
            fontSize="11"
            fill={colors.primary}
            opacity="0.9"
          >
            {unit}
          </text>
        </svg>
      </div>

      {/* Label */}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-display font-semibold tracking-[0.35em] uppercase text-gray-200"
          style={{ color: colors.primary, textShadow: `0 0 10px ${colors.glow}` }}>
          {icon} {label}
        </span>
      </div>

      {/* Status bar */}
      <div className="mt-2 w-48 h-1 rounded-full overflow-hidden bg-gray-900/80">
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(to right, #FF8C00, ${colors.primary})`,
            boxShadow: `0 0 8px ${colors.glow}`,
          }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
