// ===== UI Module - Redesigned =====

class UI {
    constructor() {
        this.currentView = 'scanner';
        this.currentEquipment = null;
        this.sidebarOpen = false;
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
    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
        }
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

    // Load equipment list
    async loadEquipmentList() {
        const listContainer = document.getElementById('equipment-list');
        listContainer.innerHTML = '<div class="loading-spinner">Cargando equipos...</div>';

        const equipment = await window.sheetsDB.fetchEquipment();
        this.renderEquipmentList(equipment);
    }

    // Render equipment list
    renderEquipmentList(equipment) {
        const listContainer = document.getElementById('equipment-list');

        if (!equipment || equipment.length === 0) {
            listContainer.innerHTML = '<div class="loading-spinner">No se encontraron equipos</div>';
            return;
        }

        listContainer.innerHTML = equipment.map(eq => `
            <div class="equipment-item" data-id="${eq.id}">
                <div class="equipment-icon">🏥</div>
                <div class="equipment-info">
                    <h4>${eq.nombre}</h4>
                    <p>${eq.establecimiento} • ${eq.codigo}</p>
                </div>
            </div>
        `).join('');

        // Add click handlers
        listContainer.querySelectorAll('.equipment-item').forEach(item => {
            item.addEventListener('click', () => {
                const equipment = window.sheetsDB.findById(item.dataset.id);
                if (equipment) {
                    this.showEquipmentInfo(equipment);
                }
            });
        });
    }

    // Filter equipment list
    filterEquipmentList(query) {
        if (!query) {
            this.loadEquipmentList();
            return;
        }
        const results = window.sheetsDB.search(query);
        this.renderEquipmentList(results);
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
