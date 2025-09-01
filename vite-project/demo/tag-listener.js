const axios = require('axios');

class TagListener {
  constructor() {
    this.isListening = false;
    this.tagKeyword = '@autolike';
  }

  startListening() {
    console.log('👂 Starting tag listener...');
    console.log(`🎯 Monitoring for: "${this.tagKeyword}"`);
    console.log('⏰ Simulating tag detection every 10 seconds...');
    console.log('');
    
    this.isListening = true;
    
    // Simulate tag detection every 10 seconds
    const interval = setInterval(() => {
      if (!this.isListening) {
        clearInterval(interval);
        return;
      }
      
      this.simulateTagDetection();
    }, 10000);

    // Also trigger one immediately for demo
    setTimeout(() => {
      this.simulateTagDetection();
    }, 3000);
  }

  async simulateTagDetection() {
    const postId = Date.now();
    const postUrl = `https://facebook.com/post/${postId}`;
    
    console.log('🚨 NEW TAG DETECTED!');
    console.log(`📎 Post URL: ${postUrl}`);
    console.log(`🏷️  Tag: ${this.tagKeyword}`);
    console.log(`⚡ Detection time: ${new Date().toLocaleTimeString()}`);
    console.log('');
    
    // Trigger auto-like
    try {
      await axios.post('http://localhost:3001/trigger-like', {
        postUrl: postUrl
      });
      
      console.log('📡 Successfully broadcasted to all accounts');
      console.log('⏱️  Total time: < 1 second');
      console.log('');
      console.log('─'.repeat(50));
      console.log('');
      
    } catch (error) {
      console.error('❌ Failed to trigger auto-like:', error.message);
    }
  }

  stopListening() {
    this.isListening = false;
    console.log('🛑 Tag listener stopped');
  }
}

// Start the listener
const listener = new TagListener();

console.log('🎬 Auto-Like Tag Listener Demo');
console.log('🔧 Make sure demo server is running: node demo/server.js');
console.log('');

// Wait a bit then start
setTimeout(() => {
  listener.startListening();
}, 2000);

// Handle cleanup
process.on('SIGINT', () => {
  listener.stopListening();
  process.exit(0);
});