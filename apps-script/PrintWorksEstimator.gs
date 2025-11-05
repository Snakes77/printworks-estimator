/**
 * PrintWorks Estimator - Google Apps Script
 * 
 * A simple, reliable quoting system built on Google Sheets.
 * Ported from Next.js app with proven pricing logic.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SHEET_NAME: 'PrintWorks Estimator',
  SHEETS: {
    RATE_CARDS: 'RateCards',
    BANDS: 'Bands',
    QUOTES: 'Quotes',
    QUOTE_LINES: 'QuoteLines',
    HISTORY: 'History'
  }
};

// ============================================================================
// CORE PRICING FUNCTIONS (Ported from lib/pricing.ts)
// ============================================================================

/**
 * Select the correct pricing band for a given quantity
 */
function selectBand(rateCardCode, quantity) {
  if (!rateCardCode) {
    throw new Error('Rate card code is required');
  }
  
  if (!quantity || quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  
  const sheet = getSheet(CONFIG.SHEETS.BANDS);
  const data = sheet.getDataRange().getValues();
  
  // Skip header row and find matching band
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const code = row[0]; // RateCardCode
    const fromQty = Number(row[1]); // FromQty
    const toQty = Number(row[2]); // ToQty
    
    // Check if this band matches and quantity is in range
    if (code === rateCardCode && quantity >= fromQty && quantity <= toQty) {
      return {
        rateCardCode: code,
        fromQty: fromQty,
        toQty: toQty,
        pricePerThousand: Number(row[3]) || 0,
        makeReadyFixed: Number(row[4]) || 0
      };
    }
  }
  
  throw new Error(`No band found for ${rateCardCode} at quantity ${quantity}. Please check that bands exist for this rate card.`);
}

/**
 * Calculate units based on rate card type
 */
function calculateUnits(rateCardCode, quantity, insertsCount) {
  const rateCard = getRateCard(rateCardCode);
  
  if (rateCard.unit === 'job') {
    return 0;
  }
  
  if (rateCard.unit === 'enclose') {
    // Insert-aware: quantity × inserts ÷ 1000
    return (quantity * insertsCount) / 1000;
  }
  
  // per_1k: quantity ÷ 1000
  return quantity / 1000;
}

/**
 * Calculate line total for a rate card
 */
