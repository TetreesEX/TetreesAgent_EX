import { createClient, redact } from "../../src/api-client.mjs";

const query = process.argv.slice(2).join(" ") || "research";
const client = createClient();
const [catalog, models] = await Promise.all([client.search(query, 5), client.models()]);
const items = catalog.packs || catalog.items || catalog.products || catalog.data || [];
const first = items[0];

if (!first) {
  console.log(JSON.stringify({ query, matches: 0 }, null, 2));
  process.exit(0);
}

const productId = first.id || first.productId || first.product_id;
const availableModels = models.models || models.items || models.data || [];
const model = availableModels.find((item) => item.available !== false)?.id || availableModels[0]?.id;
if (!productId || !model) throw new Error("The public catalogue or model registry did not return the expected identifiers");

const [report, runtimeProfile, quote] = await Promise.all([
  client.publicReport(productId),
  client.runtimeProfile(productId),
  client.quoteRun({ productId, model, fundingMode: "points", enabledSkills: [], growthVersion: 0, maxInputTokens: 8000, maxOutputTokens: 2000 }),
]);

console.log(JSON.stringify(redact({
  query,
  selected: { id: productId, name: first.name, slug: first.slug },
  model,
  report,
  runtimeProfile,
  quote,
  runSent: false,
  next: "Review the quote and call a confirmation-gated client before spending Points.",
}), null, 2));
