// Demo file with unsafe web features for testing
// This file intentionally uses features with varying Baseline support

export class ModernUserService {
  constructor() {
    this.cache = new Map();
  }

  // String.replaceAll - limited support
  sanitizeUsername(username) {
    return username.replaceAll(/[^a-zA-Z0-9]/g, '_');
  }

  // Fetch without fallback - could fail in older environments
  async fetchUser(id) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }

  // Promise.allSettled - newer feature
  async fetchMultipleUsers(ids) {
    const promises = ids.map(id => this.fetchUser(id));
    const results = await Promise.allSettled(promises);
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
  }

  // ResizeObserver - modern API
  observeElement(element, callback) {
    const observer = new ResizeObserver(callback);
    observer.observe(element);
    return observer;
  }

  // Clipboard API - requires secure context
  async copyToClipboard(text) {
    await navigator.clipboard.writeText(text);
  }
}