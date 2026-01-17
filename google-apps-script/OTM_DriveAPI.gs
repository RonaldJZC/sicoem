// ===== SICOEM OTM Drive Storage - Google Apps Script =====
// Despliega este script como Web App para subir OTMs a Google Drive
// Instrucciones:
// 1. Copia este código a script.google.com
// 2. Cambia FOLDER_ID por el ID de tu carpeta de Drive
// 3. Cambia SHEET_ID por el ID de tu hoja de metadatos
// 4. Deploy > New deployment > Web App
// 5. Execute as: Me, Access: Anyone
// 6. Copia la URL y ponla en config.js

// ===== CONFIGURACIÓN =====
const FOLDER_ID = '1a0Z2ctKeDmMEwNS_1yUtMW6fngpnxzhZK6';  // Carpeta SICOEM_OTMs
const SHEET_ID = '1fF8awRw7docOPw1BnY_ebx0YJPYVsW45CIVHPoYHmE0';
const METADATA_SHEET_NAME = 'OTM_Metadata';

// ===== FUNCIONES PRINCIPALES =====

// POST: Subir archivo (accepts both JSON and form data)
function doPost(e) {
  try {
    let data;
    
    // Try to parse as JSON first (from fetch with JSON body)
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseError) {
        // If JSON parse fails, use form parameters
        data = e.parameter;
      }
    } else {
      // Use form parameters (from form submission)
      data = e.parameter;
    }
    
    // Check for action field
    if (data.action === 'upload') {
      return uploadOTM(data);
    }
    
    return jsonResponse({ error: 'Acción no válida', received: JSON.stringify(data) }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack }, 500);
  }
}

// GET: Listar o descargar OTMs
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'list') {
      const equipmentCode = e.parameter.equipmentCode;
      return listOTMs(equipmentCode);
    }
    
    if (action === 'download') {
      const fileId = e.parameter.fileId;
      return getDownloadUrl(fileId);
    }
    
    // Get file content as base64 for local viewing
    if (action === 'getContent') {
      const fileId = e.parameter.fileId;
      return getFileContent(fileId);
    }
    
    return jsonResponse({ error: 'Acción no válida' }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// ===== FUNCIONES DE NEGOCIO =====

// Obtener o crear la carpeta raíz de OTMs
function getRootFolder() {
  const folderName = 'SICOEM_OTMs';
  
  // Si hay FOLDER_ID configurado, usarlo
  if (FOLDER_ID && FOLDER_ID !== 'TU_FOLDER_ID_AQUI') {
    try {
      return DriveApp.getFolderById(FOLDER_ID);
    } catch (e) {
      Logger.log('No se pudo acceder a FOLDER_ID, creando carpeta nueva');
    }
  }
  
  // Buscar o crear en raíz de Drive
  const folders = DriveApp.getRootFolder().getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  
  // Crear la carpeta
  Logger.log('Creando carpeta: ' + folderName);
  return DriveApp.getRootFolder().createFolder(folderName);
}

// Subir OTM a Drive
function uploadOTM(data) {
  Logger.log('uploadOTM iniciado');
  Logger.log('Data recibida: ' + JSON.stringify(data));
  
  const { equipmentCode, fileName, fileData, technician, date } = data;
  
  if (!fileData) {
    Logger.log('ERROR: fileData está vacío');
    return jsonResponse({ success: false, error: 'fileData vacío' });
  }
  
  Logger.log('Decodificando base64...');
  const decoded = Utilities.base64Decode(fileData);
  Logger.log('Decodificado, bytes: ' + decoded.length);
  
  const blob = Utilities.newBlob(decoded, 'application/pdf', fileName);
  Logger.log('Blob creado: ' + fileName);
  
  // Obtener carpeta raíz
  Logger.log('Obteniendo carpeta raíz...');
  const rootFolder = getRootFolder();
  Logger.log('Carpeta raíz: ' + rootFolder.getName() + ' ID: ' + rootFolder.getId());
  
  // Obtener o crear carpeta del equipo
  let equipmentFolder;
  const folders = rootFolder.getFoldersByName(equipmentCode);
  if (folders.hasNext()) {
    equipmentFolder = folders.next();
    Logger.log('Carpeta equipo existente: ' + equipmentCode);
  } else {
    equipmentFolder = rootFolder.createFolder(equipmentCode);
    Logger.log('Carpeta equipo creada: ' + equipmentCode);
  }
  
  // Subir archivo
  Logger.log('Subiendo archivo...');
  const file = equipmentFolder.createFile(blob);
  file.setDescription(`OTM - ${equipmentCode} - ${date} - Técnico: ${technician}`);
  Logger.log('Archivo subido! ID: ' + file.getId());
  
  // Guardar metadata en Sheet
  try {
    saveMetadata({
      fileId: file.getId(),
      fileName: fileName,
      equipmentCode: equipmentCode,
      technician: technician,
      date: date,
      url: file.getUrl(),
      createdAt: new Date().toISOString()
    });
    Logger.log('Metadata guardada');
  } catch (metaError) {
    Logger.log('Error guardando metadata: ' + metaError.message);
  }
  
  Logger.log('uploadOTM completado exitosamente');
  return jsonResponse({
    success: true,
    fileId: file.getId(),
    url: file.getUrl(),
    message: 'OTM subido correctamente'
  });
}

// Listar OTMs de un equipo (busca directamente en Drive)
function listOTMs(equipmentCode) {
  try {
    Logger.log('listOTMs called for: ' + equipmentCode);
    
    // Get or create root folder
    const rootFolder = getRootFolder();
    
    // Look for equipment folder
    const equipFolders = rootFolder.getFoldersByName(equipmentCode);
    
    if (!equipFolders.hasNext()) {
      Logger.log('No equipment folder found for: ' + equipmentCode);
      return jsonResponse({ otms: [] });
    }
    
    const equipFolder = equipFolders.next();
    const files = equipFolder.getFiles();
    
    const otms = [];
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      
      // Extract date from filename: OTM_CODE_DATE.pdf
      let date = '';
      const match = fileName.match(/_(\d{1,2}-\d{1,2}-\d{4})\.pdf$/);
      if (match) {
        date = match[1];
      }
      
      otms.push({
        fileId: file.getId(),
        fileName: fileName,
        date: date,
        url: file.getUrl(),
        createdAt: file.getDateCreated().toISOString()
      });
    }
    
    // Sort by creation date (newest first)
    otms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    Logger.log('Found ' + otms.length + ' OTMs for ' + equipmentCode);
    return jsonResponse({ otms: otms });
    
  } catch (error) {
    Logger.log('Error in listOTMs: ' + error.message);
    return jsonResponse({ otms: [], error: error.message });
  }
}

