// ===== Google Sheets Integration Module =====

class SheetsDB {
    constructor() {
        this.equipmentSheetUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&gid=${CONFIG.EQUIPMENT_GID}`;
        this.equipment = [];
        this.maintenance = [];
        this.lastFetch = null;
    }

    // Fetch equipment data from Google Sheets
    async fetchEquipment() {
        try {
            const response = await fetch(this.equipmentSheetUrl);
            const text = await response.text();

            // Extract JSON from JSONP response
            const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
            if (!jsonStr || !jsonStr[1]) {
                throw new Error('Invalid response format');
            }

            const data = JSON.parse(jsonStr[1]);
            this.equipment = this.parseEquipmentData(data);
            this.lastFetch = Date.now();

            // Cache locally
            localStorage.setItem('sicoem_equipment', JSON.stringify(this.equipment));

            return this.equipment;
        } catch (error) {
            console.error('Error fetching from Google Sheets:', error);

            // Try cache
            const cached = localStorage.getItem('sicoem_equipment');
            if (cached) {
                this.equipment = JSON.parse(cached);
                return this.equipment;
            }

            return this.getDemoData();
        }
    }

    // Parse equipment data from Sheets response
    parseEquipmentData(data) {
        const rows = data.table.rows;
        const cols = data.table.cols;

        if (!rows || rows.length === 0) return [];

        // Get headers from first row or labels
        const headers = cols.map((col, idx) => {
            return col.label || `col${idx}`;
        });

        console.log('Headers from sheet:', headers);

        const equipment = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row.c) continue;

            const item = {};
            for (let j = 0; j < row.c.length; j++) {
                const cell = row.c[j];
                const header = this.normalizeHeader(headers[j] || `col${j}`);
                item[header] = cell ? (cell.v ?? cell.f ?? '') : '';
            }

            // Debug first item
            if (i === 0) {
                console.log('First row data:', item);
                console.log('CODIGO_ACTIVO value:', item.codigoactivo);
            }

            // Map to standard structure based on actual columns from Google Sheets:
            // CODIGO_ACTIVO (col 3), DESCRIPCION (col 7), NOMBRE_SEDE (col 9), 
            // NRO_SERIE (col 17), MARCA (col 18), MODELO (col 15)
            const codigoRaw = item.codigoactivo || '';
            const codigo = String(codigoRaw).trim();

            equipment.push({
                id: i + 1,
                // Código Activo - column 3 (CODIGO_ACTIVO)
                codigo: codigo,
                // Descripción del equipo - column 7 (DESCRIPCION)
                nombre: item.descripcion || 'Sin nombre',
                // Marca - column 18 (MARCA) - comes as number/ID
                marca: String(item.marca || '-'),
                // Modelo - column 15 (MODELO) 
                modelo: item.modelo || '-',
                // Serie - column 17 (NRO_SERIE)
                serie: item.nroserie || '-',
                // Nombre Sede / Ambiente - column 9 (NOMBRE_SEDE)
                ambiente: item.nombresede || '-',
                // Establecimiento
                establecimiento: item.nombresede || CONFIG.ORGANIZATION,
                // Antigüedad - column 4 (Antigüedad)
                antiguedad: item.antiguedad || '-',
                // Estado - column 5 (ESTADO) 
                estado: item.estado === 1 ? 'operativo' : (item.estado === 0 ? 'baja' : 'operativo'),
                // Último mantenimiento
                ultimoMantenimiento: '-',
                // Próximo mantenimiento
                proximoMantenimiento: '-',
                // Técnico
                tecnico: '-',
                // Additional info
                sede: item.sede || '-',
                familia: item.familia || '-'
            });
        }

        console.log(`Parsed ${equipment.length} equipment items`);
        // Log a few sample codes for debugging
        if (equipment.length > 0) {
            console.log('Sample codes:', equipment.slice(0, 5).map(e => e.codigo));
        }
        return equipment;
    }



    // Normalize header names
    normalizeHeader(header) {
        return header
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    // Find equipment by code
    findByCode(code) {
        const normalized = code.toString().trim();
        console.log('Searching for code:', normalized);
        console.log('Available equipment count:', this.equipment.length);

        // First try exact match
        let result = this.equipment.find(eq =>
            eq.codigo.toString().trim() === normalized
        );

        if (result) {
            console.log('Found exact match:', result.nombre);
            return result;
        }

        // Try partial match (code contains search or search contains code)
        result = this.equipment.find(eq => {
            const eqCode = eq.codigo.toString().trim();
            return eqCode.includes(normalized) || normalized.includes(eqCode);
        });

        if (result) {
            console.log('Found partial match:', result.nombre);
        } else {
            console.log('No equipment found for code:', normalized);
            // Log first 5 codes for debugging
            console.log('Sample codes:', this.equipment.slice(0, 5).map(e => e.codigo));
        }

        return result;
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
            eq.codigo.toString().includes(q) ||
            eq.ambiente.toLowerCase().includes(q) ||
            eq.marca.toLowerCase().includes(q) ||
            eq.establecimiento.toLowerCase().includes(q)
        );
    }

    // Save maintenance record to Google Sheets
    async saveMaintenance(equipmentId, data) {
        const equipment = this.findById(equipmentId);
        if (!equipment) {
            throw new Error('Equipo no encontrado');
        }

        const record = {
            id: Date.now(),
            equipmentId,
            codigoPatrimonial: equipment.codigo,
            nombreEquipo: equipment.nombre,
            establecimiento: equipment.establecimiento,
            ambiente: equipment.ambiente,
            actividades: data.actividades,
            repuestos: data.repuestos,
            estado: data.estado,
            tecnico: data.tecnico,
            fechaUltimo: data.fechaUltimo,
            fechaSiguiente: data.fechaSiguiente,
            observaciones: data.observaciones,
            fechaRegistro: new Date().toISOString(),
            sincronizado: false
        };

        // Save to local storage
        const records = JSON.parse(localStorage.getItem('sicoem_maintenance') || '[]');
        records.push(record);
        localStorage.setItem('sicoem_maintenance', JSON.stringify(records));

        // Try to sync with Google Sheets via Apps Script
        await this.syncToSheets(record);

        return record;
    }

    // Sync maintenance to Google Sheets via Apps Script Web App
    async syncToSheets(record) {
        if (!CONFIG.APPS_SCRIPT_URL) {
            console.log('Apps Script URL not configured, skipping sync');
            return false;
        }

        try {
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'addMaintenance',
                    data: record
                })
            });

            // Mark as synced
            record.sincronizado = true;
            return true;
        } catch (error) {
            console.error('Error syncing to Sheets:', error);
            return false;
        }
    }

    // Get maintenance history for equipment
    getMaintenanceHistory(equipmentId) {
        const records = JSON.parse(localStorage.getItem('sicoem_maintenance') || '[]');
        return records
            .filter(r => r.equipmentId === equipmentId)
            .sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));
    }

    // Get all maintenance records
    getAllMaintenance() {
        return JSON.parse(localStorage.getItem('sicoem_maintenance') || '[]');
    }

    // Get statistics
    getStats() {
        const total = this.equipment.length;
        const estados = this.equipment.reduce((acc, eq) => {
            const estado = eq.estado.toLowerCase();
            if (estado.includes('operativo')) acc.operativos++;
            else if (estado.includes('reparacion') || estado.includes('reparación')) acc.reparacion++;
            else if (estado.includes('baja')) acc.baja++;
            return acc;
        }, { operativos: 0, reparacion: 0, baja: 0 });

        const maintenance = this.getAllMaintenance();
        const thisMonth = maintenance.filter(m => {
            const fecha = new Date(m.fechaRegistro);
            const now = new Date();
            return fecha.getMonth() === now.getMonth() && fecha.getFullYear() === now.getFullYear();
        }).length;

        return {
            total,
            ...estados,
            mantenimientosMes: thisMonth
        };
    }

    // Demo data
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
                establecimiento: 'CMI José Carlos Mariátegui',
                antiguedad: '2 años',
                estado: 'operativo',
                ultimoMantenimiento: '2024-06-15',
                proximoMantenimiento: '2024-12-15',
                tecnico: 'Ronald Zarpan'
            },
            {
                id: 2,
                codigo: '74084513',
                nombre: 'Centrífuga',
                marca: 'Thermo Scientific',
                modelo: 'Heraeus Pico 17',
                serie: 'TS-2022-045',
                ambiente: 'Laboratorio',
                establecimiento: 'CMI José Carlos Mariátegui',
                antiguedad: '3 años',
                estado: 'operativo',
                ultimoMantenimiento: '2024-05-20',
                proximoMantenimiento: '2024-11-20',
                tecnico: 'Ronald Zarpan'
            },
            {
                id: 3,
                codigo: '74084514',
                nombre: 'Ecógrafo',
                marca: 'GE Healthcare',
                modelo: 'Voluson E8',
                serie: 'GE-2021-089',
                ambiente: 'Ginecología',
                establecimiento: 'CMI José Carlos Mariátegui',
                antiguedad: '4 años',
                estado: 'En Reparación',
                ultimoMantenimiento: '2024-07-10',
                proximoMantenimiento: '2025-01-10',
                tecnico: 'Técnico Externo'
            }
        ];
    }
}

// Create global instance
window.sheetsDB = new SheetsDB();
