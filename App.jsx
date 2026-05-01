import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Gauge from './Gauge'
import ControlPanel from './ControlPanel'
import StatusBar from './StatusBar'

const SYSFS_PATH = '/sys/devices/platform/acer-wmi/nitro_sense/fan_speed'
const BRIDGE_URL = 'http://127.0.0.1:7337'
const DEMO_FAN_SPEED = 60

// ─── Fan speed I/O ───────────────────────────────────────────────────────────
// Priority: 1) Electron IPC (window.nitro)  2) HTTP bridge  3) Demo fallback

function buildDemoResponse(error = null, diagnostics = null) {
  return {
    status: 'demo',
    cpu: DEMO_FAN_SPEED,
    gpu: DEMO_FAN_SPEED,
    demo: true,
    error,
    diagnostics,
  }
}

async function readJsonResponse(response) {
  return response.json().catch(() => ({
    status: 'error',
    reason: 'invalid_json',
    message: `Bridge returned HTTP ${response.status} with invalid JSON.`,
  }))
}

async function requestBridge(path, options = {}) {
  try {
    const response = await fetch(`${BRIDGE_URL}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(2500),
    })
    return await readJsonResponse(response)
  } catch (error) {
    return {
      status: 'error',
      reason: 'bridge_unreachable',
      message: error.message,
    }
  }
}

async function readFanSpeed() {
  let lastError = null

  if (window.nitro?.isElectron) {
    const result = await window.nitro.readFan()
    if (result?.status === 'ok') return result
    lastError = result
  }

  const bridgeResult = await requestBridge('/read', { signal: AbortSignal.timeout(2000) })
  if (bridgeResult?.status === 'ok') {
    return bridgeResult
  }

  if (bridgeResult?.status === 'error') {
    lastError = bridgeResult
  }

  return buildDemoResponse(lastError, lastError?.diagnostics || null)
}

async function writeFanSpeed(cpu, gpu) {
  let lastError = null

  if (window.nitro?.isElectron) {
    const result = await window.nitro.writeFan(cpu, gpu)
    if (result?.status === 'ok') return result
    lastError = result
  }

  const bridgeResult = await requestBridge('/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpu, gpu }),
    signal: AbortSignal.timeout(10000),
  })
  if (bridgeResult?.status === 'ok') {
    return bridgeResult
  }

  if (bridgeResult?.status === 'error') {
    lastError = bridgeResult
  }

  return {
    status: 'demo',
    success: true,
    demo: true,
    error: lastError,
    diagnostics: lastError?.diagnostics || null,
  }
}

async function getSystemDiagnostics() {
  if (window.nitro?.isElectron && window.nitro.getDiagnostics) {
    const result = await window.nitro.getDiagnostics()
    if (result?.status === 'ok') return result.diagnostics
  }

  const bridgeResult = await requestBridge('/diagnostics', { signal: AbortSignal.timeout(2000) })
  if (bridgeResult?.status === 'ok') {
    return bridgeResult.diagnostics
  }

  return null
}

function getErrorMessage(error) {
  if (!error) return null
  if (typeof error === 'string') return error
  return error.message || error.reason || 'Nitro hardware interface not available. Check kernel/module.'
}

function detectPreset(cpu, gpu) {
  if (cpu === 0 && gpu === 0) return 'auto'
  if (cpu === 30 && gpu === 30) return 'quiet'
  if (cpu === 60 && gpu === 60) return 'balanced'
  if (cpu === 80 && gpu === 80) return 'performance'
  if (cpu === 100 && gpu === 100) return 'max'
  return 'custom'
}

// Animated background grid lines
function GridBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Radial gradient center glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,68,0,0.04) 0%, transparent 70%)',
        }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0 grid-bg"
        style={{ opacity: 0.6 }}
      />
      {/* Top vignette */}
      <div
        className="absolute top-0 left-0 right-0 h-32"
        style={{ background: 'linear-gradient(to bottom, #000000, transparent)' }}
      />
      {/* Bottom vignette */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
      />
      {/* Horizontal scan line that sweeps down */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(255,68,0,0.15), transparent)' }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

// Logo/header
function Header({ isDemo }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex items-center justify-between w-full mb-4 lg:mb-5"
    >
      <div className="flex items-center gap-4">
        {/* Acer-style N logo */}
        <div className="relative w-10 h-10">
          <div
            className="absolute inset-0 rounded"
            style={{
              background: 'linear-gradient(135deg, #FF2200, #FF6600)',
              clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)',
              boxShadow: '0 0 20px rgba(255,68,0,0.6)',
            }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center font-display font-black text-white text-lg"
            style={{ textShadow: '0 0 8px rgba(255,255,255,0.5)' }}
          >
            N
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-xl tracking-wider text-white">NITRO</span>
            <span
              className="font-display font-black text-xl tracking-wider"
              style={{ color: '#FF4400', textShadow: '0 0 15px rgba(255,68,0,0.6)' }}
            >
              SENSE
            </span>
          </div>
          <div className="font-mono text-xs tracking-[0.3em] text-gray-600 uppercase">
            Fan Control — Linux
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isDemo && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="px-3 py-1 rounded border text-xs font-mono"
            style={{
              borderColor: '#FF8C0044',
              background: 'rgba(255,140,0,0.05)',
              color: '#FF8C00',
            }}
          >
            DEMO MODE
          </motion.div>
        )}

        {/* Clock */}
        <Clock />
      </div>
    </motion.div>
  )
}

// Custom frameless title bar (Electron only)
function TitleBar() {
  const isElectron = typeof window !== 'undefined' && window.nitro?.isElectron
  if (!isElectron) return null
  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-10 shrink-0 select-none"
      style={{
        background: 'linear-gradient(180deg, rgba(5,5,5,0.98), rgba(10,10,10,0.92))',
        borderBottom: '1px solid rgba(255,90,0,0.14)',
        WebkitAppRegion: 'drag',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md border border-orange-500/30 bg-black/40"
          style={{ boxShadow: '0 0 14px rgba(255,90,0,0.15)' }}
        >
          <span className="font-display text-xs font-black text-orange-400">N</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xs font-bold tracking-[0.35em] text-white uppercase">Nitro Sense</span>
          <span className="font-mono text-[10px] tracking-[0.25em] text-orange-500/70 uppercase">Desktop Control</span>
        </div>
      </div>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.nitro.minimize()}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors text-xs"
        >─</button>
        <button
          onClick={() => window.nitro.maximize()}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors text-xs"
        >▢</button>
        <button
          onClick={() => window.nitro.close()}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors text-xs"
        >✕</button>
      </div>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-right">
      <div className="font-display text-sm font-bold text-gray-300">
        {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="font-mono text-xs text-gray-700">
        {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
    </div>
  )
}

// Notification toast
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  const palette = {
    success: { border: '#00FF8844', bg: 'rgba(0,255,136,0.05)', text: '#00FF88', icon: '✓' },
    error: { border: '#FF000044', bg: 'rgba(255,0,0,0.05)', text: '#FF4444', icon: '✗' },
    info: { border: '#FF440044', bg: 'rgba(255,68,0,0.05)', text: '#FF6600', icon: '◈' },
  }
  const colors = palette[type] || palette.info

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded border font-mono text-sm"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        boxShadow: `0 0 20px ${colors.border}`,
        color: colors.text,
        backdropFilter: 'blur(10px)',
      }}
    >
      <span className="text-lg">{colors.icon}</span>
      <span>{message}</span>
    </motion.div>
  )
}

function DiagnosticPill({ label, ok }) {
  return (
    <div
      className="p-3 rounded-lg border border-orange-500/10 bg-black/30 text-center"
      style={{
        boxShadow: ok ? 'inset 0 0 20px rgba(0,255,136,0.03)' : 'inset 0 0 20px rgba(255,90,0,0.03)',
      }}
    >
      <div className="font-display text-[10px] tracking-[0.3em] text-gray-500 uppercase">{label}</div>
      <div className={`mt-2 font-mono text-xs uppercase tracking-widest ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {ok ? 'OK' : 'Missing'}
      </div>
    </div>
  )
}

function SystemStatusPanel({ diagnostics, isDemo }) {
  if (!diagnostics) return null

  const moduleState = diagnostics.modules?.loaded || {}
  const sysfs = diagnostics.sysfs || {}
  const nitroEnabled = diagnostics.cmdline?.nitro_v4_enabled

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-6 shadow-[0_0_40px_rgba(255,90,0,0.1)]"
      style={{
        background: 'linear-gradient(135deg, rgba(10,10,10,0.72), rgba(20,10,0,0.6))',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold tracking-widest text-orange-400 uppercase font-display">System Status</div>
          <div className="mt-1 font-mono text-xs text-gray-500 uppercase tracking-wider">
            Kernel {diagnostics.kernel} {isDemo ? '• Demo mode active' : ''}
          </div>
        </div>
        <div className="font-mono text-[11px] text-gray-600">{sysfs.path || SYSFS_PATH}</div>
      </div>

      <div className="h-px bg-orange-500/20 my-3" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <DiagnosticPill label="nitro_v4=1" ok={Boolean(nitroEnabled)} />
        <DiagnosticPill label="linuwu_sense" ok={Boolean(moduleState.linuwu_sense)} />
        <DiagnosticPill label="acer_wmi" ok={Boolean(moduleState.acer_wmi)} />
        <DiagnosticPill label="sysfs" ok={Boolean(sysfs.exists)} />
      </div>

      <div className="mt-4 grid gap-2 font-mono text-xs text-gray-500 md:grid-cols-2">
        <div>Readable: <span className={sysfs.readable ? 'text-emerald-400' : 'text-orange-400'}>{sysfs.readable ? 'yes' : 'no'}</span></div>
        <div>Writable: <span className={sysfs.writable ? 'text-emerald-400' : 'text-orange-400'}>{sysfs.writable ? 'yes' : 'no'}</span></div>
      </div>
    </motion.div>
  )
}

export default function App() {
  const [cpuFan, setCpuFan] = useState(60)
  const [gpuFan, setGpuFan] = useState(60)
  const [isLoading, setIsLoading] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [status, setStatus] = useState('idle')
  const [lastApplied, setLastApplied] = useState(null)
  const [error, setError] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)
  const [currentPreset, setCurrentPreset] = useState('balanced')
  const [toast, setToast] = useState(null)
  const [initialized, setInitialized] = useState(false)

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() })
  }

  // Read fan speed on mount
  useEffect(() => {
    async function init() {
      setStatus('loading')
      try {
        const [result, systemDiagnostics] = await Promise.all([
          readFanSpeed(),
          getSystemDiagnostics(),
        ])

        const activeDiagnostics = result.diagnostics || systemDiagnostics
        setDiagnostics(activeDiagnostics)
        setCpuFan(result.cpu ?? DEMO_FAN_SPEED)
        setGpuFan(result.gpu ?? DEMO_FAN_SPEED)
        setCurrentPreset(detectPreset(result.cpu ?? DEMO_FAN_SPEED, result.gpu ?? DEMO_FAN_SPEED))

        if (result.status === 'ok') {
          setError(null)
          setIsDemo(false)
          setStatus('success')
          return
        }

        setIsDemo(true)
        setError(
          getErrorMessage(result.error) ||
          'Nitro hardware interface not available. Check kernel/module.'
        )
        setStatus('demo')
      } catch (e) {
        setIsDemo(true)
        setError('Nitro hardware interface not available. Check kernel/module.')
        setStatus('demo')
      } finally {
        setInitialized(true)
      }
    }
    init()
  }, [])

  const handleApply = useCallback(async (cpu, gpu, presetId) => {
    setIsLoading(true)
    setCurrentPreset(presetId)

    try {
      const result = await writeFanSpeed(cpu, gpu)
      if (result.success) {
        setCpuFan(cpu)
        setGpuFan(gpu)
        setLastApplied(`${cpu},${gpu}`)
        setDiagnostics(result.diagnostics || diagnostics)
        if (result.demo) {
          setIsDemo(true)
          setStatus('demo')
          setError(
            getErrorMessage(result.error) ||
            'Nitro hardware interface not available. Check kernel/module.'
          )
        } else {
          setIsDemo(false)
          setStatus('success')
          setError(null)
        }
        const presetName = presetId.charAt(0).toUpperCase() + presetId.slice(1)
        showToast(
          result.demo
            ? `[Demo] ${presetName} → CPU ${cpu}% / GPU ${gpu}%`
            : `Applied: ${presetName} → CPU ${cpu}% / GPU ${gpu}%`,
          'success'
        )
      }
    } catch (e) {
      showToast('Failed to apply: ' + e.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [diagnostics])

  const cpuColor = cpuFan <= 30 ? '#FF8C00' : cpuFan <= 70 ? '#FF4400' : '#FF1A1A'
  const gpuColor = gpuFan <= 30 ? '#FF8C00' : gpuFan <= 70 ? '#FF6600' : '#FF2200'

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden text-white relative">
      <TitleBar />
      <GridBackground />

      {/* Main content */}
      <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-4 lg:px-6 pt-14 pb-3 space-y-3 relative z-10 flex-1 flex flex-col overflow-hidden">
        <Header isDemo={isDemo} />

        {/* Main panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="flex-1 rounded-2xl overflow-hidden min-h-0 bg-black/40 backdrop-blur-xl border border-orange-500/20 shadow-[0_0_40px_rgba(255,90,0,0.1)]"
          style={{
            background: 'linear-gradient(160deg, rgba(13,13,13,0.78) 0%, rgba(10,8,0,0.72) 50%, rgba(13,10,0,0.78) 100%)',
            boxShadow: '0 0 40px rgba(255,90,0,0.1), 0 0 80px rgba(255,90,0,0.05), inset 0 0 40px rgba(0,0,0,0.45)',
          }}
        >
          {/* Panel header bar */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b"
            style={{ borderColor: '#2a1a0a', background: 'rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-orange-800" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-900" />
              </div>
              <span className="font-display text-xs tracking-[0.3em] text-orange-800 uppercase">
                Fan Speed Control
              </span>
            </div>

            {/* Active preset indicator */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-gray-600">Mode:</span>
              <motion.span
                key={currentPreset}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-display font-bold tracking-widest uppercase text-orange-500"
              >
                {currentPreset}
              </motion.span>
            </div>
          </div>

          <div className="h-full p-4 sm:p-5 lg:p-6 flex flex-col gap-4">
            <SystemStatusPanel diagnostics={diagnostics} isDemo={isDemo} />

            <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4 lg:gap-5 items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="h-full min-w-0 rounded-2xl border border-orange-500/20 bg-black/30 backdrop-blur-md p-5"
                style={{
                  boxShadow: 'inset 0 0 24px rgba(255,90,0,0.05)',
                }}
              >
                <ControlPanel
                  onApply={handleApply}
                  isLoading={isLoading}
                  currentPreset={currentPreset}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="min-w-0 h-full rounded-2xl border border-orange-500/20 bg-black/30 backdrop-blur-md p-5 flex items-center"
                style={{
                  boxShadow: 'inset 0 0 24px rgba(255,90,0,0.05)',
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex w-full h-full items-center justify-center gap-6 lg:gap-8 flex-wrap xl:flex-nowrap">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex-1 min-w-[280px] max-w-[360px] p-4 lg:p-5 rounded-2xl border border-orange-500/20 bg-black/40 backdrop-blur-md glow-orange transition hover:scale-105 flex flex-col items-center justify-center gap-4"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Gauge label="CPU" value={cpuFan} unit="%" icon="◈" />
                      </div>

                      <div
                        className="px-4 py-1.5 rounded border text-center"
                        style={{
                          background: 'rgba(0,0,0,0.6)',
                          borderColor: '#2a1a0a',
                        }}
                      >
                        <div className="font-display text-xs text-gray-600 tracking-widest uppercase mb-0.5">Speed</div>
                        <div className="font-display text-sm font-bold" style={{ color: cpuColor }}>
                          {cpuFan === 0 ? 'BIOS AUTO' : `${Math.round(cpuFan * 24)}` + ' RPM'}
                        </div>
                      </div>
                    </motion.div>

                    <div className="hidden xl:flex flex-col items-center justify-center gap-3 self-center">
                      <div className="w-px h-32 bg-orange-500/20" />
                      <div className="opacity-30 text-xs tracking-widest text-orange-500 font-display uppercase">VS</div>
                      <div className="w-px h-32 bg-orange-500/20" />
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex-1 min-w-[280px] max-w-[360px] p-4 lg:p-5 rounded-2xl border border-orange-500/20 bg-black/40 backdrop-blur-md glow-orange transition hover:scale-105 flex flex-col items-center justify-center gap-4"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Gauge label="GPU" value={gpuFan} unit="%" icon="◆" />
                      </div>

                      <div
                        className="px-4 py-1.5 rounded border text-center"
                        style={{
                          background: 'rgba(0,0,0,0.6)',
                          borderColor: '#2a1a0a',
                        }}
                      >
                        <div className="font-display text-xs text-gray-600 tracking-widest uppercase mb-0.5">Speed</div>
                        <div className="font-display text-sm font-bold" style={{ color: gpuColor }}>
                          {gpuFan === 0 ? 'BIOS AUTO' : `${Math.round(gpuFan * 26)}` + ' RPM'}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>

            <StatusBar
              status={status}
              lastApplied={lastApplied}
              error={error && initialized ? error : null}
              isDemo={isDemo}
            />
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-gray-800"
        >
          <span>linuwu_sense kernel module • nitro_v4=1</span>
          <span>Acer Nitro Fan Control v1.0 • Linux</span>
          <span>{SYSFS_PATH}</span>
        </motion.div>
      </div>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDone={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
