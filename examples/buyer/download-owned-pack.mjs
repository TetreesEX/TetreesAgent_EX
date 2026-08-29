import { createClient, redact } from "../../src/api-client.mjs";

const productId = process.argv[2];
if (!productId) throw new Error("Usage: node examples/buyer/download-owned-pack.mjs <pack-id> --confirm-link");
if (!process.argv.includes("--confirm-link")) throw new Error("Add --confirm-link to mint a short-lived entitlement-checked URL");

const result = await createClient().download(productId);
console.log(JSON.stringify(redact({
  ...result,
  downloadUrl: result.url || result.downloadUrl,
  note: "The URL is short-lived. Do not log it, commit it, or send it to another user.",
}), null, 2));
