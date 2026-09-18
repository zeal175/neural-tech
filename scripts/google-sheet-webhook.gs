function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName("Registrations") || book.insertSheet("Registrations");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["submitted_at", "name", "rrn", "dept", "section", "year", "phone", "ntc"]);
  }
  sheet.appendRow([
    data.submitted_at || "",
    data.name || "",
    data.rrn || "",
    data.dept || "",
    data.section || "",
    data.year || "",
    data.phone || "",
    data.ntc || "",
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
