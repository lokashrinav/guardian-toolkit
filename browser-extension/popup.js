// Browser Extension Popup Script

class PopupController {
  constructor() {
    this.settings = {
      showSafe: true,
      autoRefresh: true
    };
  }
  
  async init() {
    await this.loadSettings();
    await this.loadStats();
    this.updateUI();
  }
  
  async loadSettings() {
    const stored = await chrome.storage.sync.get(['baselineSettings']);
    if (stored.baselineSettings) {
      this.settings = { ...this.settings, ...stored.baselineSettings };
    }
  }
  
  async saveSettings() {
    await chrome.storage.sync.set({ baselineSettings: this.settings });
  }
  
  async loadStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get stats from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_ANNOTATION_STATS'
      });
      
      if (response && response.success) {
        this.updateStats(response.stats);
      } else {
        this.updateStats({ annotated: 0, issues: 0 });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.updateStats({ annotated: 0, issues: 0 });
    }
  }
  
  updateStats(stats) {
    document.getElementById('annotatedCount').textContent = stats.annotated || 0;
    document.getElementById('issuesCount').textContent = stats.issues || 0;
  }
  
  updateUI() {
    // Update toggle states
    document.getElementById('showSafeToggle').classList.toggle('active', this.settings.showSafe);
    document.getElementById('autoRefreshToggle').classList.toggle('active', this.settings.autoRefresh);
  }
  
  toggleSetting(settingName) {
    this.settings[settingName] = !this.settings[settingName];
    this.saveSettings();
    this.updateUI();
    
    // Notify content script of setting change
    this.notifyContentScript();
  }
  
  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SETTINGS_CHANGED',
        settings: this.settings
      });
    } catch (error) {
      console.error('Error notifying content script:', error);
    }
  }
  
  async refreshAnnotations() {
    const button = document.querySelector('.refresh-btn');
    const originalText = button.textContent;
    
    button.textContent = '🔄 Refreshing...';
    button.disabled = true;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        type: 'REFRESH_ANNOTATIONS'
      });
      
      // Reload stats after refresh
      setTimeout(() => {
        this.loadStats();
      }, 1000);
      
    } catch (error) {
      console.error('Error refreshing annotations:', error);
    } finally {
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1000);
    }
  }
}

// Global functions for HTML onclick handlers
let popupController;

function toggleSetting(settingName) {
  if (popupController) {
    popupController.toggleSetting(settingName);
  }
}

function refreshAnnotations() {
  if (popupController) {
    popupController.refreshAnnotations();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  popupController = new PopupController();
  popupController.init();
});