#!/usr/bin/env node
import { createClient, redact, TetreesApiError } from "./api-client.mjs";

const [command = "help", ...args] = process.argv.slice(2);

function usage() {
  console.log(`Tetrees Agent EX public API client

Read only:
  status
  catalog [query]
  models
  skills
  workload
  owned
  runtime <pack-id>
  report <pack-id>
  quote <pack-id> <model-id>
  growth <pack-id>
  seller-readiness <pack-id>
  seller-report <pack-id>

Explicit mutations:
  acquire-free <pack-id> --confirm-acquire
  run <pack-id> <model-id> <prompt> --confirm-spend
  growth-select <pack-id> <sequence> --confirm-select

Environment:
  TETREES_TOKEN       required revocable account token
  TETREES_API_URL     defaults to https://ex.tetrees.ai/api`);
}

function required(value, label) {
  if (!value || value.startsWith("--")) throw new Error(`${label} is required`);
  return value;
}

function confirmed(flag) {
  return args.includes(flag);
}

function canAfford(quote) {
  if (typeof quote?.canAfford === "boolean") return quote.canAfford;
  if (typeof quote?.affordability?.canAfford === "boolean") return quote.affordability.canAfford;
  if (typeof quote?.quote?.canAfford === "boolean") return quote.quote.canAfford;
  return undefined;
}

async function main() {
  if (["help", "--help", "-h"].includes(command)) return usage();
  const client = createClient();
  let result;

  switch (command) {
    case "status": result = await client.tokenStatus(); break;
    case "catalog": result = await client.search(args.filter((arg) => !arg.startsWith("--")).join(" "), 12); break;
    case "models": result = await client.models(); break;
    case "skills": result = await client.skills(); break;
    case "workload": result = await client.workload(); break;
    case "owned": result = await client.owned(); break;
    case "runtime": result = await client.runtimeProfile(required(args[0], "pack-id")); break;
    case "report": result = await client.publicReport(required(args[0], "pack-id")); break;
    case "growth": result = await client.growth(required(args[0], "pack-id")); break;
    case "seller-readiness": result = await client.sellerReadiness(required(args[0], "pack-id")); break;
    case "seller-report": result = await client.sellerReport(required(args[0], "pack-id")); break;
    case "quote": {
      const productId = required(args[0], "pack-id");
      const model = required(args[1], "model-id");
      result = await client.quoteRun({ productId, model, fundingMode: "points", enabledSkills: [], growthVersion: 0, maxInputTokens: 8000, maxOutputTokens: 2000 });
      break;
    }
    case "acquire-free": {
      const productId = required(args[0], "pack-id");
      if (!confirmed("--confirm-acquire")) throw new Error("Acquisition was not sent. Add --confirm-acquire after reviewing the Pack.");
      result = await client.acquireFree(productId);
      break;
    }
    case "growth-select": {
      const productId = required(args[0], "pack-id");
      const sequence = Number(required(args[1], "sequence"));
      if (!Number.isInteger(sequence) || sequence < 0) throw new Error("sequence must be a non-negative integer");
      if (!confirmed("--confirm-select")) throw new Error("Selection was not sent. Add --confirm-select to change the saved checkpoint.");
      result = await client.selectGrowth(productId, sequence);
      break;
    }
    case "run": {
      const productId = required(args[0], "pack-id");
      const model = required(args[1], "model-id");
      const prompt = required(args[2], "prompt");
      const input = { productId, model, fundingMode: "points", enabledSkills: [], growthVersion: 0, maxInputTokens: 8000, maxOutputTokens: 2000 };
      const quote = await client.quoteRun(input);
      if (!confirmed("--confirm-spend")) {
        console.log(JSON.stringify({ sent: false, reason: "Add --confirm-spend to accept the quoted maximum", quote: redact(quote) }, null, 2));
        return;
      }
      if (canAfford(quote) === false) throw new Error("The quote reports insufficient Tetrees Points; no run was sent");
      result = await client.run(productId, { model, prompt, fundingMode: "points", enabledSkills: [], growthVersion: 0, maxInputTokens: 8000, maxOutputTokens: 2000 });
      break;
    }
    default: throw new Error(`Unknown command: ${command}. Run with --help.`);
  }

  console.log(JSON.stringify(redact(result), null, 2));
}

main().catch((error) => {
  if (error instanceof TetreesApiError) {
    console.error(JSON.stringify({ error: error.message, code: error.code, status: error.status, retryAfter: error.retryAfter || null }, null, 2));
  } else {
    console.error(error.message || String(error));
  }
  process.exitCode = 1;
});
