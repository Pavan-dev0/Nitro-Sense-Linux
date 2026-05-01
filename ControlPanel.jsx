import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PRESETS = [
  {
    id: 'auto',
    label: 'AUTO',
    sub: '0 / 0',
    cpu: 0,
    gpu: 0,
    icon: '◎',
    desc: 'BIOS Default',
    color: '#888888',
  },
  {
    id: 'quiet',
    label: 'QUIET',
    sub: '30 / 30',
    cpu: 30,
    gpu: 30,
    icon: '◌',
    desc: 'Silent Mode',
    color: '#44AAFF',
  },
  {
    id: 'balanced',
    label: 'BALANCED',
    sub: '60 / 60',
    cpu: 60,
    gpu: 60,
    icon: '◈',
    desc: 'Optimal Balance',
    color: '#FF8C00',
  },
  {
    id: 'performance',
    label: 'PERF',
    sub: '80 / 80',
    cpu: 80,
    gpu: 80,
    icon: '◆',
    desc: 'High Performance',
    color: '#FF4400',
  },
  {
    id: 'max',
    label: 'MAX',
    sub: '100 / 100',
    cpu: 100,
    gpu: 100,
    icon: '⬡',
    desc: 'Maximum Cooling',
    color: '#FF1A1A',
  },
  {
    id: 'custom',
    label: 'CUSTOM',
    sub: 'Manual',
    cpu: null,
    gpu: null,
    icon: '⚙',
    desc: 'User Defined',
    color: '#AA44FF',
  },
]

function PresetButton({ preset, isActive, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.96 }}
      animate={isActive ? { boxShadow: ['0 0 0 rgba(255,90,0,0)', '0 0 18px rgba(255,90,0,0.28)', '0 0 0 rgba(255,90,0,0)'] } : { boxShadow: '0 0 0 rgba(0,0,0,0)' }}
      transition={isActive ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      className={`relative w-full flex flex-col items-center justify-center gap-1 px-6 py-3 rounded-xl border bg-black/30 transition duration-300 overflow-hidden group backdrop-blur-md hover:scale-105 hover:border-orange-500/40 ${
        isActive ? 'bg-orange-500/10 border-orange-500 glow-orange text-orange-400' : 'border-orange-500/10'
      }`}
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${preset.color}26, rgba(255,90,0,0.08))`
          : 'linear-gradient(135deg, rgba(18,18,18,0.75), rgba(8,8,8,0.9))',
        borderColor: isActive ? preset.color : 'rgba(255,90,0,0.1)',
        boxShadow: isActive
          ? `0 0 20px ${preset.color}44, 0 0 50px rgba(255,90,0,0.18), inset 0 0 20px ${preset.color}11`
          : 'inset 0 0 18px rgba(255,90,0,0.03)',
      }}
    >
      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId="activePreset"
          className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
          style={{ background: `linear-gradient(to right, transparent, ${preset.color}, transparent)` }}
        />
      )}

      {/* Hover shimmer */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${preset.color}08, transparent)`,
        }}
      />

      <span className="text-xl" style={{ color: isActive ? preset.color : '#555555' }}>
        {preset.icon}
      </span>
      <span
        className="text-xs font-display font-bold tracking-widest uppercase"
        style={{
          color: isActive ? preset.color : '#888888',
          textShadow: isActive ? `0 0 8px ${preset.color}88` : 'none',
        }}
      >
        {preset.label}
      </span>
      <span className="text-xs font-mono opacity-60" style={{ color: isActive ? preset.color : '#555' }}>
        {preset.sub}
      </span>
    </motion.button>
  )
}

