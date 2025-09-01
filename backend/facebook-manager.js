const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const EventEmitter = require('events');
const { Account } = require('./database');

puppeteer.use(StealthPlugin());

// Anti-detection configuration
const HUMAN_DELAYS = {
  typing: { min: 50, max: 150 },
  click: { min: 100, max: 300 },
  navigation: { min: 2000, max: 5000 },
  like: { min: 1000, max: 3000 }
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function randomDelay(type) {
  const range = HUMAN_DELAYS[type];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

class FacebookManager extends EventEmitter {
  constructor() {
    super();
    this.accounts = [];
    this.browsers = new Map();
    this.isSystemRunning = false;
    this.isListening = false;
    this.processedPosts = new Set();
    this.tagKeyword = '@autolike'; // Default tag keyword
    this.headlessMode = true; // Default to headless
  }

  async loadAccountsFromDB(silent = false, preserveStatus = false) {
    try {
      const dbAccounts = await Account.find({});
      
      if (preserveStatus && this.accounts.length > 0) {
        // Preserve existing runtime status when refreshing
        const existingAccounts = new Map(this.accounts.map(acc => [acc.id, acc]));
        
        this.accounts = dbAccounts.map(acc => {
          const existing = existingAccounts.get(acc._id.toString());
          return {
            id: acc._id.toString(),
            email: acc.email,
            password: acc.password,
            proxy: acc.proxy,
            status: existing?.status || 'offline',
            loginStatus: existing?.loginStatus || 'pending',
            profileName: existing?.profileName || acc.profileName,
            loginError: existing?.loginError || null,
            totalLikes: acc.totalLikes,
            lastAction: existing?.lastAction || 'Loaded from database',
            page: existing?.page
          };
        });
      } else {
        // Fresh load - set default status
        this.accounts = dbAccounts.map(acc => ({
          id: acc._id.toString(),
          email: acc.email,
          password: acc.password,
          proxy: acc.proxy,
          status: 'offline',
          loginStatus: 'pending',
          profileName: acc.profileName,
          loginError: null,
          totalLikes: acc.totalLikes,
          lastAction: 'Loaded from database'
        }));
      }
      
      if (!silent) {
        console.log(`📚 [DB] Loaded ${this.accounts.length} account(s): ${this.accounts.map(a => a.email).join(', ')}`);
      }
    } catch (error) {
      console.error('❌ [DB] Error loading accounts:', error.message);
    }
  }

  async startSystem() {
    if (this.isSystemRunning) {
      console.log('⚠️ [SYS] System already running');
      return;
    }
    
    console.log('🔄 [SYS] Starting Facebook Auto-Liker System...');
    this.isSystemRunning = true;
    
    // Load accounts from database
    await this.loadAccountsFromDB();
    
    // Initialize accounts with staggered timing (30s between each)
    console.log(`🔧 [SYS] Initializing ${this.accounts.length} account(s) with 30s intervals...`);
    for (let i = 0; i < this.accounts.length; i++) {
      const account = this.accounts[i];
      console.log(`🕒 [SYS] Initializing account ${i + 1}/${this.accounts.length}: ${account.email}`);
      
      // Initialize account
      this.initializeAccount(account).catch(error => {
        console.error(`❌ [SYS] Failed to initialize ${account.email}:`, error.message);
      });
      
      // Wait 30 seconds before next account (except for last one)
      if (i < this.accounts.length - 1) {
        console.log(`⏳ [SYS] Waiting 30s before next account...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    // Wait for all status updates to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const onlineCount = this.accounts.filter(a => a.status === 'online').length;
    const verifiedCount = this.accounts.filter(a => a.loginStatus === 'verified').length;
    console.log(`✅ [SYS] System started - ${onlineCount}/${this.accounts.length} online, ${verifiedCount}/${this.accounts.length} verified`);
    
    // Auto-start tag listener - core functionality
    if (onlineCount > 0) {
      await this.startTagListener();
    }
    
    // Force refresh accounts in frontend without resetting status
    setTimeout(() => {
      this.accounts.forEach(account => {
        if (account.status === 'online' && account.loginStatus === 'verified') {
          this.emit('accountStatusChanged', account);
        }
      });
    }, 500);
  }

  async stopSystem() {
    if (!this.isSystemRunning) return;
    
    console.log('🛑 [SYS] Stopping system...');
    this.isSystemRunning = false;
    
    // Stop tag listener
    await this.stopTagListener();
    
    // Close all browsers
    for (const [accountId, browser] of this.browsers) {
      await browser.close();
    }
    this.browsers.clear();
    
    console.log('✅ [SYS] System stopped');
  }

  async addAccount(email, password, proxy = null) {
    try {
      // Save to database
      const dbAccount = new Account({
        email,
        password,
        proxy,
        status: 'offline',
        loginStatus: 'pending',
        profileName: null,
        totalLikes: 0,
        lastAction: 'Added to system'
      });
      
      const savedAccount = await dbAccount.save();
      console.log(`💾 [DB] Account saved: ${email}`);
      
      // Create runtime account object
      const account = {
        id: savedAccount._id.toString(),
        email: savedAccount.email,
        password: savedAccount.password,
        proxy: savedAccount.proxy,
        status: 'offline',
        loginStatus: 'pending',
        profileName: savedAccount.profileName,
        loginError: null,
        totalLikes: savedAccount.totalLikes,
        lastAction: 'Added to system'
      };
      
      this.accounts.push(account);
      
      if (this.isSystemRunning) {
        await this.initializeAccount(account);
      }
      
      return account;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Account with this email already exists');
      }
      throw error;
    }
  }

  async initializeAccount(account) {
    try {
      console.log(`🔄 [INIT] ${account.email}...`);
      
      const browserOptions = {
        headless: this.headlessMode ? 'new' : false,
        defaultViewport: this.headlessMode ? { width: 1366, height: 768 } : null,
        userDataDir: `./browser-data/${account.email.replace('@', '_')}`,
        timeout: 20000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-infobars',
          '--disable-translate',
          '--disable-notifications',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-default-apps',
          '--no-default-browser-check',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--aggressive-cache-discard',
          '--memory-pressure-off',
          '--disable-gpu',
          '--disable-software-rasterizer'
        ]
      };
      
      // Add proxy if provided
      if (account.proxy) {
        browserOptions.args.push(`--proxy-server=${account.proxy}`);
      }
      
      const browser = await puppeteer.launch(browserOptions);
      const page = await browser.newPage();
      
      // Set random user agent and viewport for headless mode
      await page.setUserAgent(getRandomUserAgent());
      await page.setViewport({
        width: 1366 + Math.floor(Math.random() * 200),
        height: 768 + Math.floor(Math.random() * 200)
      });
      
      // Enhanced anti-detection measures
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
        
        // Override the permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'granted' }) :
            originalQuery(parameters)
        );
      });
      
      // Set additional headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      // Step 1: Load session cookies from database
      await this.loadSessionCookies(page, account);
      
      // Step 2: Check login status using profile page
      const loginStatus = await this.checkLoginStatus(page, account);
      
      if (loginStatus === 'logged_in') {
        console.log(`✅ [SESSION] ${account.email} - Active session confirmed`);
        account.loginStatus = 'verified';
        account.status = 'online';
        
        // Save/update session cookies
        await this.saveSessionCookies(page, account);
        
        const accountIndex = this.accounts.findIndex(acc => acc.id === account.id);
        if (accountIndex !== -1) {
          this.accounts[accountIndex] = account;
        }
        
        this.browsers.set(account.id, browser);
        account.page = page;
        
        // Start heartbeat monitoring
        this.startHeartbeat(account);
        
        this.emit('accountStatusChanged', account);
        setTimeout(() => {
          this.emit('accountStatusChanged', account);
        }, 500);
        
        return; // Exit early - session active
      } else if (loginStatus === 'session_expired') {
        console.log(`⚠️ [SESSION] ${account.email} - Session expired, attempting re-login`);
        // Continue to fallback login
      }
      
      // Step 3: Attempt fallback re-login if session expired
      const reLoginResult = await this.triggerReLogin(page, account);
      
      if (reLoginResult === 'success') {
        console.log(`✅ [RELOGIN] ${account.email} - Automatic re-login successful`);
        account.loginStatus = 'verified';
        account.status = 'online';
        
        await this.saveSessionCookies(page, account);
        this.startHeartbeat(account);
      } else {
        // Any failure (verification needed, failed, etc.) = manual login required
        console.log(`👤 [LOGIN] ${account.email} - Opening browser for manual login`);
        account.loginStatus = 'captcha_required';
        account.status = 'offline';
        account.loginError = 'Please login manually in browser';
        
        if (this.headlessMode) {
          console.log(`❌ [LOGIN] ${account.email} - Manual login required but running in headless mode`);
          account.loginStatus = 'failed';
          account.status = 'offline';
          account.loginError = 'Manual login required - switch to visible mode for setup';
        } else {
          try {
            await page.goto('https://facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 5000 });
            console.log(`🌐 [LOGIN] ${account.email} - Browser ready for manual login`);
            account.loginStatus = 'captcha_required';
            account.loginError = 'Complete login manually in browser';
          } catch (error) {
            console.log(`⚠️ [LOGIN] ${account.email} - Browser opened, manual login available`);
            account.loginStatus = 'captcha_required';
            account.loginError = 'Complete login manually in browser';
          }
        }
      }
      
      this.browsers.set(account.id, browser);
      account.page = page;
      
      // Set status immediately after login verification
      if (account.loginStatus === 'verified') {
        account.status = 'online';
        console.log(`✅ [INIT] ${account.email} - Ready (${account.status}/${account.loginStatus})`);
      } else {
        account.status = 'offline';
        console.log(`❌ [INIT] ${account.email} - Failed (${account.status}/${account.loginStatus})`);
      }
      
      // Update the account in the accounts array immediately
      const accountIndex = this.accounts.findIndex(acc => acc.id === account.id);
      if (accountIndex !== -1) {
        this.accounts[accountIndex] = account;
      }
      
      // Emit status change immediately and again after delay
      this.emit('accountStatusChanged', account);
      setTimeout(() => {
        this.emit('accountStatusChanged', account);
      }, 500);
      
    } catch (error) {
      console.error(`❌ [INIT] ${account.email}: ${error.message}`);
      account.status = 'offline';
      account.loginStatus = 'failed';
      account.loginError = error.message.includes('timeout') ? 'Connection timeout' : error.message;
      
      // Update the account in the accounts array
      const accountIndex = this.accounts.findIndex(acc => acc.id === account.id);
      if (accountIndex !== -1) {
        this.accounts[accountIndex] = account;
      }
      
      this.emit('accountStatusChanged', account);
    }
  }

  async manualLogin(page, account) {
    try {
      console.log(`🔓 [LOGIN] ${account.email} - Manual login required`);
      
      // Navigate to Facebook login with shorter timeout
      try {
        await page.goto('https://facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log(`⚠️ [LOGIN] ${account.email} - Login page timeout`);
        throw new Error('Login page navigation timeout');
      }
      
      account.loginStatus = 'captcha_required'; // Show as requiring manual action
      
      // Wait up to 3 minutes for manual login (reduced from 5 minutes)
      let loginCompleted = false;
      const maxAttempts = 36; // 36 * 5 seconds = 3 minutes
      
      for (let i = 0; i < maxAttempts; i++) {
        await page.waitForTimeout(5000);
        
        // Only log every 6 attempts to reduce spam (every 30 seconds)
        if (i % 6 === 0 || i < 2) {
          console.log(`⏳ [LOGIN] ${account.email} - Manual login required ${i + 1}/${maxAttempts} (${Math.round((i + 1) * 5 / 60 * 100)}%)`);
        }
        
        // Check if logged in - multiple verification methods
        const currentUrl = page.url();
        
        // Method 1: URL check
        const urlOk = currentUrl.includes('facebook.com') && 
                     !currentUrl.includes('login') && 
                     !currentUrl.includes('checkpoint') &&
                     !currentUrl.includes('two_step_verification') &&
                     !currentUrl.includes('captcha');
        
        if (urlOk) {
          // Method 2: Check for authenticated elements
          const authElements = await page.evaluate(() => {
            const selectors = [
              '[data-testid="blue_bar_profile_link"]',
              '[aria-label="Account"]',
              '[data-testid="nav_search"]',
              '[data-testid="left_nav_explore_link"]',
              'div[role="banner"]'
            ];
            
            for (const selector of selectors) {
              if (document.querySelector(selector)) {
                return selector;
              }
            }
            return null;
          });
          
          // Method 3: Content analysis
          const hasAuthContent = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            return !bodyText.includes('Log in to Facebook') && 
                   !bodyText.includes('Sign up for Facebook') &&
                   (bodyText.includes('News Feed') || 
                    bodyText.includes('What\'s on your mind') ||
                    bodyText.includes('Home') ||
                    bodyText.length > 5000); // Logged in pages have more content
          });
          
          if (authElements || hasAuthContent) {
            console.log(`✅ [LOGIN] ${account.email} - Success via ${authElements || 'content analysis'}`);
            loginCompleted = true;
            break;
          }
        }
      }
      
      if (!loginCompleted) {
        // Final check - maybe we missed it
        const finalUrl = page.url();
        const finalCheck = await page.evaluate(() => {
          return !document.body.innerText.includes('Log in to Facebook');
        });
        
        if (finalCheck && finalUrl.includes('facebook.com') && !finalUrl.includes('login')) {
          console.log(`✅ [LOGIN] ${account.email} - Success (final check)`);
          loginCompleted = true;
        } else {
          throw new Error('Manual login timeout (5 minutes)');
        }
      }
      
      account.loginStatus = 'verified';
      account.status = 'online';
      
      // Update the account in the accounts array immediately
      const accountIndex = this.accounts.findIndex(acc => acc.id === account.id);
      if (accountIndex !== -1) {
        this.accounts[accountIndex] = account;
      }
      
      // Get profile name
      await this.extractProfileName(page, account);
      
      return true;
      
    } catch (error) {
      console.error(`❌ [LOGIN] ${account.email}: ${error.message}`);
      account.loginStatus = 'failed';
      account.status = 'offline';
      account.loginError = error.message;
      throw error;
    }
  }

  async loginToFacebook(page, account) {
    try {
      console.log(`🔐 Attempting login for ${account.email}...`);
      
      // Navigate to Facebook login page
      await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
      
      // Check if already logged in by looking for profile elements
      const profileElement = await page.$('[data-testid="blue_bar_profile_link"]') || 
                            await page.$('[aria-label="Account"]') ||
                            await page.$('[data-testid="nav_search"]');
      
      if (profileElement) {
        console.log(`✅ ${account.email} already logged in`);
        account.loginStatus = 'verified';
        return true;
      }
      
      // Look for login form
      const loginForm = await page.$('#loginform') || await page.$('[data-testid="royal_login_form"]');
      if (!loginForm) {
        throw new Error('Login form not found');
      }
      
      // Human-like typing with delays
      const emailField = await page.$('#email');
      if (emailField) {
        await emailField.click();
        await page.waitForTimeout(randomDelay('click'));
        await emailField.click({ clickCount: 3 });
        await page.waitForTimeout(randomDelay('typing'));
        await emailField.type(account.email, { delay: randomDelay('typing') });
      }
      
      await page.waitForTimeout(randomDelay('typing'));
      
      const passwordField = await page.$('#pass');
      if (passwordField) {
        await passwordField.click();
        await page.waitForTimeout(randomDelay('click'));
        await passwordField.click({ clickCount: 3 });
        await page.waitForTimeout(randomDelay('typing'));
        await passwordField.type(account.password, { delay: randomDelay('typing') });
      }
      
      // Click login button
      const loginButton = await page.$('[name="login"]') || await page.$('[data-testid="royal_login_button"]');
      if (loginButton) {
        await loginButton.click();
      }
      
      // Wait for navigation and check for various login scenarios
      await page.waitForTimeout(3000);
      
      console.log(`🔍 Current URL: ${page.url()}`);
      
      // Check for 2FA/Security check first
      const currentUrl = page.url();
      let needsManualAction = false;
      
      // Check URL for 2FA/security pages
      if (currentUrl.includes('two_step_verification') || 
          currentUrl.includes('checkpoint') || 
          currentUrl.includes('captcha') ||
          currentUrl.includes('security_check')) {
        needsManualAction = true;
        console.log(`🔐 2FA/Security page detected in URL: ${currentUrl}`);
      }
      
      // Also check for security elements on page
      if (!needsManualAction) {
        const securitySelectors = [
          '[data-testid="captcha_response_input_field"]',
          '.captcha_input',
          '#captcha_response',
          '[aria-label*="captcha"]',
          '[aria-label*="CAPTCHA"]',
          '[data-testid="checkpoint_title"]',
          'input[name="approvals_code"]',
          'input[placeholder*="code"]',
          'div[data-testid="checkpoint_subtitle"]',
          'input[name="verification_method"]',
          'button[name="submit[Continue]"]'
        ];
        
        for (const selector of securitySelectors) {
          const element = await page.$(selector);
          if (element) {
            needsManualAction = true;
            console.log(`🔐 Security element found: ${selector}`);
            break;
          }
        }
      }
      
      if (needsManualAction) {
        console.log(`🔐 Security check/2FA detected for ${account.email} - waiting for manual completion...`);
        account.loginStatus = 'captcha_required';
        
        // Wait up to 3 minutes for manual completion
        let securityResolved = false;
        for (let i = 0; i < 36; i++) { // 36 * 5 seconds = 3 minutes
          await page.waitForTimeout(5000);
          
          console.log(`⏳ Waiting for security completion... ${i + 1}/36`);
          
          // Check if we're now on Facebook main page
          const newUrl = page.url();
          if (newUrl.includes('facebook.com') && 
              !newUrl.includes('login') && 
              !newUrl.includes('checkpoint') &&
              !newUrl.includes('captcha') &&
              !newUrl.includes('two_step_verification') &&
              !newUrl.includes('security_check')) {
            
            // Double check with success indicators
            const successElement = await page.$('[data-testid="blue_bar_profile_link"]') ||
                                  await page.$('[aria-label="Account"]') ||
                                  await page.$('[data-testid="nav_search"]') ||
                                  await page.$('div[role="main"]');
            
            if (successElement) {
              console.log(`✅ Security check completed successfully`);
              securityResolved = true;
              break;
            }
          }
        }
        
        if (!securityResolved) {
          throw new Error('Security check not completed within 3 minutes');
        }
        
        // After security completion, check if we're back on login page
        const postSecurityUrl = page.url();
        if (postSecurityUrl.includes('login')) {
          console.log(`⚠️ Redirected back to login after 2FA - credentials may be incorrect`);
          throw new Error('2FA completed but redirected to login - check credentials');
        }
      }
      
      // Final verification - wait a bit more and check login success
      await page.waitForTimeout(2000);
      
      // Navigate to Facebook home to ensure we're properly logged in
      try {
        await page.goto('https://facebook.com', { waitUntil: 'networkidle2', timeout: 15000 });
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log('Navigation to home failed, checking current state...');
      }
      
      // More reliable login success detection
      let loginSuccess = false;
      let foundSelector = null;
      
      // First check: Must NOT be on login/security page
      const finalUrl = page.url();
      const isOnSecurityPage = finalUrl.includes('login') || 
                              finalUrl.includes('checkpoint') ||
                              finalUrl.includes('two_step_verification') ||
                              finalUrl.includes('captcha') ||
                              finalUrl.includes('security_check');
      
      if (!isOnSecurityPage) {
        // Second check: Look for authenticated user elements
        const authIndicators = [
          '[data-testid="blue_bar_profile_link"]',
          '[aria-label="Account"]', 
          '[data-testid="nav_search"]',
          '[data-testid="left_nav_explore_link"]'
        ];
        
        for (const selector of authIndicators) {
          try {
            const element = await page.$(selector);
            if (element) {
              // Double verify by checking if element is actually visible and functional
              const isVisible = await element.isIntersectingViewport();
              if (isVisible) {
                loginSuccess = true;
                foundSelector = selector;
                console.log(`✅ Found authenticated indicator: ${selector}`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // Third check: Verify we can access authenticated content
        if (!loginSuccess) {
          try {
            const pageContent = await page.content();
            const hasLoginForm = pageContent.includes('name="email"') || pageContent.includes('name="login"');
            const hasAuthContent = pageContent.includes('News Feed') || pageContent.includes('What\'s on your mind');
            
            if (!hasLoginForm && hasAuthContent) {
              loginSuccess = true;
              foundSelector = 'content analysis';
              console.log(`✅ Login success detected via content analysis`);
            }
          } catch (e) {
            console.log('Content analysis failed:', e.message);
          }
        }
      }
      
      // Final URL verification (only if other checks passed)
      if (!loginSuccess && finalUrl.includes('facebook.com') && 
          !finalUrl.includes('login') && 
          !finalUrl.includes('checkpoint') &&
          !finalUrl.includes('two_step_verification') &&
          !finalUrl.includes('captcha') &&
          !finalUrl.includes('recover')) {
        
        // Make sure we're actually on a Facebook page with content
        try {
          const hasRealContent = await page.evaluate(() => {
            return document.body.innerText.length > 1000 && 
                   !document.body.innerText.includes('Log in to Facebook');
          });
          
          if (hasRealContent) {
            console.log(`✅ Login success detected by URL and content: ${finalUrl}`);
            loginSuccess = true;
            foundSelector = 'URL + content check';
          }
        } catch (e) {
          console.log('Final verification failed:', e.message);
        }
      }
      
      // Check for error messages
      const errorElement = await page.$('[data-testid="royal_login_error"]') ||
                          await page.$('.login_error_box');
      
      if (errorElement) {
        const errorText = await errorElement.evaluate(el => el.textContent);
        throw new Error(`Login error: ${errorText}`);
      }
      
      if (loginSuccess) {
        console.log(`✅ ${account.email} logged in successfully (via ${foundSelector})`);
        account.loginStatus = 'verified';
        
        // Get profile name
        await this.extractProfileName(page, account);
        
        // Start monitoring if listener is already running
        if (this.isListening) {
          console.log(`🔍 Starting tag monitoring for newly logged in account: ${account.email}`);
          this.monitorNotifications(account);
        }
        
        return true;
      } else {
        // Check if we're on login page after all attempts
        const finalCheckUrl = page.url();
        if (finalCheckUrl.includes('login')) {
          throw new Error('Login failed - redirected back to login page (check credentials)');
        } else {
          throw new Error('Login verification failed - no success indicators found');
        }
      }
      
    } catch (error) {
      console.error(`❌ Login failed for ${account.email}:`, error.message);
      account.loginStatus = 'failed';
      account.loginError = error.message;
      throw error;
    }
  }

  async extractProfileName(page, account) {
    try {
      await page.waitForTimeout(1000);
      
      // Try to get name from current page (both desktop and mobile)
      let profileName = await page.evaluate(() => {
        const selectors = [
          // Desktop selectors
          '[data-testid="blue_bar_profile_link"] span',
          '[aria-label="Account"] span',
          'div[role="button"][aria-label*="Account"] span',
          // Mobile selectors
          '[data-testid="mweb-navbar-profile"] span',
          // Profile page selectors
          'h1[data-testid="profile_name_in_profile_page"]',
          'h1',
          // Generic selectors
          'title'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const text = element.textContent.trim();
            if (text && text.length > 1 && 
                !text.toLowerCase().includes('account') && 
                !text.toLowerCase().includes('log in') &&
                !text.toLowerCase().includes('facebook')) {
              return text;
            }
          }
        }
        
        // Try to extract from page title
        const title = document.title;
        if (title && !title.includes('Facebook') && !title.includes('Log in')) {
          const cleanTitle = title.replace(' | Facebook', '').trim();
          if (cleanTitle.length > 1) {
            return cleanTitle;
          }
        }
        
        return null;
      });
      
      account.profileName = profileName || 'Facebook User';
      console.log(`👤 Profile name: ${account.profileName}`);
      
    } catch (e) {
      console.log('Profile name extraction failed:', e.message);
      account.profileName = 'Facebook User';
    }
  }

  async startTagListener() {
    if (this.isListening) {
      console.log('⚠️ [LISTENER] Already running');
      return;
    }
    
    console.log('👂 [LISTENER] Starting tag listener...');
    this.isListening = true;
    
    const readyAccounts = this.accounts.filter(acc => 
      acc.status === 'online' && acc.loginStatus === 'verified' && acc.page
    );
    
    console.log(`🔍 [LISTENER] Monitoring ${readyAccounts.length}/${this.accounts.length} accounts`);
    
    // Monitor notifications for all verified accounts
    for (const account of readyAccounts) {
      this.monitorNotifications(account);
    }
    
    // Log skipped accounts
    const skippedAccounts = this.accounts.filter(acc => 
      !(acc.status === 'online' && acc.loginStatus === 'verified' && acc.page)
    );
    
    if (skippedAccounts.length > 0) {
      console.log(`⚠️ [LISTENER] Skipped ${skippedAccounts.length} accounts: ${skippedAccounts.map(a => `${a.email}(${a.status}/${a.loginStatus})`).join(', ')}`);
    }
  }

  async stopTagListener() {
    if (!this.isListening) {
      console.log('⚠️ [LISTENER] Not running');
      return;
    }
    
    console.log('🛑 [LISTENER] Stopping...');
    this.isListening = false;
    
    console.log('✅ [LISTENER] Stopped');
  }

  async scanNow() {
    if (!this.isListening) {
      throw new Error('Tag listener is not running');
    }
    
    const readyAccounts = this.accounts.filter(acc => 
      acc.status === 'online' && acc.loginStatus === 'verified' && acc.page
    );
    
    console.log(`🔍 [SCAN] Manual scan - ${readyAccounts.length} accounts`);
    
    // Immediately check notifications for all accounts
    for (const account of readyAccounts) {
      await this.checkNotifications(account);
    }
    
    console.log('✅ [SCAN] Completed');
  }

  async monitorNotifications(account) {
    if (!account.page || !this.isListening) return;
    
    try {
      console.log(`👂 [MONITOR] ${account.email} - Started`);
      
      // Monitor notifications page for mentions/tags
      const monitorNotifications = async () => {
        if (!this.isListening) return;
        
        try {
          await this.checkNotifications(account);
        } catch (error) {
          console.error(`❌ [MONITOR] ${account.email}: ${error.message}`);
        }
        
        // Continue monitoring every 2 seconds for faster detection
        setTimeout(monitorNotifications, 2000);
      };
      
      monitorNotifications();
      
    } catch (error) {
      console.error(`❌ [MONITOR] Failed to start for ${account.email}: ${error.message}`);
    }
  }
  
  async checkNotifications(account) {
    try {
      // Navigate to notifications page using same tab
      const currentUrl = account.page.url();
      if (!currentUrl.includes('/notifications')) {
        await account.page.goto('https://facebook.com/notifications', { waitUntil: 'domcontentloaded' });
        await account.page.waitForTimeout(2000);
      }
      
      // Get notification data using page.evaluate for better reliability
      const notificationData = await account.page.evaluate(() => {
        const notifications = [];
        
        // Look for notification elements with various selectors
        const notificationSelectors = [
          '[role="article"]',
          '[data-testid="notification"]',
          'div[data-testid]',
          '.notificationContent',
          'li[data-testid]'
        ];
        
        let allNotifications = [];
        for (const selector of notificationSelectors) {
          const elements = document.querySelectorAll(selector);
          allNotifications = allNotifications.concat(Array.from(elements));
        }
        
        // Remove duplicates
        allNotifications = [...new Set(allNotifications)];
        
        for (const notification of allNotifications) {
          const text = (notification.textContent || '').toLowerCase();
          
          // Check for mention/tag notifications or specific keyword
          if (text.includes('tagged you') || 
              text.includes('mentioned you') ||
              text.includes('tagged you in') ||
              text.includes('mentioned you in') ||
              text.includes(this.tagKeyword.toLowerCase())) {
            
            // Find the post link within this notification
            const links = notification.querySelectorAll('a[href]');
            let postLink = null;
            
            for (const link of links) {
              const href = link.href;
              if (href && href.includes('facebook.com') && 
                  (href.includes('/posts/') || 
                   href.includes('/photo') || 
                   href.includes('permalink') ||
                   href.includes('story_fbid'))) {
                postLink = href;
                break;
              }
            }
            
            if (postLink) {
              notifications.push({
                text: text.substring(0, 200),
                link: postLink,
                timestamp: Date.now()
              });
            }
          }
        }
        
        return {
          totalNotifications: allNotifications.length,
          tagNotifications: notifications
        };
      });
      
      // Only log if there are notifications to avoid spam
      if (notificationData.tagNotifications.length > 0) {
        console.log(`📝 [NOTIF] ${account.email}: ${notificationData.tagNotifications.length} tags found`);
      }
      
      // Process each tag notification
      for (const notification of notificationData.tagNotifications) {
        console.log(`🎯 [TAG] ${account.email}: "${notification.text.substring(0, 50)}..."`);
        console.log(`🔗 [TAG] Link: ${notification.link}`);
        
        // Avoid duplicate processing
        if (!this.processedPosts) this.processedPosts = new Set();
        if (this.processedPosts.has(notification.link)) {
          console.log(`⚠️ [TAG] Duplicate: ${notification.link}`);
          continue;
        }
        
        this.processedPosts.add(notification.link);
        
        console.log(`✅ [TAG] New detection → Broadcasting`);
        this.emit('tagDetected', { account: account.email, postUrl: notification.link });
        
        // Auto-broadcast to all accounts
        await this.broadcastLike(notification.link);
      }
      
    } catch (error) {
      console.error(`❌ [NOTIF] ${account.email}: ${error.message}`);
    }
  }
  
  async scanNewsFeed(account) {
    try {
      console.log(`🔍 Scanning news feed for ${account.email}`);
      
      // Always navigate to home feed for scanning
      const currentUrl = account.page.url();
      console.log(`🔗 Current URL before navigation: ${currentUrl}`);
      
      if (!currentUrl.includes('facebook.com') || 
          currentUrl.includes('login') || 
          currentUrl.includes('notifications') ||
          currentUrl.includes('profile') ||
          !currentUrl.includes('facebook.com/') || 
          currentUrl === 'https://facebook.com' ||
          currentUrl === 'https://web.facebook.com') {
        
        console.log('🏠 Navigating to Facebook home feed...');
        await account.page.goto('https://facebook.com/', { waitUntil: 'networkidle2' });
        await account.page.waitForTimeout(3000);
        
        const newUrl = account.page.url();
        console.log(`🔗 New URL after navigation: ${newUrl}`);
      }
      
      // Scroll to load fresh posts
      await account.page.evaluate(() => {
        window.scrollTo(0, 200);
      });
      
      await account.page.waitForTimeout(1000);
      
      // First, let's see what's actually on the page
      const pageInfo = await account.page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 500),
          hasArticles: document.querySelectorAll('[role="article"]').length,
          hasDataTestid: document.querySelectorAll('[data-testid]').length,
          allDivs: document.querySelectorAll('div').length
        };
      });
      
      console.log('📄 Page info:', pageInfo);
      
      // Try comprehensive selectors
      const postSelectors = [
        'div[role="article"]',
        'div[data-testid="story-subtitle"]', 
        'div[data-pagelet="FeedUnit"]',
        '[data-testid="story"]',
        '.userContentWrapper',
        '[data-ft]',
        'div[data-testid]',
        'div[aria-label]',
        'div:has(span:contains("@autolike"))',
        'div'
      ];
      
      let allPosts = [];
      for (const selector of postSelectors) {
        try {
          const posts = await account.page.$$(selector);
          if (posts.length > 0) {
            console.log(`✅ Selector '${selector}' found ${posts.length} elements`);
            allPosts = allPosts.concat(posts);
          }
        } catch (e) {
          console.log(`❌ Selector '${selector}' failed:`, e.message);
        }
      }
      
      // Remove duplicates
      allPosts = [...new Set(allPosts)];
      
      console.log(`📝 Found ${allPosts.length} total elements to scan`);
      
      // If still no posts, try a different approach
      if (allPosts.length === 0) {
        console.log('🔍 No posts found with selectors, trying text search...');
        
        const autolikeElements = await account.page.evaluate(() => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          const results = [];
          let node;
          
          while (node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(this.tagKeyword.toLowerCase()) || 
                node.textContent.toLowerCase().includes(this.tagKeyword.replace('@', '').toLowerCase())) {
              results.push({
                text: node.textContent.substring(0, 200),
                parentTag: node.parentElement?.tagName,
                parentClass: node.parentElement?.className
              });
            }
          }
          
          return results;
        });
        
        console.log('🎯 Found @autolike in text nodes:', autolikeElements);
        
        if (autolikeElements.length > 0) {
          // Found @autolike in text, create a synthetic detection
          const link = `${currentUrl}#text-detection-${Date.now()}`;
          
          if (!this.processedPosts) this.processedPosts = new Set();
          if (!this.processedPosts.has(link)) {
            this.processedPosts.add(link);
            
            console.log(`✅ ${this.tagKeyword} detected via text search: ${link}`);
            this.emit('tagDetected', { account: account.email, postUrl: link });
            
            await this.broadcastLike(link);
          }
        }
        
        return; // Skip the normal post scanning
      }
      
      // Use page.evaluate to scan all elements at once to avoid stale element issues
      const scanResults = await account.page.evaluate(() => {
        const results = {
          scannedCount: 0,
          foundAutolike: 0,
          autolikePosts: [],
          sampleTexts: []
        };
        
        // Get all divs on the page
        const allDivs = document.querySelectorAll('div');
        
        for (let i = 0; i < allDivs.length; i++) {
          const div = allDivs[i];
          results.scannedCount++;
          
          const text = (div.textContent || div.innerText || '').toLowerCase();
          
          // Sample first 5 posts for debugging
          if (results.sampleTexts.length < 5 && text.length > 20) {
            results.sampleTexts.push(text.substring(0, 100));
          }
          
          // Check for configured tag keyword
          if (text.includes(this.tagKeyword.toLowerCase()) || text.includes(this.tagKeyword.replace('@', '').toLowerCase())) {
            results.foundAutolike++;
            
            // Try to find a link in this element
            let link = null;
            const links = div.querySelectorAll('a[href]');
            
            for (const linkEl of links) {
              const href = linkEl.href;
              if (href && href.includes('facebook.com') && 
                  (href.includes('/posts/') || href.includes('/photo') || href.includes('permalink'))) {
                link = href;
                break;
              }
            }
            
            results.autolikePosts.push({
              text: text.substring(0, 200),
              link: link || `${window.location.href}#autolike-${Date.now()}-${results.foundAutolike}`
            });
          }
        }
        
        return results;
      });
      
      console.log(`📊 Scan results: ${scanResults.scannedCount} elements scanned, ${scanResults.foundAutolike} with @autolike`);
      
      // Log sample texts
      scanResults.sampleTexts.forEach((text, i) => {
        console.log(`📝 Sample ${i + 1}: "${text}..."`);
      });
      
      // Process found @autolike posts
      for (const autolikePost of scanResults.autolikePosts) {
        console.log(`🎯 Found @autolike: "${autolikePost.text}..."`);
        console.log(`🔗 Link: ${autolikePost.link}`);
        
        // Avoid duplicates
        if (!this.processedPosts) this.processedPosts = new Set();
        if (this.processedPosts.has(autolikePost.link)) {
          console.log(`⚠️ Skipping duplicate: ${autolikePost.link}`);
          continue;
        }
        
        this.processedPosts.add(autolikePost.link);
        
        console.log(`✅ ${this.tagKeyword} detected and processing: ${autolikePost.link}`);
        this.emit('tagDetected', { account: account.email, postUrl: autolikePost.link });
        
        // Auto-broadcast to all accounts
        await this.broadcastLike(autolikePost.link);
      }
      
      // If no @autolike found in posts, do a final page-wide search
      if (scanResults.foundAutolike === 0) {
        console.log('🔍 No @autolike found in posts, doing page-wide search...');
        
        const pageHasKeyword = await account.page.evaluate((keyword) => {
          const bodyText = document.body.innerText.toLowerCase();
          return bodyText.includes(keyword.toLowerCase()) || bodyText.includes(keyword.replace('@', '').toLowerCase());
        }, this.tagKeyword);
        
        if (pageHasKeyword) {
          console.log(`✅ Found ${this.tagKeyword} somewhere on page!`);
          const link = `${currentUrl}#page-detection-${Date.now()}`;
          
          if (!this.processedPosts) this.processedPosts = new Set();
          if (!this.processedPosts.has(link)) {
            this.processedPosts.add(link);
            
            console.log(`✅ ${this.tagKeyword} detected via page search: ${link}`);
            this.emit('tagDetected', { account: account.email, postUrl: link });
            
            await this.broadcastLike(link);
          }
        } else {
          console.log(`❌ No ${this.tagKeyword} found anywhere on page`);
        }
      } else {
        console.log(`✅ Successfully found and processed ${scanResults.foundAutolike} ${this.tagKeyword} posts`);
      }
    } catch (error) {
      console.error(`Error scanning news feed for ${account.email}:`, error.message);
    }
  }

  async broadcastLike(postUrl) {
    if (!this.isSystemRunning) return;
    
    const onlineAccounts = this.accounts.filter(acc => acc.status === 'online');
    
    console.log(`📡 [BROADCAST] ${postUrl.substring(0, 50)}... → ${onlineAccounts.length} accounts`);
    
    const results = [];
    
    // Execute all likes in parallel with minimal randomization (0-500ms)
    const likePromises = onlineAccounts.map((account, index) => {
      const randomDelay = Math.random() * 500; // 0-500ms randomization
      
      return new Promise(resolve => {
        setTimeout(async () => {
          try {
            const result = await this.likePost(account, postUrl);
            results.push(result);
            resolve(result);
          } catch (error) {
            console.error(`❌ [LIKE] ${account.email}: ${error.message}`);
            resolve({ account: account.email, success: false, error: error.message });
          }
        }, randomDelay);
      });
    });
    
    await Promise.all(likePromises);
    
    const successful = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ [BROADCAST] Complete: ${successful} ✓, ${skipped} skip, ${failed} ✗`);
    return results;
  }

  async likePost(account, postUrl) {
    if (!account.page) throw new Error('Account not initialized');
    
    try {
      // Use same page, navigate to post
      await account.page.goto(postUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      await account.page.waitForTimeout(500);
      
      // First check if post is already liked
      const alreadyLiked = await account.page.evaluate(() => {
        // Look for "Unlike" button or liked indicators
        const unlikeSelectors = [
          '[aria-label="Unlike"]',
          '[aria-label*="Unlike"]',
          '[data-testid*="unlike"]',
          'span:contains("Unlike")',
          '.liked',
          '[aria-pressed="true"]'
        ];
        
        for (const selector of unlikeSelectors) {
          try {
            if (document.querySelector(selector)) {
              return true;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Check for blue/active like buttons
        const likeButtons = document.querySelectorAll('[aria-label*="Like"], [role="button"]');
        for (const btn of likeButtons) {
          const style = window.getComputedStyle(btn);
          const ariaPressed = btn.getAttribute('aria-pressed');
          
          if (ariaPressed === 'true' || 
              style.color.includes('rgb(24, 119, 242)') || // Facebook blue
              btn.classList.contains('liked') ||
              btn.classList.contains('active')) {
            return true;
          }
        }
        
        return false;
      });
      
      if (alreadyLiked) {
        console.log(`ℹ️ [LIKE] ${account.email} - Already liked`);
        account.lastAction = `Skipped (already liked): ${postUrl}`;
        return { account: account.email, success: true, skipped: true, reason: 'already_liked' };
      }
      
      // Find like button with multiple selectors
      const likeSelectors = [
        '[aria-label="Like"]',
        '[data-testid="fb-ufi_likelink"]',
        '[role="button"][aria-label*="Like"]',
        '[data-testid="UFI2ReactionLink"]',
        'div[role="button"] svg[aria-label="Like"]',
        'div[role="button"] i[data-visualcompletion="css-img"]',
        'span[role="button"][tabindex="0"]'
      ];
      
      let likeButton = null;
      for (const selector of likeSelectors) {
        try {
          likeButton = await account.page.$(selector);
          if (likeButton) {
            // Double-check this isn't an "Unlike" button
            const buttonText = await likeButton.evaluate(el => {
              return el.getAttribute('aria-label') || el.textContent || '';
            });
            
            if (buttonText.toLowerCase().includes('unlike')) {
              console.log(`ℹ️ Found "Unlike" button, post already liked`);
              account.lastAction = `Skipped (already liked): ${postUrl}`;
              return { account: account.email, success: true, skipped: true, reason: 'already_liked' };
            }
            
            console.log(`✅ Found like button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Invalid selector: ${selector}`);
          continue;
        }
      }
      
      // Fallback: Find any button with "Like" text
      if (!likeButton) {
        console.log('🔍 Trying fallback like button detection...');
        likeButton = await account.page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('div[role="button"], span[role="button"]'));
          return buttons.find(btn => {
            const text = btn.textContent || btn.getAttribute('aria-label') || '';
            return text.toLowerCase().includes('like') && !text.toLowerCase().includes('unlike');
          });
        });
        
        if (likeButton && likeButton.asElement()) {
          likeButton = likeButton.asElement();
          console.log('✅ Found like button via fallback method');
        } else {
          likeButton = null;
        }
      }
      
      if (likeButton) {
        // Human-like click with random offset
        const box = await likeButton.boundingBox();
        if (box) {
          const x = box.x + box.width * (0.3 + Math.random() * 0.4);
          const y = box.y + box.height * (0.3 + Math.random() * 0.4);
          await account.page.mouse.click(x, y);
        } else {
          await likeButton.click();
        }
        
        // Minimal wait for like to register
        await account.page.waitForTimeout(200);
        
        account.totalLikes++;
        account.lastAction = `Liked post: ${postUrl}`;
        
        // Update database
        try {
          await Account.findByIdAndUpdate(account.id, {
            totalLikes: account.totalLikes,
            lastAction: account.lastAction,
            updatedAt: new Date()
          });
        } catch (error) {
          console.log(`⚠️ Could not update database for ${account.email}:`, error.message);
        }
        
        console.log(`👍 [LIKE] ${account.email} - Success`);
        this.emit('likeCompleted', { account: account.email, postUrl });
        
        return { account: account.email, success: true };
      } else {
        throw new Error('Like button not found');
      }
      
    } catch (error) {
      console.error(`Failed to like post for ${account.email}:`, error.message);
      throw error;
    }
  }

  async removeAccount(accountId) {
    const account = this.accounts.find(acc => acc.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    
    console.log(`🗑️ [REMOVE] ${account.email}`);
    
    try {
      // Remove from database
      await Account.findByIdAndDelete(accountId);
      console.log(`💾 [DB] Account deleted: ${account.email}`);
      
      // Close browser if running
      const browser = this.browsers.get(accountId);
      if (browser) {
        console.log(`🚪 [BROWSER] Closing for ${account.email}`);
        await browser.close();
        this.browsers.delete(accountId);
      }
    } catch (error) {
      console.log(`⚠️ [REMOVE] DB error: ${error.message}`);
    }
    
    // Remove from accounts array
    this.accounts = this.accounts.filter(acc => acc.id !== accountId);
    
    console.log(`✅ [REMOVE] ${account.email} - Complete`);
    return true;
  }

  async cleanup() {
    console.log('🧹 [CLEANUP] Starting cleanup...');
    
    this.isSystemRunning = false;
    this.isListening = false;
    
    // Close all browsers
    let closedCount = 0;
    for (const [accountId, browser] of this.browsers) {
      try {
        await browser.close();
        closedCount++;
      } catch (error) {
        console.error(`❌ [CLEANUP] Failed to close browser for ${accountId}:`, error.message);
      }
    }
    
    this.browsers.clear();
    console.log(`✅ [CLEANUP] Closed ${closedCount} browsers`);
  }

  setTagKeyword(keyword) {
    this.tagKeyword = keyword;
    console.log(`🏷️ [TAG] Keyword set to: ${keyword}`);
  }

  getTagKeyword() {
    return this.tagKeyword;
  }

  setHeadlessMode(headless) {
    this.headlessMode = headless;
    console.log(`🖥️ [MODE] Headless mode ${headless ? 'enabled' : 'disabled'}`);
  }

  getHeadlessMode() {
    return this.headlessMode;
  }

  async saveSessionToDB(page, account) {
    try {
      const cookies = await page.cookies();
      const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
      
      await Account.findByIdAndUpdate(account.id, {
        cookies: JSON.stringify(cookies),
        localStorage: localStorage,
        sessionValid: true,
        lastLogin: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`💾 [SESSION] ${account.email} - Saved to database`);
    } catch (error) {
      console.error(`❌ [SESSION] ${account.email} - Save failed: ${error.message}`);
    }
  }

  async restoreSessionFromDB(page, account) {
    try {
      const dbAccount = await Account.findById(account.id);
      
      if (!dbAccount || !dbAccount.sessionValid || !dbAccount.cookies) {
        return false;
      }
      
      // Check if session is not too old (3 days for safety)
      const sessionAge = Date.now() - new Date(dbAccount.lastLogin).getTime();
      if (sessionAge > 3 * 24 * 60 * 60 * 1000) {
        console.log(`⚠️ [SESSION] ${account.email} - Session expired (${Math.round(sessionAge / (24 * 60 * 60 * 1000))} days old)`);
        await Account.findByIdAndUpdate(account.id, { sessionValid: false });
        return false;
      }
      
      // Restore cookies
      const cookies = JSON.parse(dbAccount.cookies);
      await page.setCookie(...cookies);
      
      // Restore localStorage if available
      if (dbAccount.localStorage) {
        try {
          await page.evaluate((localStorageData) => {
            const data = JSON.parse(localStorageData);
            for (const key in data) {
              localStorage.setItem(key, data[key]);
            }
          }, dbAccount.localStorage);
        } catch (e) {
          // localStorage restore failed, continue anyway
        }
      }
      
      // Test if session works with shorter timeout
      await page.goto('https://facebook.com', { waitUntil: 'domcontentloaded', timeout: 6000 });
      await page.waitForTimeout(2000);
      
      const isLoggedIn = await page.evaluate(() => {
        const currentUrl = window.location.href;
        
        // Must not be on login/checkpoint pages
        if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
          return false;
        }
        
        // Must have authenticated elements
        const hasAuthElements = document.querySelector('[data-testid="blue_bar_profile_link"]') ||
                               document.querySelector('[aria-label="Account"]') ||
                               document.querySelector('[data-testid="nav_search"]') ||
                               document.querySelector('div[role="banner"]');
        
        // Must have authenticated content
        const bodyText = document.body.innerText;
        const hasLoginContent = bodyText.includes('Log in to Facebook') || 
                               bodyText.includes('Sign up for Facebook');
        const hasAuthContent = bodyText.includes('News Feed') || 
                              bodyText.includes('What\'s on your mind') ||
                              bodyText.length > 3000;
        
        return hasAuthElements && hasAuthContent && !hasLoginContent;
      });
      
      if (isLoggedIn) {
        return true;
      } else {
        // Session invalid, mark in database
        await Account.findByIdAndUpdate(account.id, { sessionValid: false });
        return false;
      }
      
    } catch (error) {
      // Don't log full error, just return false to try other methods
      return false;
    }
  }

  async loadSessionCookies(page, account) {
    try {
      const dbAccount = await Account.findById(account.id);
      if (dbAccount && dbAccount.cookies) {
        const cookies = JSON.parse(dbAccount.cookies);
        await page.setCookie(...cookies);
        console.log(`🍪 [COOKIES] ${account.email} - Loaded from database`);
      }
    } catch (error) {
      console.log(`⚠️ [COOKIES] ${account.email} - Load failed: ${error.message}`);
    }
  }

  async checkLoginStatus(page, account) {
    try {
      // First check current page without navigation
      const currentUrl = page.url();
      console.log(`🔍 [CHECK] ${account.email} - Current URL: ${currentUrl}`);
      
      if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
        const quickCheck = await page.evaluate(() => {
          // Desktop selectors
          const hasProfileLink = document.querySelector('[data-testid="blue_bar_profile_link"]');
          const hasAccountMenu = document.querySelector('[aria-label="Account"]');
          const hasNavSearch = document.querySelector('[data-testid="nav_search"]');
          
          // Mobile web selectors
          const hasMobileMenu = document.querySelector('[data-testid="mweb-navbar-menu"]');
          const hasMobileProfile = document.querySelector('[data-testid="mweb-navbar-profile"]');
          const hasMobileSearch = document.querySelector('[data-testid="mweb-navbar-search"]');
          
          // General Facebook authenticated indicators
          const hasHomeLink = document.querySelector('a[href*="/home"]');
          const hasMessengerLink = document.querySelector('a[href*="messenger"]');
          const hasNotificationIcon = document.querySelector('[aria-label*="Notification"]');
          
          // URL and content checks
          const isOnProfile = window.location.href.includes('/profile.php') || window.location.href.includes('/me');
          const isOnHome = window.location.href.includes('/home');
          const noLoginText = !document.body.innerText.includes('Log in to Facebook');
          const noSignupText = !document.body.innerText.includes('Sign up for Facebook');
          const hasRichContent = document.body.innerText.length > 1000;
          
          return {
            hasProfileLink: !!hasProfileLink,
            hasAccountMenu: !!hasAccountMenu,
            hasNavSearch: !!hasNavSearch,
            hasMobileMenu: !!hasMobileMenu,
            hasMobileProfile: !!hasMobileProfile,
            hasMobileSearch: !!hasMobileSearch,
            hasHomeLink: !!hasHomeLink,
            hasMessengerLink: !!hasMessengerLink,
            hasNotificationIcon: !!hasNotificationIcon,
            isOnProfile,
            isOnHome,
            noLoginText,
            noSignupText,
            hasRichContent,
            bodyLength: document.body.innerText.length,
            url: window.location.href
          };
        });
        
        console.log(`🔍 [CHECK] ${account.email} - Quick check results:`, quickCheck);
        
        // Check if any login indicators are present
        const isLoggedIn = (quickCheck.hasProfileLink || quickCheck.hasAccountMenu || quickCheck.hasNavSearch ||
                           quickCheck.hasMobileMenu || quickCheck.hasMobileProfile || quickCheck.hasMobileSearch ||
                           quickCheck.hasHomeLink || quickCheck.hasMessengerLink || quickCheck.hasNotificationIcon ||
                           quickCheck.isOnProfile || quickCheck.isOnHome) &&
                          quickCheck.noLoginText && quickCheck.noSignupText && quickCheck.hasRichContent;
        
        if (isLoggedIn) {
          console.log(`✅ [CHECK] ${account.email} - Already logged in (no navigation needed)`);
          await this.extractProfileName(page, account);
          return 'logged_in';
        }
      }
      
      // Only navigate if quick check failed
      console.log(`🌐 [CHECK] ${account.email} - Quick check failed, trying navigation...`);
      
      try {
        await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForTimeout(1000);
        
        const finalUrl = page.url();
        console.log(`🔍 [CHECK] ${account.email} - After navigation URL: ${finalUrl}`);
        
        // If redirected to login, session expired
        if (finalUrl.includes('login') || finalUrl.includes('checkpoint')) {
          return 'session_expired';
        }
        
        // Check for profile elements (both desktop and mobile)
        const hasProfile = await page.evaluate(() => {
          const profileSelectors = [
            'h1[data-testid="profile_name_in_profile_page"]',
            '[data-testid="profile_name"]',
            '[data-testid="blue_bar_profile_link"]',
            'h1', // Generic h1 on profile pages
            '[data-testid="mweb-navbar-profile"]',
            'div[role="banner"]' // Facebook header
          ];
          
          // Also check URL-based detection
          const isOnFacebookPage = window.location.href.includes('facebook.com') &&
                                  !window.location.href.includes('login') &&
                                  !window.location.href.includes('checkpoint');
          
          const hasAuthContent = !document.body.innerText.includes('Log in to Facebook') &&
                                !document.body.innerText.includes('Sign up for Facebook') &&
                                document.body.innerText.length > 1000;
          
          if (isOnFacebookPage && hasAuthContent) {
            return true;
          }
          
          for (const selector of profileSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.trim().length > 1) {
              return true;
            }
          }
          return false;
        });
        
        if (hasProfile) {
          await this.extractProfileName(page, account);
          return 'logged_in';
        }
        
        return 'session_expired';
      } catch (navError) {
        console.log(`⚠️ [CHECK] ${account.email} - Navigation failed: ${navError.message}`);
        return 'session_expired';
      }
      
    } catch (error) {
      console.log(`⚠️ [CHECK] ${account.email} - Status check failed: ${error.message}`);
      return 'session_expired';
    }
  }

  startHeartbeat(account) {
    // Heartbeat every 5 minutes
    const heartbeatInterval = setInterval(async () => {
      if (!account.page || account.status !== 'online') {
        clearInterval(heartbeatInterval);
        return;
      }
      
      try {
        // Lightweight ping to check session
        const response = await account.page.evaluate(async () => {
          try {
            const res = await fetch('/ajax/mercury/threadlist_info.php', {
              method: 'GET',
              credentials: 'include'
            });
            return { status: res.status, ok: res.ok };
          } catch (e) {
            return { status: 0, ok: false };
          }
        });
        
        if (response.ok && response.status === 200) {
          // Session alive, update cookies
          await this.saveSessionCookies(account.page, account);
          console.log(`❤️ [HEARTBEAT] ${account.email} - Session alive`);
        } else {
          // Session expired
          console.log(`❌ [HEARTBEAT] ${account.email} - Session expired`);
          account.status = 'offline';
          account.loginStatus = 'failed';
          await Account.findByIdAndUpdate(account.id, { sessionValid: false });
          this.emit('accountStatusChanged', account);
          clearInterval(heartbeatInterval);
        }
      } catch (error) {
        console.log(`⚠️ [HEARTBEAT] ${account.email} - Error: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async triggerReLogin(page, account) {
    try {
      console.log(`🔄 [RELOGIN] ${account.email} - Attempting automatic re-login`);
      
      // First check if already logged in before attempting re-login
      const currentStatus = await this.checkLoginStatus(page, account);
      if (currentStatus === 'logged_in') {
        console.log(`✅ [RELOGIN] ${account.email} - Already logged in, no re-login needed`);
        return 'success';
      }
      
      // Navigate to login page
      await page.goto('https://facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(1000);
      
      // Check if already on a verification page
      const needsVerification = await page.evaluate(() => {
        const url = window.location.href;
        const bodyText = document.body.innerText;
        return url.includes('checkpoint') || 
               bodyText.includes('captcha') ||
               bodyText.includes('verification') ||
               bodyText.includes('Security check');
      });
      
      if (needsVerification) {
        return 'verification_needed';
      }
      
      // Try automatic login with stored credentials
      const loginResult = await page.evaluate(async (email, password) => {
        try {
          const emailField = document.querySelector('#email');
          const passwordField = document.querySelector('#pass');
          const loginButton = document.querySelector('[name="login"]');
          
          if (emailField && passwordField && loginButton) {
            emailField.value = email;
            passwordField.value = password;
            loginButton.click();
            return 'submitted';
          }
          return 'form_not_found';
        } catch (e) {
          return 'error';
        }
      }, account.email, account.password);
      
      if (loginResult !== 'submitted') {
        return 'failed';
      }
      
      // Wait for login response
      await page.waitForTimeout(3000);
      
      // Check login result
      const loginStatus = await this.checkLoginStatus(page, account);
      return loginStatus === 'logged_in' ? 'success' : 'verification_needed';
      
    } catch (error) {
      console.log(`❌ [RELOGIN] ${account.email} - Failed: ${error.message}`);
      return 'failed';
    }
  }

  async saveSessionCookies(page, account) {
    try {
      const cookies = await page.cookies();
      const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
      
      await Account.findByIdAndUpdate(account.id, {
        cookies: JSON.stringify(cookies),
        localStorage: localStorage,
        sessionValid: true,
        lastLogin: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`💾 [COOKIES] ${account.email} - Saved to database`);
    } catch (error) {
      console.error(`❌ [COOKIES] ${account.email} - Save failed: ${error.message}`);
    }
  }

  // Removed monitorManualLogin - not needed in headless mode

  getAccounts() {
    return this.accounts.map(acc => ({
      id: acc.id,
      email: acc.email,
      status: acc.status,
      loginStatus: acc.loginStatus,
      profileName: acc.profileName,
      loginError: acc.loginError,
      proxy: acc.proxy,
      totalLikes: acc.totalLikes,
      lastAction: acc.lastAction
    }));
  }
}

module.exports = FacebookManager;