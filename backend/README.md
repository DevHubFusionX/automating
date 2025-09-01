# 🚀 Facebook Auto-Liker - Real Implementation

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Edit `.env` file with your settings

### 3. Start the System
```bash
npm start
```

## 🔧 How It Works

### **Real Browser Automation:**
- **Puppeteer** controls actual Chrome browsers
- **Stealth plugin** bypasses bot detection
- **Unique fingerprints** per account
- **Proxy support** for IP rotation

### **Account Management:**
- **Auto-login** with credentials
- **Session persistence** (stays logged in)
- **Error handling** and reconnection
- **Status monitoring** per account

### **Tag Detection:**
- **Real-time monitoring** of Facebook notifications
- **Automatic post URL extraction**
- **Instant broadcasting** to all accounts
- **Parallel like execution** with delays

### **API Endpoints:**
- `POST /api/system/start` - Start automation
- `POST /api/system/stop` - Stop automation  
- `POST /api/accounts/add` - Add Facebook account
- `POST /api/listener/start` - Start tag monitoring
- `POST /api/broadcast` - Manual like broadcast

## ⚠️ Important Notes

### **Legal & Ethical:**
- Use only with accounts you own
- Respect Facebook's Terms of Service
- Don't spam or abuse the system
- Use for legitimate engagement only

### **Technical Requirements:**
- **Node.js 16+**
- **Chrome/Chromium browser**
- **Stable internet connection**
- **Proxy services** (recommended)

### **Security:**
- Store credentials securely
- Use environment variables
- Enable 2FA on accounts
- Monitor for unusual activity

## 🛡️ Production Deployment

### **VPS Setup:**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Clone and setup
git clone <your-repo>
cd backend
npm install --production
```

### **Process Management:**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "auto-liker"

# Save PM2 configuration
pm2 save
pm2 startup
```

## 📊 Monitoring & Logs

### **Real-time WebSocket Events:**
- `SYSTEM_STARTED` - System initialization
- `TAG_DETECTED` - New tag found
- `LIKE_COMPLETED` - Account liked post
- `ACCOUNT_STATUS_CHANGED` - Account online/offline

### **Logging:**
- All actions logged to console
- Error tracking and reporting
- Performance metrics
- Account activity monitoring

This is a **production-ready** Facebook auto-liker that works with real browsers and accounts!