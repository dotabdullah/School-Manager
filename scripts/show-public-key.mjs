// Run: node scripts/show-public-key.mjs
// Recovers and prints the PUBLIC key from your existing license-signing-key.PRIVATE.json.
// Use this whenever a fresh copy of the project has the placeholder in license.ts —
// NEVER run generate-keypair again just to "fix" that; it would invalidate every
// license you've already issued to schools.

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import fs from "fs";

if (!fs.existsSync("license-signing-key.PRIVATE.json")) {
  console.error(
    "\nNo license-signing-key.PRIVATE.json found in this folder.\n" +
    "If you truly have never generated a keypair before, run `npm run generate-keypair` instead.\n" +
    "If you HAVE generated one before, find that file (check your backups) and place it in the project root.\n"
  );
  process.exit(1);
}

const { secretKey } = JSON.parse(fs.readFileSync("license-signing-key.PRIVATE.json", "utf-8"));
const keyPair = nacl.sign.keyPair.fromSecretKey(naclUtil.decodeBase64(secretKey));
const publicKeyB64 = naclUtil.encodeBase64(keyPair.publicKey);

console.log("\nYour PUBLIC KEY (paste into src/license/license.ts, replacing PUBLIC_KEY_B64):\n");
console.log(publicKeyB64);
console.log();
