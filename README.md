# Facebook Auto-Liker System

A comprehensive Facebook automation system that monitors for tagged posts and automatically likes them across multiple accounts.

## 🚀 Features

- **Multi-Account Management**: Handle multiple Facebook accounts simultaneously
- **Tag Detection**: Monitor for custom keywords (e.g., @autolike, @sushma)
- **Automatic Liking**: Auto-like posts when tags are detected
- **Session Persistence**: Save login sessions to database
- **Headless Operation**: Run in background without visible browsers
- **Real-time Dashboard**: Monitor account status and activity
- **Proxy Support**: Use different proxies for each account
- **Manual Controls**: Retry failed accounts, switch modes

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Puppeteer
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: MongoDB Atlas
- **Real-time**: WebSocket communication

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/DevHubFusionX/automating.git
cd automating
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../vite-project
npm install
```

4. Create `.env` file in backend directory:
```env
MONGODB_URI=your_mongodb_atlas_connection_string
```

## 🚀 Usage

1. Start the backend server:
```bash
cd backend
npm start
```

2. Start the frontend:
```bash
cd vite-project
npm run dev
```

3. Open http://localhost:5173 in your browser

## 🎛️ System Controls

- **🖥️ Visible Mode**: Enable for manual login setup
- **👻 Headless Mode**: Background operation (production)
- **🔄 Retry Failed**: Retry failed account logins
- **🏷️ Tag Configuration**: Set custom detection keywords

## 📋 Workflow

1. **Setup**: Add Facebook accounts with credentials
2. **Initial Login**: Use visible mode for manual login/2FA
3. **Production**: Switch to headless mode for background operation
4. **Monitoring**: Watch real-time dashboard for activity

## ⚠️ Important Notes

- Use responsibly and comply with Facebook's Terms of Service
- Accounts may require manual verification (CAPTCHA, 2FA)
- Sessions are encrypted and stored securely
- Proxy usage recommended for multiple accounts

## 🔧 Configuration

- **Tag Keywords**: Configure what triggers auto-liking
- **Account Management**: Add/remove accounts as needed
- **Proxy Settings**: Set unique proxies per account
- **Timing Controls**: Randomized delays for human-like behavior

## 📊 Monitoring

- Real-time account status updates
- Auto-like history tracking
- Memory usage monitoring
- WebSocket-based live updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is for educational purposes only. Use responsibly.