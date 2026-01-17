// ===== Main App Module - Redesigned =====

class App {
    constructor() {
        this.currentUser = null;
        this.scannerActive = false;
    }

    // Initialize app
    async init() {
        console.log('🏥 Initializing SICOEM v2.0...');

        // Show splash for animation
        await this.showSplash();

        // Initialize UI
        window.ui.init();

        // Setup event listeners
        this.setupEventListeners();

        // Check saved session FIRST (show login quickly)
        const savedUser = localStorage.getItem('sicoem_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showMainApp();
        } else {
            this.showLogin();
        }

        // Pre-load equipment data in background (after showing UI)
        this.updateLoadingStatus('Conectando con base de datos...');

        window.sheetsDB.fetchEquipment().then(() => {
            const count = window.sheetsDB.equipment.length;
            console.log('✅ Equipment data loaded:', count, 'items');
            this.updateLoadingStatus(`✅ ${count.toLocaleString()} equipos cargados`, true);
        }).catch(error => {
            console.error('Error loading equipment:', error);
            this.updateLoadingStatus('⚠️ Error al cargar datos', false);
        });

        // Setup Android back button handler
        this.setupBackButtonHandler();

        console.log('✅ SICOEM initialized');
    }

    // Setup Android hardware back button handler
    setupBackButtonHandler() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                const { App } = Capacitor.Plugins;

                App.addListener('backButton', () => {
                    // Try to handle back navigation within the app
                    if (window.ui && window.ui.goBack()) {
                        return;
                    }

                    // If on main screen with no history, exit
                    App.exitApp();
                });

