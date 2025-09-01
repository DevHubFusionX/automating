import React, { useState, useEffect } from 'react'
import { Users, Activity, Settings } from 'lucide-react'
import Dashboard from './components/Dashboard'
import AccountManager from './components/AccountManager'
import SystemStatus from './components/SystemStatus'
import apiService from './services/api'
import wsService from './services/websocket'

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-4">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [accounts, setAccounts] = useState([])
  const [systemRunning, setSystemRunning] = useState(false)
  const [broadcasts, setBroadcasts] = useState([])
  const [logs, setLogs] = useState([])
  const [autoTagRunning, setAutoTagRunning] = useState(false)
  const [tagKeyword, setTagKeyword] = useState('@autolike')
  const [appError, setAppError] = useState(null)
  
  // Real auto-like function using backend API
  const triggerAutoLike = async (postUrl, source = 'Manual', postId = null) => {
    if (!systemRunning) return
    
    try {
      const result = await apiService.broadcastLike(postUrl)
      
      const newBroadcast = {
        id: Date.now(),
        link: postUrl,
        timestamp: new Date().toLocaleTimeString(),
        likes: result.filter(r => r.success).length,
        source: source
      }
      setBroadcasts(prev => [newBroadcast, ...prev])
      

      
    } catch (error) {
      console.error('Failed to broadcast like:', error)
    }
  }
  
  // Initialize WebSocket connection and load accounts
  useEffect(() => {
    wsService.connect()
    loadAccounts()
    
    // Set up WebSocket event listeners with error handling
    wsService.on('TAG_DETECTED', (data) => {
      try {
        console.log('Tag detected:', data)
        // Auto-like will be handled by backend
      } catch (error) {
        console.error('TAG_DETECTED handler error:', error)
      }
    })
    
    wsService.on('LIKE_COMPLETED', (data) => {
      try {
        if (data && data.account) {
          const newLog = {
            id: Date.now(),
            account: data.account,
            action: 'Auto-liked tagged post',
            time: new Date().toLocaleTimeString()
          }
          setLogs(prev => [newLog, ...prev])
        }
      } catch (error) {
        console.error('LIKE_COMPLETED handler error:', error)
      }
    })
    
    wsService.on('ACCOUNT_STATUS_CHANGED', (data) => {
      try {
        if (data && data.account && data.account.id) {
          setAccounts(prev => prev.map(acc => 
            acc.id === data.account.id ? data.account : acc
          ))
        }
      } catch (error) {
        console.error('ACCOUNT_STATUS_CHANGED handler error:', error)
      }
    })
    
    wsService.on('ACCOUNT_REMOVED', (data) => {
      try {
        if (data && data.accountId) {
          setAccounts(prev => prev.filter(acc => acc.id !== data.accountId))
        }
      } catch (error) {
        console.error('ACCOUNT_REMOVED handler error:', error)
      }
    })
    
    // Periodic account refresh to handle disconnections
    const refreshInterval = setInterval(() => {
      try {
        loadAccounts()
      } catch (error) {
        console.error('Periodic refresh error:', error)
      }
    }, 10000) // Refresh every 10 seconds
    
    return () => {
      wsService.disconnect()
      clearInterval(refreshInterval)
    }
  }, [])
  
  const loadAccounts = async () => {
    try {
      const accounts = await apiService.getAccounts()
      setAccounts(accounts || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
      setAppError('Failed to connect to backend')
    }
  }

  if (appError) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Connection Error</h1>
          <p className="text-gray-300 mb-4">{appError}</p>
          <button 
            onClick={() => {
              setAppError(null)
              loadAccounts()
            }}
            className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-400">Facebook Auto-Like System</h1>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-lg flex items-center space-x-2 text-sm ${
                activeTab === 'dashboard' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Activity size={16} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab('accounts')}
              className={`px-3 py-2 rounded-lg flex items-center space-x-2 text-sm ${
                activeTab === 'accounts' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Accounts</span>
            </button>
            <button 
              onClick={() => setActiveTab('system')}
              className={`px-3 py-2 rounded-lg flex items-center space-x-2 text-sm ${
                activeTab === 'system' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Users size={16} />
              <span className="hidden sm:inline">Control</span>
            </button>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'dashboard' && (
          <Dashboard 
            accounts={accounts} 
            setAccounts={setAccounts}
            broadcasts={broadcasts} 
            setBroadcasts={setBroadcasts}
            logs={logs}
            setLogs={setLogs}
            systemRunning={systemRunning}
            triggerAutoLike={triggerAutoLike}
          />
        )}
        {activeTab === 'accounts' && (
          <div className="p-4 sm:p-6">
            <AccountManager 
              accounts={accounts} 
              setAccounts={setAccounts}
              apiService={apiService}
            />
          </div>
        )}
        {activeTab === 'system' && (
          <div className="p-4 sm:p-6">
            <SystemStatus 
              accounts={accounts} 
              systemRunning={systemRunning}
              setSystemRunning={setSystemRunning}
              broadcasts={broadcasts}
              logs={logs}
              apiService={apiService}
            />
          </div>
        )}

      </main>
    </div>
  )
}

// Wrap App with Error Boundary
function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

export default AppWithErrorBoundary
