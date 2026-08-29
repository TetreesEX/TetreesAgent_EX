import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const ignoredDirectories = new Set([".git", "node_modules", "coverage"]);
const ignoredContentFiles = new Set(["scripts/check-public-boundary.mjs"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".ico"]);
const disallowedExtensions = new Set([".taip", ".zip", ".pem", ".p12", ".pfx", ".sqlite", ".db"]);
const privatePathMarkers = /(^|\/)(internal|backend|infrastructure|deployment|runtime-engine|avcp-engine)(\/|$)/i;

const contentRules = [
  ["GitHub personal access token", /github_pat_[A-Za-z0-9_]{20,}/],
  ["model-provider secret", /\bsk-(?:proj|ant)-[A-Za-z0-9_-]{20,}/],
  ["live Tetrees token", /\btxk_(?!replace_me\b)[A-Za-z0-9._-]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["private Agent dependency name", /\b(?:prime agent|mem0)\b/i],
  ["privileged admin endpoint", /\/api\/admin(?:\/|\b)/i],
];

async function collect(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) await collect(path, files);
    else files.push(path);
  }
  return files;
}

const violations = [];
for (const file of await collect(root)) {
  const path = relative(new URL(".", root).pathname, file.pathname).replace(/^\/+/, "");
  const normalized = decodeURIComponent(path).replace(/\\/g, "/");
  const metadata = await stat(file);
  const extension = extname(normalized).toLowerCase();
  if (metadata.size > 2 * 1024 * 1024) violations.push(`${normalized}: public source file exceeds 2 MiB`);
  if (disallowedExtensions.has(extension)) violations.push(`${normalized}: packaged assets and credentials do not belong in the public client repository`);
  if (privatePathMarkers.test(normalized)) violations.push(`${normalized}: path crosses the public integration boundary`);
  if (normalized === ".env" || /^\.env\./.test(normalized) && normalized !== ".env.example") violations.push(`${normalized}: local environment file must not be committed`);
  if (binaryExtensions.has(extension) || ignoredContentFiles.has(normalized)) continue;
  const content = await readFile(file, "utf8");
  for (const [name, pattern] of contentRules) if (pattern.test(content)) violations.push(`${normalized}: contains ${name}`);
}

if (violations.length) {
  console.error(`Public-boundary check failed:\n- ${violations.join("\n- ")}`);
  process.exit(1);
}
console.log("Public-boundary check passed: no packaged assets, credentials, privileged endpoints, or private implementation markers found.");
