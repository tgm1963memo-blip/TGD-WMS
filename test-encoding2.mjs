import * as XLSX from 'xlsx';
import fs from 'fs';

// TIS-620 bytes for "บริษัท" followed by a comma
const buf = Buffer.from([0xBA, 0xC3, 0xD4, 0xC9, 0xD1, 0xB7, 0x2C, 0x31, 0x32, 0x33, 0x0A]);
const u8 = new Uint8Array(buf);

const isZip = u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04;
const isOle2 = u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;

let workbook;
if (!isZip && !isOle2) {
  let str;
  try {
    str = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    str = new TextDecoder('windows-874').decode(buf);
  }
  workbook = XLSX.read(str, { type: 'string' });
} else {
  workbook = XLSX.read(buf, { type: 'array' });
}

const sheet = workbook.Sheets[workbook.SheetNames[0]];
console.log(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
