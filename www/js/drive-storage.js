// ===== SICOEM Drive Storage Module =====
// Handles OTM upload and retrieval from Google Drive via Apps Script

class DriveStorage {
    constructor() {
        this.apiUrl = CONFIG.DRIVE_SCRIPT_URL || '';
        this.uploadQueue = [];
        this.isOnline = navigator.onLine;

        // Listen for online/offline
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => this.isOnline = false);
    }

    // Upload OTM to Google Drive
    async uploadOTM(equipmentCode, pdfBlob, technician, date) {
        if (!this.apiUrl) {
            console.warn('Drive API URL not configured');
            return { success: false, error: 'API no configurada' };
        }

        let payload = null;

        try {
            // Convert blob to base64
            const base64 = await this.blobToBase64(pdfBlob);
            const fileName = `OTM_${equipmentCode}_${date.replace(/\//g, '-')}.pdf`;

            payload = {
                action: 'upload',
                equipmentCode: equipmentCode,
                fileName: fileName,
                fileData: base64,
                technician: technician,
                date: date
            };

            // If offline, queue for later
            if (!navigator.onLine) {
                this.queueUpload(payload);
                return { success: true, queued: true, message: 'Guardado para subir cuando haya internet' };
            }

            // Use XMLHttpRequest to avoid CORS issues with Apps Script
            const result = await this.postToAppsScript(payload);

            if (result.success) {
                console.log('OTM uploaded to Drive:', result.fileId);
                return result;
            } else {
                throw new Error(result.error || 'Error al subir');
            }

        } catch (error) {
            console.error('Drive upload error:', error);
            // Queue for retry if payload was created
            if (payload) {
                this.queueUpload(payload);
            }
            return { success: false, queued: payload !== null, error: error.message };
        }
    }

    // Get OTM history for equipment
    async getOTMHistory(equipmentCode) {
        if (!this.apiUrl) {
            return { otms: [] };
        }

        try {
            const url = `${this.apiUrl}?action=list&equipmentCode=${encodeURIComponent(equipmentCode)}`;
            const response = await fetch(url);
            const result = await response.json();

            return result;
        } catch (error) {
            console.error('Error fetching OTM history:', error);
            return { otms: [], error: error.message };
        }
    }

    // Get download URL for a file
    async getDownloadUrl(fileId) {
        if (!this.apiUrl) {
            return null;
        }

        try {
            const url = `${this.apiUrl}?action=download&fileId=${encodeURIComponent(fileId)}`;
            const response = await fetch(url);
            const result = await response.json();

            return result.url || result.viewUrl;
        } catch (error) {
            console.error('Error getting download URL:', error);
            return null;
        }
    }

    // Get file content as base64 for local viewing
    async getFileContent(fileId) {
        if (!this.apiUrl) {
            return null;
        }

        try {
            const url = `${this.apiUrl}?action=getContent&fileId=${encodeURIComponent(fileId)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.content) {
                return {
                    content: result.content,
                    mimeType: result.mimeType,
                    fileName: result.fileName
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting file content:', error);
            return null;
        }
    }

    // Queue upload for later (offline support)
    queueUpload(payload) {
        this.uploadQueue.push(payload);
        localStorage.setItem('sicoem_upload_queue', JSON.stringify(this.uploadQueue));
    }

    // Process queued uploads
    async processQueue() {
        this.isOnline = true;
        const queue = JSON.parse(localStorage.getItem('sicoem_upload_queue') || '[]');

        if (queue.length === 0) return;

        console.log(`Processing ${queue.length} queued uploads...`);

        for (const payload of queue) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    // Remove from queue
                    const index = this.uploadQueue.findIndex(p => p.fileName === payload.fileName);
                    if (index > -1) {
                        this.uploadQueue.splice(index, 1);
                    }
                }
            } catch (error) {
                console.error('Queue processing error:', error);
            }
        }

        localStorage.setItem('sicoem_upload_queue', JSON.stringify(this.uploadQueue));
    }

    // Convert blob to base64
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // POST to Apps Script using XMLHttpRequest (works in Capacitor WebView)
    async postToAppsScript(payload) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', this.apiUrl, true);
            xhr.timeout = 30000;

            xhr.onload = () => {
                try {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            resolve(result);
                        } catch (e) {
                            resolve({ success: true, message: 'Enviado' });
                        }
                    } else {
                        reject(new Error('HTTP ' + xhr.status));
                    }
                } catch (e) {
                    resolve({ success: true, message: 'Enviado' });
                }
            };

            xhr.onerror = () => reject(new Error('Error de red'));
            xhr.ontimeout = () => reject(new Error('Timeout'));

            const formData = new FormData();
            Object.keys(payload).forEach(key => {
                formData.append(key, typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key]);
            });

            xhr.send(formData);
        });
    }
}

// Export
window.driveStorage = new DriveStorage();
