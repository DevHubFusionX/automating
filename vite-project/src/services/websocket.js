class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.onopen = () => {
      console.log('🔗 Connected to backend');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('❌ Disconnected from backend - attempting reconnection...');
      // Reconnect with error handling
      setTimeout(() => {
        try {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.connect();
          }
        } catch (error) {
          console.error('Reconnection error:', error);
        }
      }, 1000);
    };
    
    this.ws.onerror = (error) => {
      console.error('🔌 WebSocket error:', error);
      // Don't let WebSocket errors crash the app
    };
  }

  handleMessage(data) {
    try {
      const listeners = this.listeners.get(data.type) || [];
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('WebSocket callback error:', error);
        }
      });
    } catch (error) {
      console.error('WebSocket handleMessage error:', error);
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    const listeners = this.listeners.get(eventType) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  disconnect() {
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } catch (error) {
      console.error('WebSocket disconnect error:', error);
    }
  }
}

export default new WebSocketService();