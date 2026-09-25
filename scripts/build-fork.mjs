#!/usr/bin/env node
// Opt-in deployment entry point for Hemant Bhatt's fork.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.ADDIN_BASE_URL?.trim();
let url;
try {
  url = new URL(base);
} catch {
  throw new Error("Set ADDIN_BASE_URL to your stable production HTTPS origin.");
}
if (url.protocol !== "https:" || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" || url.hostname.endsWith(".localhost") ||
    url.hostname === "pi-for-excel.vercel.app" ||
    url.hostname === "pi-for-excel-theta.vercel.app") {
  throw new Error("ADDIN_BASE_URL must be your own HTTPS origin, without a path, credentials, query or fragment.");
}

function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root, stdio: "inherit", env: { ...process.env, ADDIN_BASE_URL: url.origin },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Failed: ${script}`);
}

run("scripts/generate-manifest.mjs");
let manifest = fs.readFileSync(path.join(root, "manifest.prod.xml"), "utf8");
// Keep this identity stable across releases. Never reuse the upstream ID.
manifest = manifest
  .replace(/<Id>[^<]+<\/Id>/, "<Id>e7653b17-edb6-4bb4-bde6-01c6837b6581</Id>")
  .replace(/<ProviderName>[^<]+<\/ProviderName>/, "<ProviderName>Hemant Bhatt</ProviderName>")
  .replace(/<DisplayName DefaultValue="[^"]*"\s*\/>/, '<DisplayName DefaultValue="Pi for Excel - Hemant" />')
  .replace(/<SupportUrl DefaultValue="[^"]*"\s*\/>/, '<SupportUrl DefaultValue="https://github.com/hemantbhatt63883428-star/pi-for-excel/issues" />');
for (const target of ["manifest.prod.xml", "public/manifest.prod.xml"]) {
  fs.writeFileSync(path.join(root, target), manifest);
}

// Preserve existing security headers and callback rewrites on Cloudflare Pages.
// Vercel continues to use vercel.json directly.
const hosting = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const headers = hosting.headers.map((rule) => [
  rule.source === "/(.*)" ? "/*" : rule.source,
  ...rule.headers.map(({ key, value }) => `  ${key}: ${value}`),
].join("\n")).join("\n\n");
const redirects = hosting.rewrites.map(({ source, destination }) => `${source} ${destination} 200`).join("\n");
fs.writeFileSync(path.join(root, "public/_headers"), `${headers}\n`);
fs.writeFileSync(path.join(root, "public/_redirects"), `${redirects}\n`);

if (!process.argv.includes("--manifest-only")) {
  run("node_modules/vite/bin/vite.js", ["build"]);
}
console.log("Fork manifest prepared for the configured production origin.");
