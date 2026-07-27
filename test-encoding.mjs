import * as XLSX from 'xlsx';

// Create a buffer that simulates a TIS-620 encoded CSV
// "บริษัท" in TIS-620: \xBA\xC3\xD4\xC9\xD1\xB7
const buf = Buffer.from([0xBA, 0xC3, 0xD4, 0xC9, 0xD1, 0xB7, 0x0A]);
const wb = XLSX.read(buf, { type: 'buffer', codepage: 874 });
const sheet = wb.Sheets[wb.SheetNames[0]];
console.log(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
