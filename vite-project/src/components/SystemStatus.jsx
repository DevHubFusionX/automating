import { useState, useEffect } from 'react'
import { Play, Pause, Zap, Clock, Target, Activity } from 'lucide-react'

export default function SystemStatus({ accounts, systemRunning, setSystemRunning, broadcasts, logs, apiService }) {
  const [isRunning, setIsRunning] = useState(systemRunning)
  const [isLoading, setIsLoading] = useState(false)
  const [detectionSpeed, setDetectionSpeed] = useState(0.8)
  const [executionTime, setExecutionTime] = useState(1.2)
  const [randomDelay, setRandomDelay] = useState({ min: 200, max: 700 })
  const [stats, setStats] = useState({
    totalLikes: 0,
    avgResponseTime: '0.9s',
    uptime: '0h 0m',
    lastDetection: 'None'
  })

  useEffect(() => {
    let interval
    if (isRunning) {
      interval = setInterval(() => {
        setStats(prev => ({
          ...prev,
          uptime: calculateUptime()
        }))
      }, 60000)
    }
    return () => clearInterval(interval)
  }, [isRunning])

  const calculateUptime = () => {
    const hours = Math.floor(Math.random() * 5)
    const minutes = Math.floor(Math.random() * 60)
    return `${hours}h ${minutes}m`
  }

  const toggleSystem = async () => {
    setIsLoading(true)
    try {
      if (isRunning) {
        await apiService.stopSystem()
        setIsRunning(false)
        setSystemRunning(false)
      } else {
        await apiService.startSystem()
        setIsRunning(true)
        setSystemRunning(true)
        setStats(prev => ({ ...prev, lastDetection: new Date().toLocaleTimeString() }))
      }
    } catch (error) {
      console.error('Failed to toggle system:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const onlineAccounts = accounts.filter(acc => acc.status === 'online').length

  return (
    <div className="space-y-6">
      {/* System Control */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Auto-Like System</h2>
          <button
            onClick={toggleSystem}
            disabled={isLoading}
            className={`px-6 py-3 rounded-lg flex items-center space-x-2 font-semibold disabled:opacity-50 ${
              isRunning 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} />}
            <span>{isRunning ? 'Stop System' : 'Start System'}</span>
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-400">{onlineAccounts}</div>
            <div className="text-sm text-gray-400">Active Accounts</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">{detectionSpeed}s</div>
            <div className="text-sm text-gray-400">Detection Speed</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-400">{executionTime}s</div>
            <div className="text-sm text-gray-400">Execution Time</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-400">{randomDelay.min}-{randomDelay.max}ms</div>
            <div className="text-sm text-gray-400">Random Delay</div>
          </div>
        </div>
      </div>

      {/* System Flow */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">System Flow</h3>
        <div className="space-y-4">
          {[
            { step: 1, title: 'Multi-Account Login', desc: 'All accounts logged in with unique proxies', icon: Activity, status: isRunning ? 'active' : 'inactive' },
            { step: 2, title: 'Real-Time Listener', desc: 'Monitoring notifications for tagged posts', icon: Target, status: isRunning ? 'active' : 'inactive' },
            { step: 3, title: 'Post Link Capture', desc: 'Auto-extract post link from tag notification', icon: Zap, status: 'ready' },
            { step: 4, title: 'Instant Like Action', desc: 'All accounts like post within ~1 second', icon: Clock, status: 'ready' }
          ].map(item => (
            <div key={item.step} className="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                item.status === 'active' ? 'bg-green-600' : 
                item.status === 'pending' ? 'bg-yellow-600' : 'bg-gray-600'
              }`}>
                <item.icon size={16} />
              </div>
              <div className="flex-1">
                <div className="font-medium">Step {item.step}: {item.title}</div>
                <div className="text-sm text-gray-400">{item.desc}</div>
              </div>
              <div className={`px-2 py-1 rounded text-xs ${
                item.status === 'active' ? 'bg-green-600' : 
                item.status === 'pending' ? 'bg-yellow-600' : 'bg-gray-600'
              }`}>
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Stats */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Performance Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-400">Total Likes</div>
            <div className="text-xl font-bold text-blue-400">{broadcasts.reduce((sum, b) => sum + b.likes, 0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Avg Response</div>
            <div className="text-xl font-bold text-green-400">{stats.avgResponseTime}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Uptime</div>
            <div className="text-xl font-bold text-purple-400">{stats.uptime}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Last Detection</div>
            <div className="text-xl font-bold text-yellow-400">{stats.lastDetection}</div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Detection Speed (seconds)</label>
            <input
              type="number"
              step="0.1"
              value={detectionSpeed}
              onChange={(e) => setDetectionSpeed(parseFloat(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Min Delay (ms)</label>
            <input
              type="number"
              value={randomDelay.min}
              onChange={(e) => setRandomDelay({...randomDelay, min: parseInt(e.target.value)})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Max Delay (ms)</label>
            <input
              type="number"
              value={randomDelay.max}
              onChange={(e) => setRandomDelay({...randomDelay, max: parseInt(e.target.value)})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>
    </div>
  )
}