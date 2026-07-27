export function fixMojibakeThaiString(str) {
  if (typeof str !== 'string' || !str) return str;
  
  let hasLatin1Upper = false;
  let hasThai = false;
  
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x0E00 && code <= 0x0E7F) {
      hasThai = true;
      break;
    }
    if (code >= 128 && code <= 255) {
      hasLatin1Upper = true;
    }
  }

  if (hasThai || !hasLatin1Upper) return str;

  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return new TextDecoder('windows-874').decode(bytes);
}

console.log(fixMojibakeThaiString("ºÃÔÊÑ·")); // Should be บริสัท
console.log(fixMojibakeThaiString("บริษัท")); // Should remain บริษัท
console.log(fixMojibakeThaiString("SO-1234")); // Should remain SO-1234
