const str = "ºÃÔÊÑ·";
// map each char code back to byte
const bytes = new Uint8Array(str.length);
for(let i=0; i<str.length; i++) {
  bytes[i] = str.charCodeAt(i);
}
const fixed = new TextDecoder('windows-874').decode(bytes);
console.log("Fixed:", fixed);