function calculateLine(rateCardCode, quantity, insertsCount) {
  if (!rateCardCode) {
    throw new Error('Rate card code is required');
  }
  
  if (!quantity || quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  
  if (insertsCount < 0) {
    throw new Error('Inserts count cannot be negative');
  }
  
  const band = selectBand(rateCardCode, quantity);
  const rateCard = getRateCard(rateCardCode);
  const units = calculateUnits(rateCardCode, quantity, insertsCount);
  
  // Use proper decimal arithmetic to avoid floating point errors
  const lineTotal = Number(band.makeReadyFixed) + (units * Number(band.pricePerThousand));
  
  return {
    rateCardCode: rateCardCode,
    description: rateCard.name,
    units: units,
    unitPrice: Number(band.pricePerThousand),
    makeReady: Number(band.makeReadyFixed),
    lineTotal: Math.round(lineTotal * 100) / 100 // Round to 2 decimal places
  };
}

/**
 * Calculate quote totals (subtotal, VAT, total)
 */
function calculateTotals(lines, vatRate) {
  if (!lines || lines.length === 0) {
    return { subtotal: 0, vat: 0, total: 0 };
  }
  
  // Sum line totals with proper rounding
  const subtotal = lines.reduce((sum, line) => {
    return sum + Number(line.lineTotal);
  }, 0);
  
  // Round subtotal to 2 decimal places
  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  
  // Calculate VAT
  const vat = Math.round(roundedSubtotal * (vatRate / 100) * 100) / 100;
  
  // Calculate total
  const total = roundedSubtotal + vat;
  
  return { 
    subtotal: roundedSubtotal,
    vat: vat,
    total: Math.round(total * 100) / 100
  };
}

/**
 * Calculate all quote lines
 */
function calculateQuoteLines(quantity, insertsCount, rateCardCodes) {
  if (!rateCardCodes || rateCardCodes.length === 0) {
    return [];
  }
  
  return rateCardCodes.map(code => calculateLine(code, quantity, insertsCount));
}

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

/**
 * Get a sheet by name, create if doesn't exist
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Initialize headers AFTER sheet is created (avoid recursion)
    const headers = getSheetHeaders(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#f0f0f0');
    }
  }
  
  return sheet;
}

/**
 * Get headers for a sheet (helper to avoid recursion)
 */
function getSheetHeaders(sheetName) {
  switch (sheetName) {
    case CONFIG.SHEETS.RATE_CARDS:
      return ['Code', 'Name', 'Unit', 'Notes', 'CreatedAt'];
    case CONFIG.SHEETS.BANDS:
      return ['RateCardCode', 'FromQty', 'ToQty', 'PricePerThousand', 'MakeReadyFixed'];
    case CONFIG.SHEETS.QUOTES:
      return ['QuoteId', 'ClientName', 'ProjectName', 'Reference', 'Quantity', 'Envelope', 'Inserts', 'VATRate', 'Subtotal', 'VAT', 'Total', 'CreatedAt'];
    case CONFIG.SHEETS.QUOTE_LINES:
      return ['QuoteId', 'RateCardCode', 'Description', 'Units', 'UnitPrice', 'MakeReady', 'LineTotal'];
    case CONFIG.SHEETS.HISTORY:
      return ['QuoteId', 'Action', 'PayloadJSON', 'CreatedAt', 'UserEmail'];
    default:
      return [];
  }
}

/**
 * Initialize sheet structure
 * NOTE: Must be called with sheet that already exists (no recursion)
 */
function initializeSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  // Create sheet if it doesn't exist (but don't call getSheet which would recurse)
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Clear existing content if any
  sheet.clear();
  
  switch (sheetName) {
    case CONFIG.SHEETS.RATE_CARDS:
      sheet.getRange(1, 1, 1, 5).setValues([['Code', 'Name', 'Unit', 'Notes', 'CreatedAt']]);
      break;
      
    case CONFIG.SHEETS.BANDS:
      sheet.getRange(1, 1, 1, 5).setValues([['RateCardCode', 'FromQty', 'ToQty', 'PricePerThousand', 'MakeReadyFixed']]);
      break;
      
    case CONFIG.SHEETS.QUOTES:
      sheet.getRange(1, 1, 1, 12).setValues([['QuoteId', 'ClientName', 'ProjectName', 'Reference', 'Quantity', 'Envelope', 'Inserts', 'VATRate', 'Subtotal', 'VAT', 'Total', 'CreatedAt']]);
      break;
      
    case CONFIG.SHEETS.QUOTE_LINES:
      sheet.getRange(1, 1, 1, 7).setValues([['QuoteId', 'RateCardCode', 'Description', 'Units', 'UnitPrice', 'MakeReady', 'LineTotal']]);
      break;
      
    case CONFIG.SHEETS.HISTORY:
      sheet.getRange(1, 1, 1, 5).setValues([['QuoteId', 'Action', 'PayloadJSON', 'CreatedAt', 'UserEmail']]);
      break;
  }
  
  // Format header row
  const lastColumn = sheet.getLastColumn();
  if (lastColumn > 0) {
    sheet.getRange(1, 1, 1, lastColumn)
      .setFontWeight('bold')
      .setBackground('#f0f0f0');
  }
}

/**
 * Get rate card by code
 */
function getRateCard(code) {
  if (!code) {
    throw new Error('Rate card code is required');
  }
  
  const sheet = getSheet(CONFIG.SHEETS.RATE_CARDS);
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[0] === code) {
      return {
        code: row[0],
        name: row[1] || '',
        unit: row[2] || 'per_1k',
        notes: row[3] || ''
      };
    }
  }
  
  throw new Error(`Rate card ${code} not found`);
}

/**
 * Get all rate cards
 */
function getAllRateCards() {
  const sheet = getSheet(CONFIG.SHEETS.RATE_CARDS);
  const data = sheet.getDataRange().getValues();
  const rateCards = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // Has code
      rateCards.push({
        code: data[i][0],
        name: data[i][1],
        unit: data[i][2],
        notes: data[i][3]
      });
    }
  }
  
  return rateCards;
}

// ============================================================================
// QUOTE OPERATIONS
// ============================================================================

/**
 * Create a new quote
 */
