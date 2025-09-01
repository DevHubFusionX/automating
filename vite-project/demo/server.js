const puppeteer = require('puppeteer');
const express = require('express');
const WebSocket = require('ws');

class AutoLikeDemo {
  constructor() {
    this.browsers = [];
    this.accounts = [
      { name: 'TestAccount1', proxy: null, browser: null, page: null },
      { name: 'TestAccount2', proxy: null, browser: null, page: null },
      { name: 'TestAccount3', proxy: null, browser: null, page: null }
    ];
    this.isListening = false;
  }

  async startDemo() {
    console.log('🚀 Starting Auto-Like Demo...');
    console.log('📱 Opening browser instances...');

    for (let i = 0; i < this.accounts.length; i++) {
      const account = this.accounts[i];
      
      try {
        const browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--window-position=${i * 400},${i * 100}`,
            '--window-size=400,600'
          ]
        });

        const page = await browser.newPage();
        await page.goto('https://facebook.com');
        
        account.browser = browser;
        account.page = page;
        
        console.log(`✅ ${account.name} browser ready`);
        
        // Add demo content to show it's working
        await page.evaluate((accountName) => {
          document.body.innerHTML = `
            <div style="padding: 20px; font-family: Arial;">
              <h2>${accountName}</h2>
              <p>Status: <span style="color: green;">LOGGED IN</span></p>
              <p>Ready to auto-like posts...</p>
              <div id="activity" style="margin-top: 20px; padding: 10px; background: #f0f0f0;">
                <h3>Activity Log:</h3>
                <div id="logs"></div>
              </div>
            </div>
          `;
        }, account.name);
        
      } catch (error) {
        console.error(`❌ Failed to start ${account.name}:`, error.message);
      }
    }

    console.log('🎯 Demo ready - all accounts initialized');
    console.log('💡 Now run: node demo/tag-listener.js');
  }

  async simulateAutoLike(postUrl) {
    console.log(`📡 Broadcasting post to ${this.accounts.length} accounts...`);
    
    for (let i = 0; i < this.accounts.length; i++) {
      const account = this.accounts[i];
      const delay = 200 + Math.random() * 500; // Random delay 200-700ms
      
      setTimeout(async () => {
        try {
          if (account.page) {
            // Add activity to the demo page
            await account.page.evaluate((accountName, postUrl, delay) => {
              const logs = document.getElementById('logs');
              const logEntry = document.createElement('div');
              logEntry.innerHTML = `
                <p style="color: blue; margin: 5px 0;">
                  ${new Date().toLocaleTimeString()} - Liked post: ${postUrl} (${Math.round(delay)}ms delay)
                </p>
              `;
              logs.appendChild(logEntry);
              logs.scrollTop = logs.scrollHeight;
            }, account.name, postUrl, delay);
            
            console.log(`✅ ${account.name} liked (${Math.round(delay)}ms)`);
          }
        } catch (error) {
          console.error(`❌ ${account.name} failed:`, error.message);
        }
      }, delay);
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up browsers...');
    for (const account of this.accounts) {
      if (account.browser) {
        await account.browser.close();
      }
    }
  }
}

// Start the demo
const demo = new AutoLikeDemo();

async function main() {
  await demo.startDemo();
  
  // Keep process alive and listen for cleanup
  process.on('SIGINT', async () => {
    await demo.cleanup();
    process.exit(0);
  });

  // Simple web server to trigger likes
  const app = express();
  app.use(express.json());

  app.post('/trigger-like', async (req, res) => {
    const { postUrl } = req.body;
    await demo.simulateAutoLike(postUrl);
    res.json({ success: true, message: 'Auto-like triggered' });
  });

  app.listen(3001, () => {
    console.log('🌐 Demo server running on http://localhost:3001');
    console.log('📝 POST /trigger-like with {"postUrl": "https://facebook.com/post/123"}');
  });
}

main().catch(console.error);