# Auto-Liker Demo System

## Quick Start
```bash
npm install
npm run dev
```

## How It Works

### 🎯 System Tab
- **Start/Stop System**: Toggle the entire automation on/off
- **Configuration**: Adjust detection speed (0.5-1s) and random delays (200-700ms)
- **Live Stats**: View total likes, response times, uptime

### 👥 Accounts Tab
- **Add Account**: Username, password, proxy fields
- **Toggle Status**: Click green/red dots to set online/offline
- **View Details**: Eye icon shows full account info (stats, session time)
- **Remove**: Trash icon deletes accounts

### 📊 Dashboard Tab
- **Broadcast Post**: Enter post URL → system sends to all online accounts
- **Account Status**: Left sidebar shows all accounts with proxy info
- **Live Feed**: Real-time activity log of account actions
- **Recent Broadcasts**: Table of sent posts with like counts

### 🎮 Post Simulator Tab
- **Mock Social Feed**: Click posts to select them
- **Trigger Likes**: Button sends selected post to all online accounts
- **Live Animation**: Watch accounts like posts with realistic delays
- **Liked By List**: See which accounts liked each post

## Key Features

### Status Dots
- 🟢 **Green** = Online (will participate in auto-likes)
- 🔴 **Red** = Offline (won't participate)
- **Click any dot** to toggle status

### Auto-Like Flow
1. **System must be running** (System tab)
2. **Accounts must be online** (green dots)
3. **Broadcast post** or **trigger simulator**
4. **All online accounts like** with 200-700ms random delays

### Real-Time Updates
- Account stats update when they like posts
- Live activity feed shows all actions
- Broadcast table shows like counts
- System stats track performance

## Demo Logic
- **Detection**: 0.5-1 second to find new posts
- **Broadcasting**: Instant to all accounts
- **Execution**: 200-700ms random delays per account
- **Parallel Processing**: All accounts act simultaneously