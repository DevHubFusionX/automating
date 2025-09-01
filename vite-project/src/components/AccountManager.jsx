import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Globe, Clock } from 'lucide-react'

export default function AccountManager({ accounts, setAccounts, apiService }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [newAccount, setNewAccount] = useState({ email: '', password: '', proxy: '' })
  const [isAdding, setIsAdding] = useState(false)

  const addAccount = async () => {
    if (!newAccount.email || !newAccount.password) return
    
    setIsAdding(true)
    try {
      const result = await apiService.addAccount(newAccount.email, newAccount.password, newAccount.proxy)
      if (result.success) {
        setAccounts([...accounts, result.account])
        setNewAccount({ email: '', password: '', proxy: '' })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Failed to add account:', error)
      alert('Failed to add account: ' + error.message)
    } finally {
      setIsAdding(false)
    }
  }

  const removeAccount = async (id) => {
    try {
      await apiService.removeAccount(id)
      setAccounts(accounts.filter(acc => acc.id !== id))
      if (selectedAccount?.id === id) setSelectedAccount(null)
    } catch (error) {
      console.error('Failed to remove account:', error)
      alert('Failed to remove account: ' + error.message)
    }
  }

  const toggleStatus = (id) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, status: acc.status === 'online' ? 'offline' : 'online' } : acc
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Account Manager</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>Add Account</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-700 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Facebook Email</label>
            <input
              placeholder="your-email@example.com"
              type="email"
              value={newAccount.email}
              onChange={(e) => setNewAccount({...newAccount, email: e.target.value})}
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
              disabled={isAdding}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Facebook Password</label>
            <input
              placeholder="Your Facebook password"
              type="password"
              value={newAccount.password}
              onChange={(e) => setNewAccount({...newAccount, password: e.target.value})}
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
              disabled={isAdding}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Proxy (Optional)</label>
            <input
              placeholder="proxy.example.com:8080 or leave empty"
              value={newAccount.proxy}
              onChange={(e) => setNewAccount({...newAccount, proxy: e.target.value})}
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white"
              disabled={isAdding}
            />
          </div>
          <div className="bg-yellow-900/20 border border-yellow-600/30 p-3 rounded">
            <div className="text-yellow-400 text-sm">
              ⚠️ <strong>Security Notice:</strong> Your credentials are used only to log into Facebook browsers. 
              They are not stored permanently and are only used for automation.
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={addAccount} 
              disabled={!newAccount.email || !newAccount.password || isAdding}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded flex items-center space-x-2"
            >
              {isAdding && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isAdding ? 'Adding...' : 'Add Account'}</span>
            </button>
            <button 
              onClick={() => setShowAddForm(false)} 
              disabled={isAdding}
              className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        {accounts.map(account => (
          <div key={account.id} className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <span className="font-medium truncate">{account.email || account.username}</span>
                {account.profileName && (
                  <div className="text-xs text-green-400">👤 {account.profileName}</div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  account.loginStatus === 'verified' ? 'bg-green-400' :
                  account.loginStatus === 'failed' ? 'bg-red-400' :
                  'bg-yellow-400'
                }`} title={`Login: ${account.loginStatus || 'pending'}`} />
                <div className={`w-3 h-3 rounded-full ${
                  account.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                }`} title={`Status: ${account.status}`} />
                <button
                  onClick={() => setSelectedAccount(account)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => removeAccount(account.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex items-center space-x-1">
                <Globe size={10} />
                <span className="truncate">{account.proxy || 'No proxy'}</span>
              </div>
              <div>{account.lastAction}</div>
              {account.loginError && (
                <div className="text-red-400">❌ {account.loginError}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Account Details Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Account Details</h3>
              <button
                onClick={() => setSelectedAccount(null)}
                className="text-gray-400 hover:text-white"
              >
                <EyeOff size={20} />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Username:</span>
                  <div className="font-medium">{selectedAccount.username}</div>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <div className={`font-medium ${selectedAccount.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedAccount.status}
                  </div>
                </div>
              </div>
              
              <div>
                <span className="text-gray-400">Proxy:</span>
                <div className="font-medium">{selectedAccount.proxy}</div>
              </div>
              
              <div>
                <span className="text-gray-400">Last Action:</span>
                <div className="font-medium">{selectedAccount.lastAction}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Total Likes:</span>
                  <div className="font-medium">{selectedAccount.totalLikes || 0}</div>
                </div>
                <div>
                  <span className="text-gray-400">Session Time:</span>
                  <div className="font-medium">{selectedAccount.sessionTime || '0m'}</div>
                </div>
              </div>
              
              <div>
                <span className="text-gray-400">Created:</span>
                <div className="font-medium">{selectedAccount.createdAt || 'Unknown'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}