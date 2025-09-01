// Quick login test script
const FacebookManager = require('./facebook-manager');

async function testLogin() {
  const fbManager = new FacebookManager();
  
  console.log('🧪 Testing Facebook Login...');
  
  // Add your test account here
  const testEmail = 'your-email@example.com';
  const testPassword = 'your-password';
  
  try {
    // Add account
    const account = await fbManager.addAccount(testEmail, testPassword);
    console.log('✅ Account added:', account.email);
    
    // Start system to initialize account
    await fbManager.startSystem();
    console.log('✅ System started');
    
    // Wait for login to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check account status
    const accounts = fbManager.getAccounts();
    const testAccount = accounts.find(acc => acc.email === testEmail);
    
    console.log('📊 Login Results:');
    console.log('- Status:', testAccount.status);
    console.log('- Login Status:', testAccount.loginStatus);
    console.log('- Profile Name:', testAccount.profileName);
    console.log('- Error:', testAccount.loginError);
    
    if (testAccount.loginStatus === 'verified') {
      console.log('🎉 Login successful!');
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await fbManager.stopSystem();
    process.exit(0);
  }
}

// Run test
testLogin();