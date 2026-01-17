// ===== UI Module - Redesigned =====

class UI {
    constructor() {
        this.currentView = 'scanner';
        this.currentEquipment = null;
        this.sidebarOpen = false;
        this.navigationHistory = ['scanner']; // Track navigation history for back button
    }

    init() {
        this.setupEventListeners();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
    }

    setupEventListeners() {
        // Menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Sidebar overlay
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.closeSidebar());
        }

        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleNavigation(action);
            });
        });

        // Admin cards
        document.querySelectorAll('.admin-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.admin;
                this.handleAdminAction(action);
            });
        });

        // Search input
        const searchInput = document.getElementById('search-equipment');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterEquipmentList(e.target.value);
            });
        }
    }

    // Toggle sidebar
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        document.getElementById('sidebar').classList.toggle('open', this.sidebarOpen);
        document.getElementById('sidebar-overlay').classList.toggle('active', this.sidebarOpen);
    }

    closeSidebar() {
        this.sidebarOpen = false;
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }

    // Update time display
    updateTime() {
        const timeEl = document.getElementById('current-time');
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // Handle navigation
    handleNavigation(action) {
        // ALWAYS stop the scanner when navigating away
        if (window.app && window.app.scannerActive) {
            window.app.stopScanning();
        }
        // Also stop native scanner if running
        if (window.scanner) {
            window.scanner.stop();
        }

        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.action === action);
        });

        this.closeSidebar();

        switch (action) {
            case 'scan':
                this.showView('scanner');
                document.getElementById('page-title').textContent = 'Cámara QR';
                // Reset scanner view to start state
                document.getElementById('scan-start').style.display = 'flex';
                document.getElementById('scanner-active').style.display = 'none';
                document.getElementById('scan-result').style.display = 'none';
                break;
            case 'verify':
                this.showView('verify');
                document.getElementById('page-title').textContent = 'Verificar Equipo';
                break;
            case 'admin':
                this.showView('admin');
                document.getElementById('page-title').textContent = 'Panel de Administrador';
                break;
            case 'location':
                this.showToast('Función en desarrollo', 'info');
                break;
            case 'logout':
                window.app.logout();
                break;
        }
    }

    // Handle admin actions
    handleAdminAction(action) {
        switch (action) {
            case 'view-all':
                this.showView('equipment-list');
                document.getElementById('page-title').textContent = 'Lista de Equipos';
                this.loadEquipmentList();
                break;
            case 'add-equipment':
                this.showToast('Función en desarrollo', 'info');
                break;
            case 'reports':
                this.showToast('Función en desarrollo', 'info');
                break;
            case 'users':
                this.showToast('Función en desarrollo', 'info');
                break;
            case 'maintenance-history':
                this.showMaintenanceHistory();
                break;
            case 'settings':
                this.showToast('Función en desarrollo', 'info');
                break;
        }
    }

    // Show view
    showView(viewName, addToHistory = true) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');

            // Add to navigation history (avoid duplicates at top)
            if (addToHistory && this.navigationHistory[this.navigationHistory.length - 1] !== viewName) {
                this.navigationHistory.push(viewName);
                // Keep history reasonable size
                if (this.navigationHistory.length > 20) {
                    this.navigationHistory.shift();
                }
            }

            this.currentView = viewName;
        }
    }

    // Go back to previous view (for Android back button)
    goBack() {
        // Close sidebar if open
        if (this.sidebarOpen) {
            this.closeSidebar();
            return true;
        }

        // Close OTM viewer if open
        const otmModal = document.getElementById('otm-viewer-modal');
        if (otmModal && otmModal.classList.contains('active')) {
            if (window.app) window.app.closeOTMViewer();
            return true;
        }

        // Close PDF modal if open
        const pdfModal = document.getElementById('dynamic-pdf-modal');
        if (pdfModal) {
            if (window.app) window.app.closePDFModal();
            return true;
        }

        // Navigate to previous view in history
        if (this.navigationHistory.length > 1) {
            this.navigationHistory.pop();
            const previousView = this.navigationHistory[this.navigationHistory.length - 1];
            this.showView(previousView, false);

            // Update page title based on view
            const titles = {
                'scanner': 'Información de Equipo',
                'equipment': 'Información del Equipo',
                'admin': 'Panel de Administrador',
                'verify': 'Verificar Equipo',
                'equipment-list': 'Lista de Equipos'
            };
            document.getElementById('page-title').textContent = titles[previousView] || 'SICOEM';

            return true;
        }

        return false;
    }

    // Show equipment info
    showEquipmentInfo(equipment) {
        this.currentEquipment = equipment;

        // Update info fields
        document.getElementById('info-establecimiento').textContent = equipment.establecimiento || '-';
        document.getElementById('info-ambiente').textContent = equipment.ambiente || '-';
        document.getElementById('info-nombre').textContent = equipment.nombre || '-';
        document.getElementById('info-marca').textContent = equipment.marca || '-';
        document.getElementById('info-modelo').textContent = equipment.modelo || '-';
        document.getElementById('info-serie').textContent = equipment.serie || '-';
        document.getElementById('info-codigo').textContent = equipment.codigo || '-';
        document.getElementById('info-antiguedad').textContent = equipment.antiguedad || '-';

        // Show equipment view
        this.showView('equipment');
        document.getElementById('page-title').textContent = 'Información del Equipo';

        // Load OTM list for this equipment
        if (window.app && equipment.codigo) {
            window.app.loadEquipmentOTMList(equipment.codigo);
        }
    }

    // Get form data
    getMaintenanceFormData() {
        const actividades = [];
        for (let i = 1; i <= 8; i++) {
            const value = document.getElementById(`actividad-${i}`).value.trim();
            if (value) actividades.push(value);
        }

        const repuestos = [];
        for (let i = 1; i <= 3; i++) {
            const value = document.getElementById(`repuesto-${i}`).value.trim();
            if (value) repuestos.push(value);
        }

        return {
            actividades: actividades.join(' | '),
            repuestos: repuestos.join(' | '),
            estado: document.getElementById('estado-equipo').value,
            tecnico: document.getElementById('nombre-tecnico').value.trim(),
            fechaUltimo: document.getElementById('fecha-ultimo').value,
            fechaSiguiente: document.getElementById('fecha-siguiente').value,
            observaciones: document.getElementById('observaciones').value.trim()
        };
    }

    // Clear form
    clearMaintenanceForm() {
        for (let i = 1; i <= 8; i++) {
            document.getElementById(`actividad-${i}`).value = '';
        }
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`repuesto-${i}`).value = '';
        }
        document.getElementById('estado-equipo').value = '';
        document.getElementById('nombre-tecnico').value = '';
        document.getElementById('observaciones').value = '';
    }

    // Initialize equipment list filters
    initEquipmentFilters() {
        this.selectedEstablecimiento = null;
        this.establecimientos = [];

        const establInput = document.getElementById('filter-establecimiento');
        const equipoInput = document.getElementById('filter-equipo');
        const searchBtn = document.getElementById('search-equipment-btn');
        const suggestionsDiv = document.getElementById('establecimiento-suggestions');

        if (!establInput) return;

        // Get unique establishments from equipment data
        this.establecimientos = [...new Set(window.sheetsDB.equipment.map(eq => eq.establecimiento))].filter(Boolean).sort();

        // Establishment input - show suggestions
        establInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.selectedEstablecimiento = null;
            equipoInput.disabled = true;
            searchBtn.disabled = true;

            if (query.length < 2) {
                suggestionsDiv.classList.remove('active');
                return;
            }

            const matches = this.establecimientos.filter(est =>
                est.toLowerCase().includes(query)
            ).slice(0, 10);

            if (matches.length > 0) {
                suggestionsDiv.innerHTML = matches.map(est =>
                    `<div class="suggestion-item">${est}</div>`
                ).join('');
                suggestionsDiv.classList.add('active');

                // Add click handlers to suggestions
                suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        establInput.value = item.textContent;
                        this.selectedEstablecimiento = item.textContent;
                        suggestionsDiv.classList.remove('active');
                        equipoInput.disabled = false;
                        equipoInput.focus();
                    });
                });
            } else {
                suggestionsDiv.classList.remove('active');
            }
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-group')) {
                suggestionsDiv.classList.remove('active');
            }
        });

        // Equipment input - enable search button
        equipoInput.addEventListener('input', (e) => {
            searchBtn.disabled = !this.selectedEstablecimiento;
        });

        // Search button click
        searchBtn.addEventListener('click', () => {
            this.searchEquipment();
        });

        // Enter key on equipment input
        equipoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.selectedEstablecimiento) {
                this.searchEquipment();
            }
        });
    }

    // Search equipment with filters
    searchEquipment() {
        const equipoQuery = document.getElementById('filter-equipo').value.toLowerCase();
        const resultsDiv = document.getElementById('equipment-results');

        if (!this.selectedEstablecimiento) {
            window.ui.showToast('Seleccione un establecimiento primero', 'error');
            return;
        }

        resultsDiv.innerHTML = '<div class="loading-spinner">Buscando equipos...</div>';

        // Filter by establishment first
        let results = window.sheetsDB.equipment.filter(eq =>
            eq.establecimiento === this.selectedEstablecimiento
        );

        // Then filter by equipment name if provided
        if (equipoQuery) {
            results = results.filter(eq =>
                eq.nombre?.toLowerCase().includes(equipoQuery)
            );
        }

        this.renderFilteredEquipment(results);
    }

    // Render filtered equipment results
    renderFilteredEquipment(equipment) {
        const resultsDiv = document.getElementById('equipment-results');

        if (!equipment || equipment.length === 0) {
            resultsDiv.innerHTML = `
                <div class="filter-instructions">
                    <p>❌ No se encontraron equipos con estos criterios</p>
                </div>
            `;
            return;
        }

        resultsDiv.innerHTML = `
            <div class="result-count">📊 ${equipment.length} equipo(s) encontrado(s)</div>
            ${equipment.map(eq => `
                <div class="equipment-result-item" data-id="${eq.id}">
                    <h4>🔧 ${eq.nombre || 'Sin nombre'}</h4>
                    <p><span class="equipment-code">${eq.codigo}</span> • ${eq.marca || ''} ${eq.modelo || ''}</p>
                    <p>📍 ${eq.ambiente || 'Sin ambiente'}</p>
                </div>
            `).join('')}
        `;

        // Add click handlers
        resultsDiv.querySelectorAll('.equipment-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const equipment = window.sheetsDB.findById(item.dataset.id);
                if (equipment) {
                    this.showEquipmentInfo(equipment);
                }
            });
        });
    }

    // Legacy: Load equipment list (now uses filters)
    async loadEquipmentList() {
        // Wait for data to be ready
        if (window.sheetsDB.equipment.length === 0) {
            await window.sheetsDB.fetchEquipment();
        }
        // Initialize filters
        this.initEquipmentFilters();
    }

    // Show maintenance history
    showMaintenanceHistory() {
        const history = window.sheetsDB.getAllMaintenance();
        if (history.length === 0) {
            this.showToast('No hay registros de mantenimiento', 'info');
            return;
        }
        // TODO: Show history view
        this.showToast(`${history.length} registros de mantenimiento`, 'info');
    }

    // Show loading
    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    }

    // Toast notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Create global instance
window.ui = new UI();
