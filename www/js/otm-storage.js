// ===== OTM Storage Module =====
// Stores OTM reports in IndexedDB locally and syncs to Google Drive when available

class OTMStorage {
    constructor() {
        this.dbName = 'SICOEM_OTM_DB';
        this.dbVersion = 1;
        this.db = null;
        this.googleDriveEnabled = false;
    }

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Error opening OTM database');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ OTM database initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create OTM reports store
                if (!db.objectStoreNames.contains('otm_reports')) {
                    const store = db.createObjectStore('otm_reports', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('equipmentCode', 'equipmentCode', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    // Save a new OTM report
    async saveOTMReport(equipmentCode, imageBlob, technicianName = '') {
        if (!this.db) await this.init();

        const now = new Date();
        const report = {
            equipmentCode: equipmentCode,
            date: now.toISOString(),
            dateFormatted: this.formatDate(now),
            timeFormatted: this.formatTime(now),
            technicianName: technicianName,
            imageBlob: imageBlob,
            synced: false // Will be true when uploaded to Google Drive
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['otm_reports'], 'readwrite');
            const store = transaction.objectStore('otm_reports');
            const request = store.add(report);

            request.onsuccess = () => {
                report.id = request.result;
                console.log('✅ OTM report saved locally:', report.id);
                resolve(report);
            };

            request.onerror = () => {
                console.error('Error saving OTM report');
                reject(request.error);
            };
        });
    }

    // Get all OTM reports for an equipment code
    async getReportsByCode(equipmentCode) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['otm_reports'], 'readonly');
            const store = transaction.objectStore('otm_reports');
            const index = store.index('equipmentCode');
            const request = index.getAll(equipmentCode);

            request.onsuccess = () => {
                // Sort by date descending (newest first)
                const reports = request.result.sort((a, b) =>
                    new Date(b.date) - new Date(a.date)
                );
                resolve(reports);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Get a single report by ID
    async getReportById(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['otm_reports'], 'readonly');
            const store = transaction.objectStore('otm_reports');
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Open/view a report's image
    async openReport(reportId) {
        const report = await this.getReportById(reportId);
        if (!report || !report.imageBlob) {
            console.error('Report not found or has no image');
            return null;
        }

        // Create a URL from the blob and open it
        const url = URL.createObjectURL(report.imageBlob);
        window.open(url, '_blank');
        return url;
    }

    // Format date as DD/MM/YYYY
    formatDate(date) {
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }

    // Format time as HH:MM
    formatTime(date) {
        const d = new Date(date);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    // Count total reports
    async getTotalReports() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['otm_reports'], 'readonly');
            const store = transaction.objectStore('otm_reports');
            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }
}

// Create global instance
window.otmStorage = new OTMStorage();

// Initialize on load
window.otmStorage.init().catch(err => {
    console.error('Failed to initialize OTM storage:', err);
});
