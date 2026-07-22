// src/crypto.ts
console.log("Running crypto.ts...");

// Example function
function encrypt(data: string): string {
  return Buffer.from(data).toString("base64");
}

console.log(encrypt("test"));