function SliderTrack({ label, value, onChange, color = '#FF4400' }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-display text-sm font-semibold tracking-widest text-gray-400 uppercase">
          {label} Fan
        </span>
        <div className="flex items-center gap-1">
          <span
            className="font-display text-xl font-bold"
            style={{ color, textShadow: `0 0 10px ${color}88` }}
          >
            {value}
          </span>
          <span className="text-xs text-gray-600 font-mono">%</span>
        </div>
      </div>

      {/* Custom styled slider container */}
      <div className="relative">
        {/* Background track with gradient fill */}
        <div className="relative h-2 rounded-full overflow-hidden bg-gray-900 border border-gray-800">
          <motion.div
            className="absolute left-0 top-0 bottom-0 rounded-full"
            style={{
              width: `${value}%`,
              background: `linear-gradient(to right, #FF8C00, ${color})`,
              boxShadow: `0 0 8px ${color}66`,
            }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
          style={{ height: '8px' }}
        />
        {/* Visible thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 pointer-events-none"
          style={{
            left: `calc(${value}% - 8px)`,
            background: `radial-gradient(circle, ${color}, #CC2200)`,
            borderColor: color,
            boxShadow: `0 0 10px ${color}88, 0 0 20px ${color}44`,
          }}
          animate={{ left: `calc(${value}% - 8px)` }}
          transition={{ duration: 0.15 }}
        />
      </div>

      {/* Scale markers */}
      <div className="flex justify-between text-xs font-mono text-gray-700 px-0.5">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  )
}

export default function ControlPanel({ onApply, isLoading, currentPreset }) {
  const [selectedPreset, setSelectedPreset] = useState(currentPreset || 'balanced')
  const [customCpu, setCustomCpu] = useState(60)
  const [customGpu, setCustomGpu] = useState(60)
  const [showCustom, setShowCustom] = useState(false)

  const handlePresetClick = (preset) => {
    if (preset.id === 'custom') {
      setSelectedPreset('custom')
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    setSelectedPreset(preset.id)
    onApply(preset.cpu, preset.gpu, preset.id)
  }

  const handleCustomApply = () => {
    onApply(customCpu, customGpu, 'custom')
  }

  return (
    <div className="w-full space-y-4">
      {/* Preset buttons */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-orange-500/30" />
          <span className="font-display text-xs tracking-[0.35em] text-orange-400 uppercase">Fan Presets</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-orange-500/30" />
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {PRESETS.map((preset) => (
            <div key={preset.id} className="w-[calc(50%-0.5rem)] min-w-[150px] md:w-[calc(33.333%-0.75rem)] xl:w-[calc(50%-0.5rem)]">
              <PresetButton
                preset={preset}
                isActive={selectedPreset === preset.id}
                onClick={() => handlePresetClick(preset)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Custom sliders */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl border p-5 space-y-6 corner-bracket bg-black/40 backdrop-blur-xl"
              style={{
                borderColor: '#AA44FF44',
                boxShadow: '0 0 24px rgba(170,68,255,0.12)',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-purple-900/50" />
                <span className="font-display text-xs tracking-[0.3em] text-purple-500 uppercase">
                  Custom Config
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-purple-900/50" />
              </div>

              <SliderTrack
                label="CPU"
                value={customCpu}
                onChange={setCustomCpu}
                color="#FF4400"
              />
              <SliderTrack
                label="GPU"
                value={customGpu}
                onChange={setCustomGpu}
                color="#FF8C00"
              />

              {/* Apply button */}
              <motion.button
                onClick={handleCustomApply}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-[0.2em] uppercase relative overflow-hidden bg-orange-500/10 border border-orange-500/40 text-orange-300 glow-orange"
                style={{
                  background: isLoading
                    ? 'linear-gradient(135deg, rgba(42,26,0,0.95), rgba(26,16,0,0.95))'
                    : 'linear-gradient(135deg, rgba(255,90,0,0.18), rgba(255,68,0,0.9), rgba(204,51,0,0.88))',
                  boxShadow: isLoading ? 'none' : '0 0 20px rgba(255,90,0,0.32), 0 0 40px rgba(255,90,0,0.16)',
                  color: isLoading ? '#555' : '#fff',
                  textShadow: isLoading ? 'none' : '0 0 10px rgba(255,255,255,0.5)',
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    APPLYING...
                  </span>
                ) : (
                  <>
                    <span className="relative z-10">⚡ APPLY — CPU {customCpu}% / GPU {customGpu}%</span>
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
