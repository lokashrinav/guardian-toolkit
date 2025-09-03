class BaselineDashboard {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadStats();
        await this.loadReports();
        setInterval(() => this.loadStats(), 30000); // Refresh stats every 30s
    }
    
    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadFile(e.target.files[0]);
            }
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
            if (files.length > 0) {
                this.uploadFile(files[0]);
            } else {
                this.showStatus('Please upload a JSON file', 'error');
            }
        });
        
        // Modal close on outside click
        document.getElementById('reportModal').addEventListener('click', (e) => {
            if (e.target.id === 'reportModal') {
                this.closeModal();
            }
        });
    }
    
    async loadStats() {
        try {
            const response = await fetch(`${this.apiBase}/stats`);
            const stats = await response.json();
            
            document.getElementById('totalReports').textContent = stats.totalReports;
            document.getElementById('totalIssues').textContent = stats.totalIssues;
            document.getElementById('averageIssues').textContent = stats.averageIssues;
            document.getElementById('highRisk').textContent = stats.riskDistribution.high;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadReports() {
        const reportsList = document.getElementById('reportsList');
        reportsList.innerHTML = '<div class="loading">Loading reports...</div>';
        
        try {
            const response = await fetch(`${this.apiBase}/reports`);
            const reports = await response.json();
            
            if (reports.length === 0) {
                reportsList.innerHTML = '<div class="loading">No reports found. Upload your first scan report!</div>';
                return;
            }
            
            reportsList.innerHTML = reports.map(report => this.renderReportItem(report)).join('');
        } catch (error) {
            reportsList.innerHTML = '<div class="error">Error loading reports</div>';
            console.error('Error loading reports:', error);
        }
    }
    
    renderReportItem(report) {
        const riskClass = `risk-${report.summary?.riskLevel || 'low'}-bg`;
        const timeAgo = this.timeAgo(report.timestamp || report.uploadedAt);
        
        return `
            <div class="report-item" onclick="dashboard.viewReport('${report.id}')">
                <div class="report-header">
                    <div class="report-title">
                        ${report.repository || 'Unknown Repository'}
                        ${report.branch ? `(${report.branch})` : ''}
                    </div>
                    <span class="report-risk ${riskClass}">
                        ${(report.summary?.riskLevel || 'low').toUpperCase()}
                    </span>
                </div>
                <div class="report-meta">
                    ${timeAgo} • Commit: ${report.commit || 'N/A'}
                </div>
                <div class="report-stats">
                    <span class="report-stat">📁 ${report.eslint?.totalFiles || 0} files</span>
                    <span class="report-stat">⚠️ ${report.summary?.totalIssues || 0} issues</span>
                    <span class="report-stat">🔍 ESLint: ${report.eslint?.totalIssues || 0}</span>
                    <span class="report-stat">🛠️ Codemod: ${report.codemod?.totalIssues || 0}</span>
                </div>
            </div>
        `;
    }
    
    async viewReport(reportId) {
        const modal = document.getElementById('reportModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        modalTitle.textContent = 'Loading...';
        modalBody.innerHTML = '<div class="loading">Loading report details...</div>';
        modal.style.display = 'block';
        
        try {
            const response = await fetch(`${this.apiBase}/reports/${reportId}`);
            const report = await response.json();
            
            modalTitle.textContent = `Report: ${report.repository || 'Unknown'} (${report.branch || 'unknown branch'})`;
            modalBody.innerHTML = this.renderReportDetails(report);
        } catch (error) {
            modalBody.innerHTML = '<div class="error">Error loading report details</div>';
            console.error('Error loading report:', error);
        }
    }
    
    renderReportDetails(report) {
        const riskEmoji = {
            'low': '✅',
            'medium': '⚠️',
            'high': '❌'
        };
        
        let html = `
            <div style="margin-bottom: 2rem;">
                <h4>📊 Summary</h4>
                <p><strong>Risk Level:</strong> ${riskEmoji[report.summary?.riskLevel || 'low']} ${(report.summary?.riskLevel || 'low').toUpperCase()}</p>
                <p><strong>Total Issues:</strong> ${report.summary?.totalIssues || 0}</p>
                <p><strong>Repository:</strong> ${report.repository || 'N/A'}</p>
                <p><strong>Branch:</strong> ${report.branch || 'N/A'}</p>
                <p><strong>Commit:</strong> ${report.commit || 'N/A'}</p>
                <p><strong>Timestamp:</strong> ${new Date(report.timestamp || report.uploadedAt).toLocaleString()}</p>
            </div>
        `;
        
        if (report.eslint && report.eslint.files && report.eslint.files.length > 0) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h4>🔍 ESLint Issues</h4>
                    <p><strong>Files scanned:</strong> ${report.eslint.totalFiles}</p>
                    <p><strong>Issues found:</strong> ${report.eslint.totalIssues}</p>
                    
                    <div style="max-height: 300px; overflow-y: auto; margin-top: 1rem;">
            `;
            
            report.eslint.files.forEach(file => {
                if (file.issues && file.issues.length > 0) {
                    html += `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                            <strong>${file.file}</strong>
                            <ul style="margin-top: 0.5rem; padding-left: 1rem;">
                    `;
                    
                    file.issues.forEach(issue => {
                        const severityIcon = issue.severity === 'error' ? '❌' : '⚠️';
                        html += `
                            <li style="margin-bottom: 0.25rem;">
                                ${severityIcon} Line ${issue.line}: ${issue.message}
                                ${issue.ruleId ? `(${issue.ruleId})` : ''}
                            </li>
                        `;
                    });
                    
                    html += '</ul></div>';
                }
            });
            
            html += '</div></div>';
        }
        
        if (report.codemod && report.codemod.totalIssues > 0) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h4>🛠️ Codemod Analysis</h4>
                    <p><strong>Issues found:</strong> ${report.codemod.totalIssues}</p>
                    <p><strong>Files with issues:</strong> ${report.codemod.filesWithIssues}</p>
                </div>
            `;
        }
        
        html += `
            <div>
                <h4>📄 Raw Report Data</h4>
                <pre>${JSON.stringify(report, null, 2)}</pre>
            </div>
        `;
        
        return html;
    }
    
    async uploadFile(file) {
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.innerHTML = '<div class="loading">Uploading...</div>';
        
        const formData = new FormData();
        formData.append('report', file);
        
        try {
            const response = await fetch(`${this.apiBase}/reports`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showStatus(`Report uploaded successfully! Found ${result.summary?.totalIssues || 0} issues.`, 'success');
                await this.loadStats();
                await this.loadReports();
            } else {
                this.showStatus(`Upload failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Upload failed: ${error.message}`, 'error');
            console.error('Upload error:', error);
        }
        
        // Clear file input
        document.getElementById('fileInput').value = '';
    }
    
    showStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 5000);
    }
    
    closeModal() {
        document.getElementById('reportModal').style.display = 'none';
    }
    
    timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInHours / 24);
        
        if (diffInDays > 0) {
            return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
        } else if (diffInHours > 0) {
            return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
        } else {
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
            return `${Math.max(1, diffInMinutes)} minute${diffInMinutes === 1 ? '' : 's'} ago`;
        }
    }
}

// Initialize dashboard when page loads
const dashboard = new BaselineDashboard();

// Make functions available globally for onclick handlers
window.loadReports = () => dashboard.loadReports();
window.closeModal = () => dashboard.closeModal();