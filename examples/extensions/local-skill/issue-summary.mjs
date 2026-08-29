#!/usr/bin/env node
import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let handled = false;

for await (const line of lines) {
  if (handled || !line.trim()) continue;
  handled = true;
  const request = JSON.parse(line);
  if (request.method !== "summarize_issue") throw new Error("Unsupported method");
  const title = String(request.arguments?.title || "").trim().slice(0, 200);
  const body = String(request.arguments?.body || "").trim().slice(0, 12000);
  if (!title || !body) throw new Error("title and body are required");

  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const errorLines = body.split(/\r?\n/).filter((entry) => /error|fail|exception|timeout/i.test(entry)).slice(0, 5);
  process.stdout.write(JSON.stringify({
    title,
    summary: sentences.slice(0, 3).join(" ").slice(0, 1200),
    possibleEvidence: errorLines,
    note: "Deterministic local preprocessing only; the Pack remains responsible for interpretation.",
  }));
}

if (!handled) throw new Error("Expected one JSON request on stdin");
