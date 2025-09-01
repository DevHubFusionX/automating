const API_BASE = 'http://localhost:3001/api';

class ApiService {
  // System endpoints
  async startSystem() {
    const response = await fetch(`${API_BASE}/system/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  async stopSystem() {
    const response = await fetch(`${API_BASE}/system/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  // Account endpoints
  async addAccount(email, password, proxy) {
    const response = await fetch(`${API_BASE}/accounts/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, proxy })
    });
    return response.json();
  }

  async removeAccount(accountId) {
    const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
    }
  }

  async getAccounts() {
    const response = await fetch(`${API_BASE}/accounts`);
    return response.json();
  }

  // Tag Listener endpoints
  async startTagListener() {
    const response = await fetch(`${API_BASE}/listener/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  async stopTagListener() {
    const response = await fetch(`${API_BASE}/listener/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  async scanNow() {
    const response = await fetch(`${API_BASE}/listener/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  // Broadcast endpoint
  async broadcastLike(postUrl) {
    const response = await fetch(`${API_BASE}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postUrl })
    });
    return response.json();
  }
}

export default new ApiService();