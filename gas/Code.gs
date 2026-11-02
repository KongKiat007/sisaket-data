/**
 * Sisaket Data Dashboard API
 * Google Sheet: sisaketdata
 * JSONP endpoint สำหรับ frontend ที่เปิดจาก VS Code Live Server
 */
const CONFIG = {
  SPREADSHEET_ID: "1kxgE7MMUxwRO1nb_jEK-WpyzrFuycZWyBkv0nCf_Ug8",
  SHEET_NAME: "sisaketdata"
};

function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : "";
  try {
    const result = {
      success: true,
      updatedAt: new Date().toISOString(),
      data: readSheetData_()
    };
    return output_(result, callback);
  } catch (error) {
    return output_({
      success: false,
      error: String(error && error.message ? error.message : error)
    }, callback);
  }
}

function readSheetData_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('ไม่พบแท็บชื่อ "' + CONFIG.SHEET_NAME + '" กรุณาตรวจสอบชื่อแท็บ');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const col = {
    year: findHeader_(headers, ["ปี", "year"]),
    district: findHeader_(headers, ["อำเภอ", "district"]),
    village: findHeader_(headers, ["หมู่บ้าน/ชุมชน", "หมู่บ้าน", "ชุมชน", "villages"]),
    patient: findHeader_(headers, ["ผู้ป่วยเข้ารับบำบัด", "ผู้เข้ารับบำบัด", "จำนวนผู้ป่วย", "patients", "total"])
  };

  if (col.year < 0 || col.district < 0 || col.patient < 0) {
    throw new Error("หัวตารางไม่ครบ: ต้องมี ปี, อำเภอ และ ผู้ป่วยเข้ารับบำบัด (ชื่อคอลัมน์หมู่บ้าน/ชุมชนเป็นตัวเลือก)");
  }

  return values.slice(1)
    .filter(row => row.some(cell => String(cell).trim() !== ""))
    .map(row => ({
      "ปี": toNumber_(row[col.year]),
      "อำเภอ": String(row[col.district] || "").trim(),
      "หมู่บ้าน/ชุมชน": col.village >= 0 ? toNumber_(row[col.village]) : 0,
      "ผู้ป่วยเข้ารับบำบัด": toNumber_(row[col.patient])
    }))
    .filter(row => row["อำเภอ"] !== "");
}

function findHeader_(headers, candidates) {
  const normalized = headers.map(h => h.replace(/\s+/g, "").toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate.replace(/\s+/g, "").toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function toNumber_(value) {
  const parsed = Number(String(value || "0").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function output_(payload, callback) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  if (callback) {
    // จำกัด callback ให้เป็น identifier ป้องกันการแทรก JavaScript
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return ContentService.createTextOutput("Invalid callback")
        .setMimeType(ContentService.MimeType.TEXT);
    }
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/** ทดสอบการเข้าถึงชีตจากหน้า Apps Script */
function testConnection() {
  const data = readSheetData_();
  Logger.log("Connected. Rows: " + data.length);
  Logger.log(JSON.stringify(data.slice(0, 3), null, 2));
}
