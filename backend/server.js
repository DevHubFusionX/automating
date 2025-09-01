// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const FacebookManager = require('./facebook-manager');
const { connectDB } = require('./database');

const app = express();
const PORT = 3001;

// Connect to MongoDB Atlas
connectDB();

app.use(cors());
app.use(express.json());

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8080 });

// Facebook automation manager
const fbManager = new FacebookManager();
fbManager.setHeadlessMode(true); // Default to headless

// Load accounts from database on startup
setTimeout(async () => {
  try {
    await fbManager.loadAccountsFromDB();
    console.log('📚 [STARTUP] Accounts loaded from database');
  } catch (error) {
    console.error('❌ [STARTUP] Failed to load accounts:', error);
  }
}, 2000);

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// API Routes
app.post('/api/system/start', async (req, res) => {
  try {
    await fbManager.startSystem();
    broadcast({ type: 'SYSTEM_STARTED' });
    res.json({ success: true, message: 'System started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/stop', async (req, res) => {
  try {
    await fbManager.stopSystem();
    broadcast({ type: 'SYSTEM_STOPPED' });
    res.json({ success: true, message: 'System stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts/add', async (req, res) => {
  try {
    const { email, password, proxy } = req.body;
    const account = await fbManager.addAccount(email, password, proxy);
    broadcast({ type: 'ACCOUNT_ADDED', account });
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    await fbManager.loadAccountsFromDB(true, true); // Silent load with status preservation
    res.json(fbManager.getAccounts());
  } catch (error) {
    console.error('❌ [API] Error loading accounts:', error);
    res.json([]);
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const accountId = req.params.id;
    await fbManager.removeAccount(accountId);
    broadcast({ type: 'ACCOUNT_REMOVED', accountId });
    res.json({ success: true, message: 'Account removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry account login
app.post('/api/accounts/:id/retry', async (req, res) => {
  try {
    const accountId = req.params.id;
    const account = fbManager.accounts.find(acc => acc.id === accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    
    fbManager.initializeAccount(account).catch(error => {
      console.error(`❌ [RETRY] Failed to retry ${account.email}:`, error.message);
    });
    
    res.json({ success: true, message: 'Account retry initiated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry all failed accounts
app.post('/api/system/retry-failed', async (req, res) => {
  try {
    const failedAccounts = fbManager.accounts.filter(acc => 
      acc.loginStatus === 'failed' || acc.loginStatus === 'captcha_required'
    );
    
    for (const account of failedAccounts) {
      fbManager.initializeAccount(account).catch(error => {
        console.error(`❌ [RETRY] Failed to retry ${account.email}:`, error.message);
      });
    }
    
    res.json({ success: true, message: `Retrying ${failedAccounts.length} failed accounts` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle headless mode
app.post('/api/system/headless-mode', async (req, res) => {
  try {
    const { headless } = req.body;
    fbManager.setHeadlessMode(headless);
    res.json({ 
      success: true, 
      message: `Headless mode ${headless ? 'enabled' : 'disabled'}. Restart system to apply.`,
      headless 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tag listener is automatically started with the system

app.post('/api/broadcast', async (req, res) => {
  try {
    const { postUrl } = req.body;
    const result = await fbManager.broadcastLike(postUrl);
    broadcast({ type: 'BROADCAST_SENT', result });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tag-keyword', async (req, res) => {
  try {
    const { keyword } = req.body;
    fbManager.setTagKeyword(keyword);
    console.log(`🏷️ [TAG] Keyword updated to: ${keyword}`);
    broadcast({ type: 'TAG_KEYWORD_UPDATED', keyword });
    res.json({ success: true, keyword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tag-keyword', async (req, res) => {
  try {
    const keyword = fbManager.getTagKeyword();
    res.json({ keyword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('🔗 [WS] Client connected');
  
  ws.on('close', () => {
    console.log('🔌 [WS] Client disconnected');
  });
});

// Set up Facebook manager event listeners
fbManager.on('tagDetected', (data) => {
  broadcast({ type: 'TAG_DETECTED', data });
});

fbManager.on('likeCompleted', (data) => {
  broadcast({ type: 'LIKE_COMPLETED', data });
});

fbManager.on('accountStatusChanged', (account) => {
  console.log(`📡 [WS] Broadcasting account status: ${account.email} - ${account.status}/${account.loginStatus}`);
  broadcast({ 
    type: 'ACCOUNT_STATUS_CHANGED', 
    account: {
      id: account.id,
      email: account.email,
      status: account.status,
      loginStatus: account.loginStatus,
      profileName: account.profileName,
      loginError: account.loginError,
      proxy: account.proxy,
      totalLikes: account.totalLikes,
      lastAction: account.lastAction
    }
  });
});

// Performance monitoring
let memoryLogCount = 0;
setInterval(() => {
  const memUsage = process.memoryUsage();
  memoryLogCount++;
  
  // Log memory every 30 seconds, but add more details every 5 minutes
  if (memoryLogCount % 10 === 0) { // Every 5 minutes (30s * 10)
    const accounts = fbManager.getAccounts();
    const onlineCount = accounts.filter(a => a.status === 'online').length;
    console.log(`📊 [PERF] Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB | Accounts: ${onlineCount}/${accounts.length} online | Browsers: ${fbManager.browsers?.size || 0}`);
  } else {
    console.log(`📊 [MEM] ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 [SYS] Shutting down gracefully...');
  try {
    await fbManager.cleanup();
    console.log('✅ [SYS] Cleanup completed');
  } catch (error) {
    console.error('❌ [SYS] Cleanup error:', error.message);
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 [SERVER] Auto-Liker API → :${PORT}`);
  console.log(`📡 [SERVER] WebSocket → :8080`);
  console.log(`💾 [SERVER] MongoDB Atlas connected`);
  console.log(`🧠 [SERVER] Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
  console.log(`✨ [SERVER] Ready for connections`);
});