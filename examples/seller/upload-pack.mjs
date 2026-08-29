import { createClient, redact } from "../../src/api-client.mjs";

const [productId, version, filePath] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
if (!productId || !version || !filePath) {
  throw new Error("Usage: node examples/seller/upload-pack.mjs <pack-id> <semver> <file.taip> --confirm-upload");
}
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error("version must be strict SemVer, for example 1.1.0");
if (!process.argv.includes("--confirm-upload")) throw new Error("Upload was not started. Add --confirm-upload after checking the owner, Pack, version, and file.");

const result = await createClient().uploadPack(productId, version, filePath, {
  changelog: process.env.TETREES_CHANGELOG || "Immutable TAIP/1 release",
});
console.log(JSON.stringify(redact({ result, next: "Run check-readiness, then submit and quote Agent AVCP through the hosted MCP or API." }), null, 2));
