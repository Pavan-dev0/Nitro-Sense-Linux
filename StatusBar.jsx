import React from 'react'
import { motion } from 'framer-motion'

export default function StatusBar({ status, lastApplied, error, isDemo = false }) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-start gap-3 p-4 rounded border"
        style={{
          background: 'linear-gradient(135deg, #1a0000, #110000)',
          borderColor: '#FF000044',
          boxShadow: '0 0 20px rgba(255,0,0,0.1)',
        }}
      >
        <span className="text-red-500 text-xl mt-0.5">⚠</span>
        <div>
          <p className="font-display text-sm font-bold text-red-400 tracking-wider uppercase mb-1">
            Hardware Fallback Active
          </p>
          <p className="font-mono text-xs text-red-600 leading-relaxed">
            {error}
          </p>
          <p className="font-mono text-xs text-gray-600 mt-1">
            Nitro Control is running in <span className="text-orange-500">demo mode</span> until the hardware interface is available.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: status === 'success' ? '#00FF88' : status === 'loading' ? '#FF8C00' : status === 'demo' ? '#FF6600' : '#444',
            boxShadow: status === 'success' ? '0 0 8px #00FF8888' : status === 'loading' ? '0 0 8px #FF8C0088' : status === 'demo' ? '0 0 8px #FF660088' : 'none',
          }}
        />
        <span className="font-mono text-xs text-gray-500">
          {status === 'loading' ? 'Reading sysfs...' : status === 'success' ? 'Sysfs OK' : status === 'demo' ? 'Demo mode enabled' : 'Idle'}
        </span>
      </div>

      {lastApplied && (
        <span className="font-mono text-xs text-gray-600">
          Last: <span className="text-orange-600">{lastApplied}</span>
        </span>
      )}

      <span className="font-mono text-xs text-gray-700">
        {isDemo ? 'IPC → HTTP → Demo fallback active' : '/sys/devices/platform/acer-wmi/nitro_sense/fan_speed'}
      </span>
    </div>
  )
}
