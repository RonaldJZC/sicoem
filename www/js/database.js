// ===== Database Module - Google Sheets Integration =====

class Database {
    constructor() {
        this.equipment = [];
        this.maintenance = [];
        this.lastFetch = null;
        this.isLoaded = false;
    }

    // Fetch data from Google Sheets
    async fetchFromSheets() {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&gid=${CONFIG.SHEET_GID}`;

            const response = await fetch(url);
            const text = await response.text();

            // Google returns JSONP, we need to extract the JSON
            const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
            if (!jsonStr || !jsonStr[1]) {
                throw new Error('Invalid response from Google Sheets');
            }

            const data = JSON.parse(jsonStr[1]);
            return this.parseSheetData(data);
        } catch (error) {
            console.error('Error fetching from Google Sheets:', error);
            // Return cached data or demo data
            return this.getDemoData();
        }
    }

    // Parse Google Sheets response
    parseSheetData(data) {
        const rows = data.table.rows;
        const cols = data.table.cols;

        if (!rows || rows.length === 0) {
            return [];
        }

        // Get column headers
        const headers = cols.map(col => col.label || '');

        // Parse rows
        const equipment = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row.c) continue;

            const item = {};
            for (let j = 0; j < row.c.length; j++) {
                const cell = row.c[j];
                const header = headers[j] || `col${j}`;
                item[header] = cell ? (cell.v || cell.f || '') : '';
            }

            // Map to our standard format
            equipment.push(this.mapToEquipment(item, i + 1));
        }

        return equipment;
    }

    // Map sheet data to equipment object
    mapToEquipment(item, id) {
        return {
            id: id,
            codigo: item['Código Patrimonial'] || item['CODIGO'] || item['codigo'] || `EQ-${id}`,
            nombre: item['Nombre'] || item['NOMBRE'] || item['Equipo'] || item['EQUIPO'] || 'Sin nombre',
            marca: item['Marca'] || item['MARCA'] || '-',
            modelo: item['Modelo'] || item['MODELO'] || '-',
            serie: item['Serie'] || item['SERIE'] || '-',
            ambiente: item['Ambiente'] || item['AMBIENTE'] || item['Ubicación'] || item['UBICACION'] || '-',
            establecimiento: item['Establecimiento'] || CONFIG.ORGANIZATION,
            estado: this.parseEstado(item['Estado'] || item['ESTADO'] || 'operativo'),
            ultimoMantenimiento: item['Último Mantenimiento'] || item['ULTIMO_MANT'] || '-',
            proximoMantenimiento: item['Próximo Mantenimiento'] || item['PROXIMO_MANT'] || '-',
            tecnico: item['Técnico'] || item['TECNICO'] || '-',
            actividades: item['Actividades'] || item['ACTIVIDADES'] || '-',
            repuestos: item['Repuestos'] || item['REPUESTOS'] || '-',
            observaciones: item['Observaciones'] || item['OBSERVACIONES'] || ''
        };
    }

    // Parse estado string to standardized format
    parseEstado(estado) {
        const str = estado.toString().toLowerCase();
        if (str.includes('baja') || str.includes('inoperativo')) return 'baja';
        if (str.includes('reparacion') || str.includes('reparación')) return 'reparacion';
        return 'operativo';
    }

    // Get demo data for testing
    getDemoData() {
        return [
            {
                id: 1,
                codigo: '74084512',
                nombre: 'Microscopio Binocular',
                marca: 'Olympus',
                modelo: 'CX23',
                serie: 'OLY-2023-001',
                ambiente: 'Laboratorio',
                establecimiento: CONFIG.ORGANIZATION,
                estado: 'operativo',
                ultimoMantenimiento: '2024-06-15',
                proximoMantenimiento: '2024-12-15',
                tecnico: 'Ronald Zarpan',
                actividades: 'Limpieza de lentes, calibración, verificación de iluminación',
                repuestos: 'Ninguno',
                observaciones: 'Equipo en buen estado'
            },
            {
                id: 2,
                codigo: '74084513',
                nombre: 'Centrífuga',
                marca: 'Thermo Scientific',
                modelo: 'Heraeus Pico 17',
                serie: 'TS-2022-045',
                ambiente: 'Laboratorio',
                establecimiento: CONFIG.ORGANIZATION,
                estado: 'operativo',
                ultimoMantenimiento: '2024-05-20',
                proximoMantenimiento: '2024-11-20',
                tecnico: 'Ronald Zarpan',
                actividades: 'Verificación de velocidad, limpieza de rotor',
                repuestos: 'Ninguno',
                observaciones: ''
            },
            {
                id: 3,
                codigo: '74084514',
                nombre: 'Ecógrafo',
                marca: 'GE Healthcare',
                modelo: 'Voluson E8',
                serie: 'GE-2021-089',
                ambiente: 'Ginecología',
                establecimiento: CONFIG.ORGANIZATION,
                estado: 'reparacion',
                ultimoMantenimiento: '2024-07-10',
                proximoMantenimiento: '2025-01-10',
                tecnico: 'Técnico Externo',
                actividades: 'Diagnóstico de falla en transductor',
                repuestos: 'Transductor convexo (pendiente)',
                observaciones: 'Equipo en espera de repuesto'
            },
            {
                id: 4,
                codigo: '74084515',
                nombre: 'Monitor de Signos Vitales',
                marca: 'Philips',
                modelo: 'IntelliVue MX40',
                serie: 'PH-2020-112',
                ambiente: 'Emergencia',
                establecimiento: CONFIG.ORGANIZATION,
                estado: 'operativo',
                ultimoMantenimiento: '2024-08-01',
                proximoMantenimiento: '2025-02-01',
                tecnico: 'Ronald Zarpan',
                actividades: 'Calibración de sensores, actualización de software',
                repuestos: 'Ninguno',
                observaciones: 'Funcionando correctamente'
            },
            {
                id: 5,
                codigo: '74084516',
                nombre: 'Autoclave',
                marca: 'Tuttnauer',
                modelo: '3870EA',
                serie: 'TT-2019-067',
                ambiente: 'Esterilización',
                establecimiento: CONFIG.ORGANIZATION,
                estado: 'operativo',
                ultimoMantenimiento: '2024-04-15',
                proximoMantenimiento: '2024-10-15',
                tecnico: 'Ronald Zarpan',
                actividades: 'Cambio de empaque, prueba de presión',
                repuestos: 'Empaque de puerta',
                observaciones: 'Requiere monitoreo de empaque'
            }
        ];
    }

    // Load equipment data
    async loadEquipment() {
        // Check cache
        if (this.equipment.length > 0 && this.lastFetch) {
            const elapsed = Date.now() - this.lastFetch;
            if (elapsed < CONFIG.CACHE_DURATION) {
                return this.equipment;
            }
        }

        try {
            this.equipment = await this.fetchFromSheets();
            this.lastFetch = Date.now();
            this.isLoaded = true;

            // Save to localStorage as backup
            localStorage.setItem('sicoem_equipment', JSON.stringify(this.equipment));
        } catch (error) {
            console.error('Error loading equipment:', error);
            // Try to load from localStorage
            const cached = localStorage.getItem('sicoem_equipment');
            if (cached) {
                this.equipment = JSON.parse(cached);
            } else {
                this.equipment = this.getDemoData();
            }
        }

        return this.equipment;
    }

    // Find equipment by code
    findByCode(code) {
        return this.equipment.find(eq =>
            eq.codigo === code ||
            eq.codigo.includes(code) ||
            code.includes(eq.codigo)
        );
    }

    // Find equipment by ID
    findById(id) {
        return this.equipment.find(eq => eq.id === parseInt(id));
    }

    // Search equipment
    search(query) {
        const q = query.toLowerCase();
        return this.equipment.filter(eq =>
            eq.nombre.toLowerCase().includes(q) ||
            eq.codigo.toLowerCase().includes(q) ||
            eq.ambiente.toLowerCase().includes(q) ||
            eq.marca.toLowerCase().includes(q)
        );
    }

    // Get statistics
    getStats() {
        const total = this.equipment.length;
        const operativos = this.equipment.filter(eq => eq.estado === 'operativo').length;
        const enReparacion = this.equipment.filter(eq => eq.estado === 'reparacion').length;
        const deBaja = this.equipment.filter(eq => eq.estado === 'baja').length;

        // Mantenimientos pendientes (próximo mantenimiento ya pasó o en los próximos 30 días)
        const today = new Date();
        const pendientes = this.equipment.filter(eq => {
            if (!eq.proximoMantenimiento || eq.proximoMantenimiento === '-') return false;
            const fecha = new Date(eq.proximoMantenimiento);
            const diff = (fecha - today) / (1000 * 60 * 60 * 24);
            return diff <= 30;
        }).length;

        return { total, operativos, enReparacion, deBaja, pendientes };
    }

    // Save maintenance record (to localStorage for now)
    saveMaintenance(equipmentId, maintenanceData) {
        const record = {
            id: Date.now(),
            equipmentId,
            ...maintenanceData,
            fecha: new Date().toISOString().split('T')[0],
            sincronizado: false
        };

        // Get existing records
        const records = JSON.parse(localStorage.getItem('sicoem_maintenance') || '[]');
        records.push(record);
        localStorage.setItem('sicoem_maintenance', JSON.stringify(records));

        // Update equipment status locally
        const equipment = this.findById(equipmentId);
        if (equipment) {
            equipment.estado = maintenanceData.estado;
            equipment.ultimoMantenimiento = record.fecha;
            equipment.proximoMantenimiento = maintenanceData.proximoMantenimiento;
            equipment.actividades = maintenanceData.actividades;
            equipment.repuestos = maintenanceData.repuestos;
            equipment.tecnico = maintenanceData.tecnico || 'Usuario';

            localStorage.setItem('sicoem_equipment', JSON.stringify(this.equipment));
        }

        return record;
    }

    // Get maintenance history for equipment
    getMaintenanceHistory(equipmentId) {
        const records = JSON.parse(localStorage.getItem('sicoem_maintenance') || '[]');
        return records
            .filter(r => r.equipmentId === equipmentId)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
}

// Create global instance
window.db = new Database();
