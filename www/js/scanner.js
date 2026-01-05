// ===== QR Scanner Module - Native Capacitor Version =====

class QRScanner {
    constructor() {
        this.isScanning = false;
        this.onScanSuccess = null;
        this.BarcodeScanner = null;
    }

    // Initialize scanner
    async init(elementId, onSuccess) {
        this.onScanSuccess = onSuccess;

        // Check if we're running in Capacitor (native app)
        if (window.Capacitor && window.Capacitor.Plugins.BarcodeScanner) {
            this.BarcodeScanner = window.Capacitor.Plugins.BarcodeScanner;
            return true;
        }

        // Fallback to html5-qrcode for web
        if (typeof Html5Qrcode !== 'undefined') {
            this.html5QrCode = new Html5Qrcode(elementId);
            return true;
        }

        console.error('No scanner available');
        return false;
    }

    // Start scanning
    async start() {
        if (this.isScanning) return false;

        // Try native scanner first (Capacitor)
        if (this.BarcodeScanner) {
            return this.startNativeScanner();
        }

        // Fallback to web scanner
        return this.startWebScanner();
    }

    // Native Capacitor scanner
    async startNativeScanner() {
        try {
            // Check camera permission
            const status = await this.BarcodeScanner.checkPermission({ force: true });

            if (!status.granted) {
                console.error('Camera permission denied');
                return false;
            }

            // Hide webview background to show camera
            document.querySelector('body').classList.add('scanner-active');
            await this.BarcodeScanner.hideBackground();

            this.isScanning = true;

            // Start scanning
            const result = await this.BarcodeScanner.startScan();

            // Restore background
            document.querySelector('body').classList.remove('scanner-active');
            await this.BarcodeScanner.showBackground();

            if (result.hasContent) {
                this.handleScan(result.content);
            }

            this.isScanning = false;
            return true;

        } catch (error) {
            console.error('Native scanner error:', error);
            document.querySelector('body').classList.remove('scanner-active');
            this.isScanning = false;
            return false;
        }
    }

    // Web-based scanner (html5-qrcode) - fallback
    async startWebScanner() {
        if (!this.html5QrCode) return false;

        try {
            await this.html5QrCode.start(
                { facingMode: 'environment' },
                {
                    fps: 15,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => {
                    this.handleScan(decodedText);
                },
                () => { }
            );

            this.isScanning = true;
            return true;
        } catch (error) {
            console.error('Web scanner error:', error);
            return false;
        }
    }

    // Handle successful scan
    handleScan(decodedText) {
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Play success sound
        this.playBeep();

        // Stop scanning
        this.stop();

        // Call callback
        if (this.onScanSuccess) {
            this.onScanSuccess(decodedText);
        }
    }

    // Stop scanning
    async stop() {
        if (!this.isScanning) return;

        try {
            if (this.BarcodeScanner) {
                await this.BarcodeScanner.stopScan();
                await this.BarcodeScanner.showBackground();
                document.querySelector('body').classList.remove('scanner-active');
            } else if (this.html5QrCode) {
                await this.html5QrCode.stop();
            }
            this.isScanning = false;
        } catch (error) {
            console.error('Error stopping scanner:', error);
        }
    }

    // Play beep sound
    playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // Audio not supported
        }
    }

    // Clean up
    destroy() {
        this.stop();
        if (this.html5QrCode) {
            this.html5QrCode.clear();
            this.html5QrCode = null;
        }
    }
}

// Create global instance
window.scanner = new QRScanner();
