import { useState, useEffect } from 'react'
import { Send, Users, Activity, Globe, Clock, Settings } from 'lucide-react'

export default function Dashboard({ accounts, setAccounts, broadcasts, setBroadcasts, logs, setLogs, systemRunning, triggerAutoLike }) {
  const [postLink, setPostLink] = useState('')
  const [tagKeyword, setTagKeyword] = useState('@autolike')
  const [isUpdatingTag, setIsUpdatingTag] = useState(false)

  // Load current tag keyword on mount
  useEffect(() => {
    const loadTagKeyword = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/tag-keyword')
        const data = await response.json()
        if (data.keyword) {
          setTagKeyword(data.keyword)
        }
      } catch (error) {
        console.error('Failed to load tag keyword:', error)
      }
    }
    loadTagKeyword()
  }, [])

  const handleBroadcast = () => {
    if (!postLink || !systemRunning) return
    triggerAutoLike(postLink, 'Dashboard')
    setPostLink('')
  }

  const onlineAccounts = accounts.filter(acc => acc.status === 'online').length

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Sidebar */}
      <div className="w-full lg:w-80 bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-700 p-4 lg:p-6 overflow-y-auto max-h-96 lg:max-h-none">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="text-green-400" size={20} />
                <span className="text-sm text-gray-300">Online</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{onlineAccounts}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Activity className="text-blue-400" size={20} />
                <span className="text-sm text-gray-300">Total</span>
              </div>
              <div className="text-2xl font-bold text-blue-400">{accounts.length}</div>
            </div>
          </div>

          {/* Accounts List */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Accounts</h3>
            <div className="space-y-3">
              {accounts.map(account => (
                <div key={account.id} className="bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium">{account.email || account.username}</span>
                      {account.profileName && (
                        <div className="text-xs text-green-400">👤 {account.profileName}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        account.loginStatus === 'verified' ? 'bg-green-400' :
                        account.loginStatus === 'failed' ? 'bg-red-400' :
                        'bg-yellow-400'
                      }`} title={`Login: ${account.loginStatus}`} />
                      <div className={`w-3 h-3 rounded-full ${
                        account.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                      }`} title={`Status: ${account.status}`} />
                      <div className="flex items-center space-x-1">
                        {(account.loginStatus === 'failed' || account.loginStatus === 'captcha_required') && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`http://localhost:3001/api/accounts/${account.id}/retry`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' }
                                });
                                if (response.ok) {
                                  console.log(`Retrying account: ${account.email}`);
                                } else {
                                  alert('Retry failed');
                                }
                              } catch (error) {
                                alert('Retry error: ' + error.message);
                              }
                            }}
                            className="text-yellow-400 hover:text-yellow-300 text-xs px-1"
                            title="Retry login"
                          >
                            ↻
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (confirm(`Delete account ${account.email}?`)) {
                              try {
                                console.log(`Deleting account ID: ${account.id}`);
                                const response = await fetch(`http://localhost:3001/api/accounts/${account.id}`, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' }
                                });
                                
                                console.log(`Delete response status: ${response.status}`);
                                
                                if (response.ok) {
                                  const result = await response.json();
                                  console.log('Delete successful:', result);
                                  setAccounts(accounts.filter(acc => acc.id !== account.id));
                                } else {
                                  const errorText = await response.text();
                                  console.error('Delete failed:', errorText);
                                  alert(`Failed to delete account: ${response.status} - ${errorText}`);
                                }
                              } catch (error) {
                                console.error('Delete error:', error);
                                alert('Error deleting account: ' + error.message);
                              }
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                          title="Delete account"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    <div className="flex items-center space-x-1">
                      <Globe size={12} />
                      <span>{account.proxy || 'No proxy'}</span>
                    </div>
                    <div className="mt-1">{account.lastAction}</div>
                    {account.loginStatus === 'captcha_required' && (
                      <div className="text-yellow-400 mt-1">🤖 CAPTCHA - Complete manually in browser</div>
                    )}
                    {account.loginError && (
                      <div className="text-red-400 mt-1">❌ {account.loginError}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* System Controls */}
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">System Controls</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3001/api/system/headless-mode', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ headless: false })
                    });
                    alert('Switched to visible mode for manual login. Restart system.');
                  } catch (error) {
                    alert('Failed to switch mode');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
              >
                🖥️ Enable Visible Mode
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3001/api/system/retry-failed', {
                      method: 'POST'
                    });
                    alert('Retrying all failed accounts...');
                  } catch (error) {
                    alert('Retry failed');
                  }
                }}
                className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm"
              >
                ↻ Retry All Failed
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3001/api/system/headless-mode', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ headless: true })
                    });
                    alert('Switched to headless mode. Restart system.');
                  } catch (error) {
                    alert('Failed to switch mode');
                  }
                }}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
              >
                👻 Enable Headless Mode
              </button>
            </div>
          </div>

          {/* Tag Configuration */}
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Tag Detection Settings</h2>
            <p className="text-gray-400 text-sm mb-4">Configure what tag/keyword the system should detect for auto-liking</p>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <input
                type="text"
                value={tagKeyword}
                onChange={(e) => setTagKeyword(e.target.value)}
                placeholder="Enter tag to detect (e.g., @autolike, @sushma)"
                className="w-full sm:flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              />
              <button
                onClick={async () => {
                  setIsUpdatingTag(true)
                  try {
                    await fetch('http://localhost:3001/api/tag-keyword', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ keyword: tagKeyword })
                    })
                    console.log(`Tag keyword updated to: ${tagKeyword}`)
                  } catch (error) {
                    console.error('Failed to update tag keyword:', error)
                  } finally {
                    setIsUpdatingTag(false)
                  }
                }}
                disabled={!tagKeyword || isUpdatingTag}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Settings size={16} />
                <span>{isUpdatingTag ? 'Updating...' : 'Update Tag'}</span>
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Current detection: <span className="text-blue-400 font-mono">{tagKeyword}</span>
            </div>
          </div>

          {/* Manual Broadcast Section */}
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Manual Broadcast</h2>
            <p className="text-gray-400 text-sm mb-4">Test the auto-like system by manually broadcasting a post link</p>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <input
                type="text"
                value={postLink}
                onChange={(e) => setPostLink(e.target.value)}
                placeholder="Enter Facebook post link for testing"
                className="w-full sm:flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              />
              <button
                onClick={handleBroadcast}
                disabled={!postLink || !systemRunning}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Send size={16} />
                <span>Test Broadcast</span>
              </button>
            </div>
          </div>

          {/* Auto-Like History */}
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Auto-Like History</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-96">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-sm">Post Link</th>
                    <th className="text-left py-2 text-sm hidden sm:table-cell">Time</th>
                    <th className="text-left py-2 text-sm">Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map(broadcast => (
                    <tr key={broadcast.id} className="border-b border-gray-700">
                      <td className="py-2 text-blue-400 truncate max-w-32 sm:max-w-xs text-sm">{broadcast.link}</td>
                      <td className="py-2 text-gray-400 text-sm hidden sm:table-cell">{broadcast.timestamp}</td>
                      <td className="py-2">
                        <span className="bg-green-600 px-2 py-1 rounded text-xs sm:text-sm">{broadcast.likes}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tag Detection Feed */}
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Tag Detection & Auto-Likes</h2>
            <p className="text-gray-400 text-sm mb-4">Real-time feed of detected tags and automatic likes</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-700 p-3 rounded gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="font-medium text-blue-400 text-sm">{log.account}</span>
                    <span className="text-gray-300 text-sm">{log.action}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-400 text-xs sm:text-sm">
                    <Clock size={12} />
                    <span>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}