function createQuote(quoteData) {
  const {
    clientName,
    projectName,
    reference,
    quantity,
    envelopeType,
    insertsCount,
    vatRate,
    rateCardCodes
  } = quoteData;
  
  // Validate inputs
  if (!rateCardCodes || rateCardCodes.length === 0) {
    throw new Error('At least one rate card must be selected');
  }
  
  if (!quantity || quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  
  // Calculate lines
  const lines = calculateQuoteLines(quantity, insertsCount, rateCardCodes);
  const totals = calculateTotals(lines, vatRate);
  
  // Generate quote ID
  const quoteId = 'Q-' + Date.now().toString();
  const now = new Date();
  
  // Save quote
  const quotesSheet = getSheet(CONFIG.SHEETS.QUOTES);
  quotesSheet.appendRow([
    quoteId,
    clientName,
    projectName,
    reference,
    quantity,
    envelopeType,
    insertsCount,
    vatRate,
    totals.subtotal,
    totals.vat,
    totals.total,
    now
  ]);
  
  // Save quote lines
  const linesSheet = getSheet(CONFIG.SHEETS.QUOTE_LINES);
  lines.forEach(line => {
    linesSheet.appendRow([
      quoteId,
      line.rateCardCode,
      line.description,
      line.units,
      line.unitPrice,
      line.makeReady,
      line.lineTotal
    ]);
  });
  
  // Save history
  logHistory(quoteId, 'CREATED', {
    lines: lines,
    totals: totals
  });
  
  return {
    quoteId,
    ...quoteData,
    lines,
    totals
  };
}

/**
 * Preview quote calculations (for UI)
 */
function previewQuote(quantity, insertsCount, vatRate, rateCardCodes) {
  if (!rateCardCodes || rateCardCodes.length === 0) {
    return {
      lines: [],
      totals: {
        subtotal: '0.00',
        vat: '0.00',
        total: '0.00'
      }
    };
  }
  
  const lines = calculateQuoteLines(quantity, insertsCount, rateCardCodes);
  const totals = calculateTotals(lines, vatRate);
  
  return {
    lines: lines.map(line => ({
      rateCardCode: line.rateCardCode,
      description: line.description,
      units: line.units.toFixed(3),
      unitPrice: line.unitPrice.toFixed(2),
      makeReady: line.makeReady.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2)
    })),
    totals: {
      subtotal: totals.subtotal.toFixed(2),
      vat: totals.vat.toFixed(2),
      total: totals.total.toFixed(2)
    }
  };
}

/**
 * Log history entry
 */
function logHistory(quoteId, action, payload) {
  const sheet = getSheet(CONFIG.SHEETS.HISTORY);
  const userEmail = Session.getActiveUser().getEmail();
  
  sheet.appendRow([
    quoteId,
    action,
    JSON.stringify(payload),
    new Date(),
    userEmail
  ]);
}

// ============================================================================
// UI MENU
// ============================================================================

/**
 * Add custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('PrintWorks')
    .addItem('Create Quote', 'showCreateQuoteDialog')
    .addItem('Manage Rate Cards', 'showRateCardsDialog')
    .addSeparator()
    .addItem('Open Web App', 'openWebApp')
    .addToUi();
}

/**
 * Show create quote dialog (simple version)
 */
function showCreateQuoteDialog() {
  const html = HtmlService.createHtmlOutput(`
    <h3>Create Quote</h3>
    <p>Use the web app for a better experience.</p>
    <button onclick="google.script.host.close()">Close</button>
  `)
    .setWidth(400)
    .setHeight(300);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Create Quote');
}

/**
 * Open web app
 */
function openWebApp() {
  const html = HtmlService.createHtmlOutput(`
    <p>Web app URL:</p>
    <p><a href="${ScriptApp.getService().getUrl()}" target="_blank">Open Web App</a></p>
    <button onclick="google.script.host.close()">Close</button>
  `)
    .setWidth(400)
    .setHeight(200);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Web App');
}

// ============================================================================
// WEB APP (HTML Service)
// ============================================================================

/**
 * Serve the web app
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('PrintWorks Estimator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include HTML files
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================================
// API ENDPOINTS (for web app)
// ============================================================================

/**
 * Get all rate cards (for dropdown)
 */
function getRateCards() {
  return getAllRateCards();
}

/**
 * Preview quote calculations (API endpoint for web app)
 */
function previewQuoteCalculation(quantity, insertsCount, vatRate, rateCardCodes) {
  try {
    // Validate inputs
    if (!quantity || quantity <= 0) {
      return { error: 'Quantity must be greater than 0' };
    }
    
    if (insertsCount < 0) {
      return { error: 'Inserts count cannot be negative' };
    }
    
    if (vatRate < 0 || vatRate > 100) {
      return { error: 'VAT rate must be between 0 and 100' };
    }
    
    if (!rateCardCodes || rateCardCodes.length === 0) {
      return previewQuote(quantity, insertsCount, vatRate, []); // Return empty preview
    }
    
    return previewQuote(quantity, insertsCount, vatRate, rateCardCodes);
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Create quote
 */
function createQuoteFromWeb(quoteData) {
  try {
    return createQuote(quoteData);
  } catch (error) {
    return { error: error.toString() };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency (GBP)
 */
function formatGBP(amount) {
  return '£' + Number(amount).toFixed(2);
}

/**
 * Initialize all sheets (run once)
 */
function initializeAllSheets() {
  Object.values(CONFIG.SHEETS).forEach(sheetName => {
    initializeSheet(sheetName);
  });
  
  SpreadsheetApp.getUi().alert('All sheets initialized!');
}

