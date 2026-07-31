// Run ONCE: `npm run generate-keypair`
// Keep the PRIVATE key secret (e.g. in a password manager). Never commit it, never ship it in the app.
// Paste the PUBLIC key into src/license/license.ts (PUBLIC_KEY_B64).

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import fs from "fs";

const keypair = nacl.sign.keyPair();

const publicKeyB64 = naclUtil.encodeBase64(keypair.publicKey);
const secretKeyB64 = naclUtil.encodeBase64(keypair.secretKey);

fs.writeFileSync(
  "license-signing-key.PRIVATE.json",
  JSON.stringify({ secretKey: secretKeyB64 }, null, 2)
);

console.log("\n=== Keypair generated ===");
console.log("\nPUBLIC KEY (paste into src/license/license.ts):\n");
console.log(publicKeyB64);
console.log("\nPRIVATE KEY saved to license-signing-key.PRIVATE.json");
console.log("Keep this file OFFLINE and SECRET. Anyone with it can generate valid licenses.\n");
