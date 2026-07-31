// Optional CLI alternative to the in-app "Creator Licensing Admin Panel".
// Usage: node scripts/generate-license.mjs "School Name" <plan> "<hardwareIds>" YYYY-MM-DD
//   <plan>: 1 | 3 | unlimited
//   <hardwareIds>: comma-separated, one per station (omit / use "-" for unlimited plans)
// Examples:
//   node scripts/generate-license.mjs "Al-Noor School" 1 "SCH-HW-4AF901" 2027-07-24
//   node scripts/generate-license.mjs "Big Campus" 3 "SCH-HW-AAA,SCH-HW-BBB,SCH-HW-CCC" 2027-07-24
//   node scripts/generate-license.mjs "Enterprise Group" unlimited - 2027-07-24
// Requires license-signing-key.PRIVATE.json (from generate-keypair.mjs) in this same folder.

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import fs from "fs";
import crypto from "crypto";

const [, , schoolName, plan, hardwareIdsArg, expiryDate] = process.argv;

if (!schoolName || !plan || !expiryDate || !["1", "3", "unlimited"].includes(plan)) {
  console.error(
    'Usage: node scripts/generate-license.mjs "School Name" <1|3|unlimited> "<hardwareIds,comma,separated>" YYYY-MM-DD'
  );
  process.exit(1);
}

const hardwareIds =
  plan === "unlimited" ? [] : (hardwareIdsArg ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const expectedCount = plan === "1" ? 1 : plan === "3" ? 3 : 0;
if (plan !== "unlimited" && hardwareIds.length !== expectedCount) {
  console.error(`This is a ${plan}-Station plan — provide exactly ${expectedCount} comma-separated hardware ID(s).`);
  process.exit(1);
}

const keyFile = JSON.parse(fs.readFileSync("license-signing-key.PRIVATE.json", "utf-8"));
const secretKey = naclUtil.decodeBase64(keyFile.secretKey);

const payload = {
  school: schoolName,
  licenseId: crypto.randomUUID(),
  hardwareIds,
  stationPlan: plan,
  issuedAt: new Date().toISOString(),
  expiryDate,
  plan: "yearly",
  features: ["students", "teachers", "classes", "fees", "expenses", "finance", "attendance", "payroll"],
};

const message = naclUtil.decodeUTF8(JSON.stringify(payload));
const signature = nacl.sign.detached(message, secretKey);

const licenseFile = { payload, signature: naclUtil.encodeBase64(signature) };

// Same compact-key encoding used by the in-app panel (src/license/licenseFormat.ts)
function encodeActivationKey(file) {
  const json = JSON.stringify(file);
  const base64 = Buffer.from(json, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const chunks = base64.match(/.{1,6}/g) ?? [];
  return "SCH-" + chunks.join("-");
}

const activationKey = encodeActivationKey(licenseFile);

console.log(`\nSchool: ${schoolName}`);
console.log(`Plan: ${plan === "unlimited" ? "Unlimited Stations" : `${plan}-Station`}`);
console.log(`Hardware IDs: ${hardwareIds.length ? hardwareIds.join(", ") : "(none — unlimited)"}`);
console.log(`Expires: ${expiryDate}`);
console.log(`\nActivation Key:\n${activationKey}\n`);
console.log("Send this key to the school. Every listed station pastes the SAME key into Station Licensing → Activation Key.\n");
