// DevTools Panel JavaScript
// Handles the baseline compatibility checking interface

class BaselinePanel {
  constructor() {
    this.isScanning = false;
    this.currentResults = null;
    this.collapsedSections = new Set();
  }
  
  initialize() {
    console.log('Baseline Panel initialized');
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'BASELINE_SCAN_RESULT') {
        this.handleScanResult(message.data);
        sendResponse({ success: true });
      }
      return true;
    });
  }
  
  async scanPage() {
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.updateUI('scanning');
    
    try {
      // Execute scanning script in the current page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      });
      
      // Trigger the scan
      await chrome.tabs.sendMessage(tab.id, { type: 'START_BASELINE_SCAN' });
      
    } catch (error) {
      console.error('Error starting scan:', error);
      this.updateUI('error', 'Failed to scan page');
      this.isScanning = false;
    }
  }
  
  handleScanResult(results) {
    this.isScanning = false;
    this.currentResults = results;
    this.updateUI('complete', null, results);
  }
  
  updateUI(state, message = null, results = null) {
    const scanBtn = document.getElementById('scanBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const emptyState = document.getElementById('emptyState');
    const loading = document.getElementById('loading');
    const summary = document.getElementById('summary');
    const issuesContainer = document.getElementById('issuesContainer');
    
    // Reset classes
    statusIndicator.className = 'status-indicator';
    
    switch (state) {
      case 'scanning':
        scanBtn.textContent = 'Scanning...';
        scanBtn.disabled = true;
        statusIndicator.classList.add('status-unknown');
        statusText.textContent = 'Scanning page for baseline compatibility...';
        
        emptyState.classList.add('hidden');
        loading.classList.remove('hidden');
        summary.classList.add('hidden');
        issuesContainer.classList.add('hidden');
        break;
        
      case 'complete':
        scanBtn.textContent = 'Scan Page';
        scanBtn.disabled = false;
        
        if (results) {
          const criticalCount = results.issues.filter(i => i.severity === 'critical').length;
          const totalIssues = results.issues.length;
          
          if (criticalCount > 0) {
            statusIndicator.classList.add('status-danger');
            statusText.textContent = `${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} found`;
          } else if (totalIssues > 0) {
            statusIndicator.classList.add('status-warning');
            statusText.textContent = `${totalIssues} issue${totalIssues === 1 ? '' : 's'} found`;
          } else {
            statusIndicator.classList.add('status-safe');
            statusText.textContent = 'No baseline compatibility issues found';
          }
          
          this.updateSummary(results);
          this.renderIssues(results.issues);
          
          emptyState.classList.add('hidden');
          loading.classList.add('hidden');
          summary.classList.remove('hidden');
          issuesContainer.classList.remove('hidden');
        }
        break;
        
      case 'error':
        scanBtn.textContent = 'Scan Page';
        scanBtn.disabled = false;
        statusIndicator.classList.add('status-danger');
        statusText.textContent = message || 'Error during scan';
        
        loading.classList.add('hidden');
        emptyState.classList.remove('hidden');
        summary.classList.add('hidden');
        issuesContainer.classList.add('hidden');
        break;
    }
  }
  
  updateSummary(results) {
    const criticalIssues = results.issues.filter(i => i.severity === 'critical').length;
    const warningIssues = results.issues.filter(i => i.severity === 'warning').length;
    
    document.getElementById('totalIssues').textContent = results.issues.length;
    document.getElementById('criticalIssues').textContent = criticalIssues;
    document.getElementById('warningIssues').textContent = warningIssues;
    document.getElementById('scannedElements').textContent = results.elementsScanned || 0;
  }
  
  renderIssues(issues) {
    const cssIssues = issues.filter(i => i.type === 'css');
    const jsIssues = issues.filter(i => i.type === 'javascript');
    const htmlIssues = issues.filter(i => i.type === 'html');
    
    document.getElementById('cssIssueCount').textContent = cssIssues.length;
    document.getElementById('jsIssueCount').textContent = jsIssues.length;
    document.getElementById('htmlIssueCount').textContent = htmlIssues.length;
    
    this.renderIssueSection('css-issues-content', cssIssues);
    this.renderIssueSection('js-issues-content', jsIssues);
    this.renderIssueSection('html-issues-content', htmlIssues);
  }
  
  renderIssueSection(containerId, issues) {
    const container = document.getElementById(containerId);
    
    if (issues.length === 0) {
      container.innerHTML = '<div style="padding: 16px; color: #5f6368; text-align: center; font-size: 11px;">No issues found in this category</div>';
      return;
    }
    
    container.innerHTML = issues.map(issue => `
      <div class="issue-item ${issue.severity}" onclick="inspectIssue('${issue.id}')">
        <div class="issue-header">
          <div class="issue-title">${issue.feature}</div>
          <div class="issue-severity severity-${issue.severity}">${issue.severity}</div>
        </div>
        <div class="issue-description">${issue.description}</div>
        <div class="issue-location">${issue.location}</div>
        ${issue.code ? `<div class="issue-code">${this.escapeHtml(issue.code)}</div>` : ''}
      </div>
    `).join('');
  }
  
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  toggleSection(sectionId) {
    const icon = document.getElementById(`${sectionId}-icon`);
    const content = document.getElementById(`${sectionId}-content`);
    
    if (this.collapsedSections.has(sectionId)) {
      this.collapsedSections.delete(sectionId);
      icon.classList.remove('collapsed');
      content.classList.remove('collapsed');
      content.style.maxHeight = content.scrollHeight + 'px';
    } else {
      this.collapsedSections.add(sectionId);
      icon.classList.add('collapsed');
      content.classList.add('collapsed');
      content.style.maxHeight = '0';
    }
  }
  
  async inspectIssue(issueId) {
    const issue = this.findIssueById(issueId);
    if (!issue) return;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Highlight the element in the page
      await chrome.tabs.sendMessage(tab.id, {
        type: 'HIGHLIGHT_ELEMENT',
        selector: issue.selector,
        location: issue.location
      });
      
      // Also reveal in Elements panel if possible
      if (issue.selector) {
        chrome.devtools.inspectedWindow.eval(`
          const element = document.querySelector('${issue.selector}');
          if (element) {
            inspect(element);
          }
        `);
      }
      
    } catch (error) {
      console.error('Error inspecting issue:', error);
    }
  }
  
  findIssueById(issueId) {
    if (!this.currentResults) return null;
    return this.currentResults.issues.find(issue => issue.id === issueId);
  }
}

// Global functions called from HTML
window.BaselinePanel = new BaselinePanel();

function scanPage() {
  window.BaselinePanel.scanPage();
}

function toggleSection(sectionId) {
  window.BaselinePanel.toggleSection(sectionId);
}

function inspectIssue(issueId) {
  window.BaselinePanel.inspectIssue(issueId);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.BaselinePanel.initialize();
  });
} else {
  window.BaselinePanel.initialize();
}