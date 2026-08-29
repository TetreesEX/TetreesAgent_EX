import { createClient, redact } from "../../src/api-client.mjs";

const productId = process.argv[2];
if (!productId) throw new Error("Usage: node examples/seller/check-readiness.mjs <pack-id>");

const client = createClient();
const [readiness, quote, report] = await Promise.all([
  client.sellerReadiness(productId),
  client.auditionQuote(productId).catch((error) => ({ unavailable: true, message: error.message })),
  client.sellerReport(productId).catch((error) => ({ unavailable: true, message: error.message })),
]);
console.log(JSON.stringify(redact({ readiness, auditionQuote: quote, privateReport: report }), null, 2));