                console.log('✅ Android back button handler registered');
            } catch (error) {
                console.error('Error setting up back button:', error);
            }
        }
    }

    // Update loading status indicator
    updateLoadingStatus(text, isLoaded = false) {
        const statusEl = document.getElementById('data-loading-status');
        const textEl = document.getElementById('loading-status-text');

        if (statusEl && textEl) {
            textEl.textContent = text;
            if (isLoaded) {
                statusEl.classList.add('loaded');
            } else {
                statusEl.classList.remove('loaded');
            }
        }
    }


    // Show splash screen
    showSplash() {
        return new Promise(resolve => {
            setTimeout(() => {
                document.getElementById('splash-screen').classList.remove('active');
                resolve();
            }, CONFIG.SPLASH_DURATION);
        });
    }

    // Show login screen
    showLogin() {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('main-app').classList.remove('active');
    }

    // Show main app
    showMainApp() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        // Don't auto-start scanner - let user click to scan
    }

    // Setup event listeners
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Start scan button
        const startScanBtn = document.getElementById('start-scan-btn');
        if (startScanBtn) {
            startScanBtn.addEventListener('click', () => this.startScanning());
        }

        // Stop scan button
        const stopScanBtn = document.getElementById('stop-scan-btn');
        if (stopScanBtn) {
            stopScanBtn.addEventListener('click', () => this.stopScanning());
        }

        // View equipment button
        const viewEquipBtn = document.getElementById('view-equipment-btn');
        if (viewEquipBtn) {
            viewEquipBtn.addEventListener('click', () => {
                const code = document.getElementById('scanned-code').textContent;
                this.findEquipmentByCode(code);
            });
        }

        // Save maintenance button
        const saveBtn = document.getElementById('save-maintenance-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveMaintenance());
        }

        // New scan button
        const newScanBtn = document.getElementById('new-scan-btn');
        if (newScanBtn) {
            newScanBtn.addEventListener('click', () => {
                window.ui.handleNavigation('scan');
            });
        }

        // Scan OTM button - opens camera to capture OTM document
        const scanOTMBtn = document.getElementById('scan-otm-btn');
        if (scanOTMBtn) {
            scanOTMBtn.addEventListener('click', () => this.scanOTMDocument());
        }

        // Verify button
        const verifyBtn = document.getElementById('verify-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                const code = document.getElementById('verify-code').value.trim();
                this.validateAndSearchCode(code);
            });
        }

        // Verify input enter key
        const verifyInput = document.getElementById('verify-code');
        if (verifyInput) {
            // Only allow numeric input
            verifyInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
            });

            verifyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const code = verifyInput.value.trim();
                    this.validateAndSearchCode(code);
                }
            });
        }
    }

    // Validate and search equipment code
    validateAndSearchCode(code) {
        // Check if empty
        if (!code) {
            window.ui.showToast('Ingrese un código patrimonial', 'error');
            return;
        }

        // Check if only numbers
        if (!/^\d+$/.test(code)) {
            window.ui.showToast('Solo se permiten números', 'error');
            return;
        }

        // Check if exactly 12 digits
        if (code.length !== 12) {
            window.ui.showToast(`El código debe tener 12 dígitos (tiene ${code.length})`, 'error');
            return;
        }

        // Valid - search for equipment
        this.findEquipmentByCode(code);
    }

    // Start scanning - show scanner UI
    startScanning() {
        document.getElementById('scan-start').style.display = 'none';
        document.getElementById('scanner-active').style.display = 'flex';
        document.getElementById('scan-result').style.display = 'none';
        this.startScanner();
    }

    // Stop scanning - hide scanner UI
    stopScanning() {
        window.scanner.stop();
        document.getElementById('scan-start').style.display = 'flex';
        document.getElementById('scanner-active').style.display = 'none';
        this.scannerActive = false;
    }

    // Scan OTM document using native document scanner with edge detection
    async scanOTMDocument() {
        // Check if we have current equipment context
        if (!window.ui.currentEquipment) {
            window.ui.showToast('Primero escanea un equipo', 'error');
            return;
        }

        const equipmentCode = window.ui.currentEquipment.codigo;
        const technicianName = this.currentUser ? this.currentUser.name : '';

        // Try native document scanner first
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                const { DocumentScanner } = Capacitor.Plugins;

                // Scan document with native scanner
                const result = await DocumentScanner.scanDocument({
                    maxNumDocuments: 1,
                    letUserAdjustCrop: true,
                    responseType: 'base64'
                });

                if (result && result.scannedImages && result.scannedImages.length > 0) {
                    window.ui.showLoading();

                    // Convert base64 to blob
                    const base64 = result.scannedImages[0];
                    const imageBlob = await this.base64ToBlob(base64, 'image/jpeg');

                    // Apply enhancement filter
                    const enhancedBlob = await this.processDocumentImage(imageBlob);

                    // Save to OTM storage
                    await window.otmStorage.saveOTMReport(equipmentCode, enhancedBlob, technicianName);

                    // Upload to Google Drive (async, don't wait)
                    this.uploadOTMToDrive(equipmentCode, enhancedBlob, technicianName);

                    window.ui.hideLoading();
                    window.ui.showToast('✅ OTM escaneado correctamente', 'success');
                    this.loadEquipmentOTMList(equipmentCode);
                    return;
                }
            } catch (err) {
                console.warn('Native scanner failed, using fallback:', err);
            }
        }

        // Fallback to simple camera capture
        this.scanOTMDocumentFallback(equipmentCode, technicianName);
    }

    // Fallback method using simple camera
    async scanOTMDocumentFallback(equipmentCode, technicianName) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            window.ui.showLoading();

            try {
                const imageBlob = await this.processDocumentImage(file);
                await window.otmStorage.saveOTMReport(equipmentCode, imageBlob, technicianName);

                // Upload to Google Drive (async, don't wait)
                this.uploadOTMToDrive(equipmentCode, imageBlob, technicianName);

                window.ui.hideLoading();
                window.ui.showToast('✅ OTM guardado correctamente', 'success');
                this.loadEquipmentOTMList(equipmentCode);
            } catch (error) {
                window.ui.hideLoading();
                console.error('Error saving OTM:', error);
                window.ui.showToast('Error al guardar OTM', 'error');
            }
        };

        input.click();
    }

    // Convert base64 to blob
    base64ToBlob(base64, type = 'image/jpeg') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type });
    }

    // Process image as document scan - enhance with scanner effect
    async processDocumentImage(file) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate dimensions (max 1500px for documents)
                const maxWidth = 1500;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw original image
                ctx.drawImage(img, 0, 0, width, height);

                // Apply document enhancement filter
                this.applyDocumentFilter(ctx, width, height);

                // Return as JPEG image
                canvas.toBlob(resolve, 'image/jpeg', 0.92);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    // Apply document scanner filter - AGGRESSIVE like Adobe Scan
    // Makes background pure white and text dark
    applyDocumentFilter(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // First pass: find the lightest pixels (background level)
        let bgLevel = 0;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (gray > bgLevel) bgLevel = gray;
        }

        // Threshold for what's considered "background" vs "text"
        const threshold = bgLevel * 0.7; // 70% of brightest = background

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Convert to grayscale
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;

            // If it's background (light), make it pure white
            if (gray > threshold) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
            } else {
                // It's text/content - increase contrast, make darker
                // Normalize to 0-1 range based on threshold
                const normalized = gray / threshold;

                // Apply strong contrast curve
                let output = normalized * normalized; // Square for more contrast
                output = output * 200; // Scale to dark range

                data[i] = Math.max(0, Math.min(255, output));
                data[i + 1] = Math.max(0, Math.min(255, output));
                data[i + 2] = Math.max(0, Math.min(255, output));
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    // Upload OTM to Google Drive (async background upload)
    async uploadOTMToDrive(equipmentCode, imageBlob, technicianName) {
        if (!window.driveStorage || !CONFIG.DRIVE_SCRIPT_URL) {
            console.log('Drive storage not configured');
            return;
        }

        try {
            const pdfBlob = await this.createPDFFromImage(imageBlob);
            const today = new Date();
            const dateStr = today.toLocaleDateString('es-PE');

            const result = await window.driveStorage.uploadOTM(
                equipmentCode,
                pdfBlob,
                technicianName || this.currentUser?.name || 'Técnico',
                dateStr
            );

            if (result.success && !result.queued) {
                window.ui.showToast('☁️ Sincronizado con Drive', 'success');
            }
        } catch (error) {
            console.error('Drive upload error:', error);
        }
    }

    // Load OTM list for current equipment (from local + Drive)
    async loadEquipmentOTMList(equipmentCode) {
        const listEl = document.getElementById('equipment-otm-list');
        if (!listEl) return;

        listEl.innerHTML = '<div class="otm-loading">Cargando OTMs...</div>';

        try {
            // Try to get from local storage first
            let localReports = [];
            try {
                localReports = await window.otmStorage.getReportsByCode(equipmentCode);
            } catch (e) {
                console.warn('Error loading local reports:', e);
            }

            // Also try to get from Google Drive
            let driveReports = [];
            if (window.driveStorage && CONFIG.DRIVE_SCRIPT_URL) {
                try {
                    const driveResult = await window.driveStorage.getOTMHistory(equipmentCode);
                    if (driveResult && driveResult.otms) {
                        driveReports = driveResult.otms;
                    }
                } catch (e) {
                    console.warn('Error loading Drive reports:', e);
                }
            }

            // Combine: show local first, then Drive (for items not in local)
            const allReports = [...localReports];

            // Add Drive reports that aren't in local (based on filename/date match)
            driveReports.forEach(driveReport => {
                // Check if this report is already in local
                const alreadyLocal = localReports.some(local =>
                    local.dateFormatted === driveReport.date
                );
                if (!alreadyLocal) {
                    allReports.push({
                        id: null, // No local ID
                        fileId: driveReport.fileId,
                        fileName: driveReport.fileName,
                        dateFormatted: driveReport.date,
                        timeFormatted: '',
                        isFromDrive: true
                    });
                }
            });

            if (allReports.length === 0) {
                listEl.innerHTML = '<div class="otm-empty">No hay OTMs registrados para este equipo</div>';
                return;
            }

            listEl.innerHTML = allReports.map(report => {
                if (report.isFromDrive) {
                    return `
                        <div class="otm-item otm-from-drive" onclick="window.app.openDriveOTM('${report.fileId}')">
                            <div class="otm-item-info">
                                <span class="otm-item-date">${report.dateFormatted}</span>
                                <span class="otm-item-source">☁️ Drive</span>
                            </div>
                            <span class="otm-item-icon">📄</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="otm-item" onclick="window.app.openOTMReport(${report.id})">
                            <div class="otm-item-info">
                                <span class="otm-item-date">${report.dateFormatted}</span>
                                <span class="otm-item-time">${report.timeFormatted}</span>
                            </div>
                            <span class="otm-item-icon">📄</span>
                        </div>
                    `;
                }
            }).join('');

        } catch (error) {
            console.error('Error loading OTM list:', error);
            listEl.innerHTML = '<div class="otm-empty">Error al cargar OTMs</div>';
        }
    }

    // Open OTM from Google Drive (download and open with native viewer)
    async openDriveOTM(fileId) {
        window.ui.showLoading();
        window.ui.showToast('Descargando documento...', 'success');

        try {
            // Download file content as base64
            const fileData = await window.driveStorage.getFileContent(fileId);

            if (!fileData || !fileData.content) {
                window.ui.showToast('No se pudo descargar el documento', 'error');
                window.ui.hideLoading();
                return;
            }

            // Try to use Capacitor Filesystem to save and open with FileOpener
            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                try {
                    const { Filesystem } = Capacitor.Plugins;
                    const FileOpener = Capacitor.Plugins.FileOpener;

                    // Save file to cache directory
                    const fileName = fileData.fileName || 'documento.pdf';
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: fileData.content,
                        directory: 'CACHE'
                    });

                    // Get the file URI
                    const fileUri = result.uri;

                    // Open with native PDF viewer using FileOpener plugin
                    await FileOpener.open({
                        filePath: fileUri,
                        contentType: 'application/pdf'
                    });

                    window.ui.showToast('✅ Documento abierto', 'success');
                    window.ui.hideLoading();
                    return;
                } catch (nativeError) {
                    console.warn('Native open failed, trying fallback:', nativeError);
                    window.ui.showToast('Instalando visor de PDF...', 'info');
                }
            }

            // Fallback: Create download link
            const byteCharacters = atob(fileData.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: fileData.mimeType });

            // Trigger download
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileData.fileName || 'documento.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            window.ui.showToast('✅ Documento descargado', 'success');

        } catch (error) {
            console.error('Error opening Drive OTM:', error);
            window.ui.showToast('Error al descargar documento', 'error');
        }
        window.ui.hideLoading();
    }

    // Show PDF in dynamic modal (using local blob URL)
    showLocalPDFModal(blobUrl, fileName) {
        // Remove existing modal if any
        const existing = document.getElementById('dynamic-pdf-modal');
        if (existing) existing.remove();

        // Store URL for cleanup
        this.currentPDFUrl = blobUrl;

        const modal = document.createElement('div');
        modal.id = 'dynamic-pdf-modal';
        modal.className = 'otm-viewer-modal active';
        modal.innerHTML = `
            <div class="otm-viewer-header">
                <button class="otm-close-btn" onclick="window.app.closePDFModal()">✕</button>
                <span class="otm-viewer-title">${fileName || 'Documento OTM'}</span>
            </div>
            <div class="pdf-viewer-container">
                <object data="${blobUrl}" type="application/pdf" class="pdf-viewer-object">
                    <div class="pdf-fallback">
                        <p>No se puede mostrar el PDF directamente.</p>
                        <a href="${blobUrl}" download="${fileName}" class="btn-primary">📥 Descargar PDF</a>
                    </div>
                </object>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Show PDF in dynamic modal (for iframe embed - unused now)
    showPDFModal(embedUrl) {
        // Remove existing modal if any
        const existing = document.getElementById('dynamic-pdf-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'dynamic-pdf-modal';
        modal.className = 'otm-viewer-modal active';
        modal.innerHTML = `
            <div class="otm-viewer-header">
                <button class="otm-close-btn" onclick="window.app.closePDFModal()">✕</button>
                <span class="otm-viewer-title">Documento OTM</span>
            </div>
            <div class="pdf-viewer-container">
                <iframe src="${embedUrl}" class="pdf-viewer-iframe" frameborder="0" allowfullscreen></iframe>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Close PDF modal
    closePDFModal() {
        const modal = document.getElementById('dynamic-pdf-modal');
        if (modal) {
            modal.remove();
        }

        // Revoke blob URL to free memory
        if (this.currentPDFUrl) {
            URL.revokeObjectURL(this.currentPDFUrl);
            this.currentPDFUrl = null;
        }
    }

    // Open an OTM report in inline modal viewer
    async openOTMReport(reportId) {
        try {
            const report = await window.otmStorage.getReportById(reportId);
            if (!report || !report.imageBlob) {
                window.ui.showToast('Documento no encontrado', 'error');
                return;
            }

            // Store current report for PDF download
            this.currentReport = report;

            // Create URL from image blob
            const url = URL.createObjectURL(report.imageBlob);

            // Show in inline modal viewer
            const modal = document.getElementById('otm-viewer-modal');
            const img = document.getElementById('otm-viewer-image');

            if (modal && img) {
                img.src = url;
                modal.classList.add('active');

                // Store URL for cleanup
                this.currentOTMUrl = url;

                // Initialize pinch-to-zoom if not already done
                if (!this.pinchZoomInitialized) {
                    this.initPinchZoom();
                }
                this.currentZoom = 1;
            }

        } catch (error) {
            console.error('Error opening OTM:', error);
            window.ui.showToast('Error al abrir OTM', 'error');
        }
    }

    // Close OTM viewer modal
    closeOTMViewer() {
        const modal = document.getElementById('otm-viewer-modal');
        if (modal) modal.classList.remove('active');

        // Clear and revoke URL
        if (this.currentOTMUrl) {
            URL.revokeObjectURL(this.currentOTMUrl);
            this.currentOTMUrl = null;
        }
        const img = document.getElementById('otm-viewer-image');
        if (img) {
            img.src = '';
        }

        // Reset zoom and pan position
        if (this.resetZoomAndPan) {
            this.resetZoomAndPan();
        }

        this.currentReport = null;
        this.currentZoom = 1;
    }

    // Download current OTM as PDF
    async downloadOTMasPDF() {
        if (!this.currentReport) {
            window.ui.showToast('No hay documento para descargar', 'error');
            return;
        }

        try {
            window.ui.showLoading();

            const report = this.currentReport;
            const img = new Image();

            img.onload = () => {
                const { jsPDF } = window.jspdf;
                const orientation = img.width > img.height ? 'l' : 'p';
                const pdf = new jsPDF({
                    orientation: orientation,
                    unit: 'px',
                    format: [img.width, img.height]
                });

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/jpeg', 0.92);

                pdf.addImage(imgData, 'JPEG', 0, 0, img.width, img.height);

                const filename = `OTM_${report.equipmentCode}_${report.dateFormatted.replace(/\//g, '-')}.pdf`;
                pdf.save(filename);

                window.ui.hideLoading();
                window.ui.showToast('📄 PDF descargado', 'success');
            };

            img.src = URL.createObjectURL(report.imageBlob);

        } catch (error) {
            window.ui.hideLoading();
            console.error('Error downloading PDF:', error);
            window.ui.showToast('Error al descargar PDF', 'error');
        }
    }

    // Share OTM as PDF using Capacitor native plugins
    async shareOTM() {
        if (!this.currentReport) {
            window.ui.showToast('No hay documento', 'error');
            return;
        }

        try {
            window.ui.showLoading();
            const report = this.currentReport;

            // Create PDF from image
            const pdfBlob = await this.createPDFFromImage(report.imageBlob);
            const fileName = `OTM_${report.equipmentCode}.pdf`;

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const Filesystem = Capacitor.Plugins.Filesystem;
                const Share = Capacitor.Plugins.Share;

                // Convert to base64
                const base64 = await this.blobToBase64(pdfBlob);

                // Save file to cache
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64,
                    directory: 'CACHE'
                });

                window.ui.hideLoading();

                // Share the PDF
                await Share.share({
                    files: [savedFile.uri]
                });

                window.ui.showToast('📤 PDF compartido', 'success');
            } else {
                window.ui.hideLoading();
                // Fallback download
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.ui.showToast('📥 PDF descargado', 'info');
            }

        } catch (error) {
            window.ui.hideLoading();
            console.error('Share error:', error);
            window.ui.showToast('Error al compartir', 'error');
        }
    }

    // Create PDF from image blob
    createPDFFromImage(imageBlob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const { jsPDF } = window.jspdf;
                    const orientation = img.width > img.height ? 'l' : 'p';
                    const pdf = new jsPDF({
                        orientation: orientation,
                        unit: 'px',
                        format: [img.width, img.height]
                    });

                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const imgData = canvas.toDataURL('image/jpeg', 0.92);

                    pdf.addImage(imgData, 'JPEG', 0, 0, img.width, img.height);

                    // Get PDF as blob
                    const pdfBlob = pdf.output('blob');
                    resolve(pdfBlob);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(imageBlob);
        });
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

    // Download image helper
    downloadImage(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Zoom OTM document viewer (button controls)
    zoomOTM(direction) {
        if (!this.currentZoom) this.currentZoom = 1;

        if (direction > 0) {
            this.currentZoom = Math.min(this.currentZoom + 0.25, 4);
        } else {
            this.currentZoom = Math.max(this.currentZoom - 0.25, 0.5);
        }

        this.applyZoom();
    }

    // Apply zoom to the image
    applyZoom() {
        const img = document.getElementById('otm-viewer-image');
        if (img) {
            img.style.transform = `scale(${this.currentZoom})`;
        }
    }

    // Initialize pinch-to-zoom and pan on the viewer
    initPinchZoom() {
        const container = document.getElementById('otm-zoom-container');
        const img = document.getElementById('otm-viewer-image');

        if (!container || !img) return;

        let initialDistance = 0;
        let initialZoom = 1;
        let isDragging = false;
        let startX = 0, startY = 0;
        let translateX = 0, translateY = 0;
        let lastTranslateX = 0, lastTranslateY = 0;

        // Get distance between two touch points
        const getDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // Apply transform
        const applyTransform = () => {
            img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${this.currentZoom})`;
        };

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Pinch start
                e.preventDefault();
                initialDistance = getDistance(e.touches);
                initialZoom = this.currentZoom || 1;
                isDragging = false;
            } else if (e.touches.length === 1 && this.currentZoom > 1) {
                // Pan start (only when zoomed)
                isDragging = true;
                startX = e.touches[0].clientX - lastTranslateX;
                startY = e.touches[0].clientY - lastTranslateY;
            }
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Pinch zoom
                e.preventDefault();
                const currentDistance = getDistance(e.touches);
                const scale = currentDistance / initialDistance;
                this.currentZoom = Math.min(Math.max(initialZoom * scale, 1), 5);

                // Reset position when zoom resets to 1
                if (this.currentZoom <= 1) {
                    translateX = 0;
                    translateY = 0;
                    lastTranslateX = 0;
                    lastTranslateY = 0;
                }
                applyTransform();
            } else if (e.touches.length === 1 && isDragging && this.currentZoom > 1) {
                // Panning
                e.preventDefault();
                translateX = e.touches[0].clientX - startX;
                translateY = e.touches[0].clientY - startY;
                applyTransform();
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            if (isDragging) {
                lastTranslateX = translateX;
                lastTranslateY = translateY;
            }
            isDragging = false;

            // Double-tap detection
            const currentTime = new Date().getTime();
            const tapLength = currentTime - (this.lastTapTime || 0);

            if (tapLength < 300 && tapLength > 0 && e.touches.length === 0 && e.changedTouches.length === 1) {
                if (this.currentZoom > 1) {
                    // Reset zoom and position
                    this.currentZoom = 1;
                    translateX = 0;
                    translateY = 0;
                    lastTranslateX = 0;
                    lastTranslateY = 0;
                } else {
                    // Zoom to 2.5x
                    this.currentZoom = 2.5;
                }
                applyTransform();
            }
            this.lastTapTime = currentTime;
        });

        // Store reset function
        this.resetZoomAndPan = () => {
            this.currentZoom = 1;
            translateX = 0;
            translateY = 0;
            lastTranslateX = 0;
            lastTranslateY = 0;
            img.style.transform = 'translate(0px, 0px) scale(1)';
        };

        this.pinchZoomInitialized = true;
    }

    // Handle login
    handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        // Find user
        const user = CONFIG.USERS.find(u =>
            u.username.toLowerCase() === username.toLowerCase() &&
            u.password === password
        );

        if (user) {
            this.currentUser = user;
            localStorage.setItem('sicoem_user', JSON.stringify(user));
            window.ui.showToast(`Bienvenido, ${user.name}`, 'success');
            this.showMainApp();
        } else {
            window.ui.showToast('Usuario o contraseña incorrectos', 'error');
        }
    }

    // Start QR Scanner
    async startScanner() {
        // Hide previous result
        document.getElementById('scan-result').style.display = 'none';

        // Stop if already scanning
        if (this.scannerActive) {
            await window.scanner.stop();
        }

        try {
            const success = await window.scanner.init('qr-reader', (code) => {
                this.onQRScanned(code);
            });

            if (success) {
                await window.scanner.start();
                this.scannerActive = true;
            } else {
                window.ui.showToast('No se pudo acceder a la cámara', 'error');
            }
        } catch (error) {
            console.error('Scanner error:', error);
            window.ui.showToast('Error al iniciar la cámara', 'error');
        }
    }

    // On QR code scanned
    onQRScanned(code) {
        console.log('QR Scanned:', code);
        this.scannerActive = false;

        // Show result briefly
        document.getElementById('scan-result').style.display = 'block';
        document.getElementById('scanned-code').textContent = code;

        // Vibrate feedback
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Auto-navigate to equipment view after brief delay
        setTimeout(() => {
            this.findEquipmentByCode(code);
        }, 800);
    }

    // Find equipment by code
    async findEquipmentByCode(code) {
        window.ui.showLoading();

        // Make sure data is loaded
        if (window.sheetsDB.equipment.length === 0) {
            await window.sheetsDB.fetchEquipment();
        }

        const equipment = window.sheetsDB.findByCode(code);

        window.ui.hideLoading();

        if (equipment) {
            window.ui.showEquipmentInfo(equipment);
        } else {
            window.ui.showToast(`Equipo no encontrado: ${code}`, 'error');
        }
    }

    // Save maintenance
    async saveMaintenance() {
        const equipment = window.ui.currentEquipment;
        if (!equipment) {
            window.ui.showToast('No hay equipo seleccionado', 'error');
            return;
        }

        const formData = window.ui.getMaintenanceFormData();

        // Validation
        if (!formData.estado) {
            window.ui.showToast('Seleccione el estado del equipo', 'error');
            return;
        }

        if (!formData.tecnico) {
            window.ui.showToast('Ingrese el nombre del técnico', 'error');
            return;
        }

        if (!formData.actividades) {
            window.ui.showToast('Ingrese al menos una actividad', 'error');
            return;
        }

        window.ui.showLoading();

        try {
            await window.sheetsDB.saveMaintenance(equipment.id, formData);

            window.ui.hideLoading();
            window.ui.showToast('✅ Mantenimiento guardado correctamente', 'success');
            window.ui.clearMaintenanceForm();

            // Return to scanner
            setTimeout(() => {
                window.ui.handleNavigation('scan');
            }, 1500);

        } catch (error) {
            window.ui.hideLoading();
            console.error('Error saving maintenance:', error);
            window.ui.showToast('Error al guardar el mantenimiento', 'error');
        }
    }

    // Logout
    logout() {
        this.currentUser = null;
        localStorage.removeItem('sicoem_user');

        // Clear login form
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';

        // Show login
        this.showLogin();

        window.ui.showToast('Sesión cerrada', 'info');
    }
}

// Create global instance
window.app = new App();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.log('SW registration failed:', err));
}
