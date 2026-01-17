// ===== SICOEM Configuration =====

const CONFIG = {
    // Google Sheets - Equipos
    SHEET_ID: '1fF8awRw7docOPw1BnY_ebx0YJPYVsW45CIVHPoYHmE0',
    EQUIPMENT_GID: '1372502879',

    // Google Sheets - Mantenimientos (crear una nueva hoja para guardar)
    MAINTENANCE_GID: '0', // Cambiar cuando se cree la hoja

    // Google Apps Script URL (para escribir en Sheets)
    // Dejar vacío por ahora, se configurará después
    APPS_SCRIPT_URL: '',

    // Google Apps Script URL for Drive Storage (OTM uploads)
    // Deploy your OTM_DriveAPI.gs and paste URL here
    DRIVE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxwhyWMhIDt1EH91heXTyGmyMkaaTh-78l50ynKuG-_G4_YWBBqX62i79mKpHmXBySV/exec',

    // App Info
    APP_NAME: 'SICOEM',
    APP_VERSION: '2.0.0',
    ORGANIZATION: 'DIRIS Lima Sur - MINSA',

    // Default Users
    USERS: [
        { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrador' },
        { username: 'tecnico', password: 'tec123', role: 'tecnico', name: 'Técnico' },
        { username: 'ronald', password: 'ronald123', role: 'admin', name: 'Ronald Zarpan' }
    ],

    // Cache duration (5 minutes)
    CACHE_DURATION: 5 * 60 * 1000,

    // Splash screen duration (reduced)
    SPLASH_DURATION: 1500
};

// Equipment status options
const EQUIPMENT_STATUS = {
    operativo: { label: 'Operativo', icon: '✅', color: '#00ff88' },
    reparacion: { label: 'En Reparación', icon: '🔧', color: '#ffcc00' },
    baja: { label: 'De Baja', icon: '❌', color: '#ff3366' },
    pendiente: { label: 'Pendiente de Repuestos', icon: '⏳', color: '#a855f7' }
};

// Export
window.CONFIG = CONFIG;
window.EQUIPMENT_STATUS = EQUIPMENT_STATUS;
