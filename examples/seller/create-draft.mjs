import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, redact } from "../../src/api-client.mjs";

const listingPath = process.argv[2] || new URL("./pack-listing.example.json", import.meta.url);
if (!process.argv.includes("--confirm-create")) throw new Error("Draft was not created. Add --confirm-create after reviewing the listing file.");
const listing = JSON.parse(await readFile(listingPath instanceof URL ? listingPath : resolve(listingPath), "utf8"));
if (listing.assetKind !== "agent_pack") throw new Error("The listing must declare assetKind=agent_pack");

const client = createClient();
await client.acceptTerms("api");
const result = await client.createDraft(listing);
console.log(JSON.stringify(redact({ result, next: "Upload a higher immutable .taip version and at least one sanitized catalogue image." }), null, 2));