// Obtener URL de descarga
function getDownloadUrl(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return jsonResponse({
      url: file.getDownloadUrl(),
      viewUrl: file.getUrl()
    });
  } catch (error) {
    return jsonResponse({ error: 'Archivo no encontrado' }, 404);
  }
}

// Obtener contenido del archivo como base64
function getFileContent(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();
    const fileName = file.getName();
    
    return jsonResponse({
      success: true,
      fileName: fileName,
      mimeType: mimeType,
      content: base64
    });
  } catch (error) {
    Logger.log('Error getting file content: ' + error.message);
    return jsonResponse({ error: 'No se pudo obtener el archivo: ' + error.message }, 500);
  }
}

// ===== FUNCIONES AUXILIARES =====

// Guardar metadata en Sheet
function saveMetadata(metadata) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(METADATA_SHEET_NAME);
  
  // Crear hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet(METADATA_SHEET_NAME);
    sheet.appendRow(['fileId', 'fileName', 'equipmentCode', 'technician', 'date', 'url', 'createdAt']);
  }
  
  sheet.appendRow([
    metadata.fileId,
    metadata.fileName,
    metadata.equipmentCode,
    metadata.technician,
    metadata.date,
    metadata.url,
    metadata.createdAt
  ]);
}

// Respuesta JSON
function jsonResponse(data, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== TEST =====
function testUpload() {
  const testData = {
    action: 'upload',
    equipmentCode: 'TEST-001',
    fileName: 'OTM_TEST-001_2026-01-06.pdf',
    fileData: 'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+Pg==', // Mini PDF
    technician: 'Test User',
    date: '2026-01-06'
  };
  
  Logger.log(uploadOTM(testData));
}
