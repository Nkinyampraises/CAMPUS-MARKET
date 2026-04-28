#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

const getArg = (name, fallback = "") => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return String(args[index + 1] || fallback);
};

const inputPath = getArg("--input");
const outputPath = getArg("--output");
const systemPrompt =
  getArg("--system") ||
  "You are Kori, a marketplace assistant. Recommend only available marketplace items and avoid hallucinations.";

if (!inputPath || !outputPath) {
  console.error(
    "Usage: node scripts/ai/prepare-hf-sft-jsonl.mjs --input <source.json> --output <train.jsonl> [--system \"<prompt>\"]",
  );
  process.exit(1);
}

const absoluteInput = path.resolve(process.cwd(), inputPath);
const absoluteOutput = path.resolve(process.cwd(), outputPath);

if (!fs.existsSync(absoluteInput)) {
  console.error(`Input file not found: ${absoluteInput}`);
  process.exit(1);
}

const toText = (value, maxLength = 12000) =>
  (typeof value === "string" ? value.trim() : "").slice(0, maxLength);

let source;
try {
  source = JSON.parse(fs.readFileSync(absoluteInput, "utf8"));
} catch (error) {
  console.error("Failed to parse input JSON:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!Array.isArray(source)) {
  console.error("Input JSON must be an array of records.");
  process.exit(1);
}

const rows = [];
let skipped = 0;

for (const record of source) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    skipped += 1;
    continue;
  }

  if (Array.isArray(record.messages) && record.messages.length > 0) {
    const normalizedMessages = record.messages
      .map((entry) => {
        const role =
          entry?.role === "assistant" || entry?.role === "system" || entry?.role === "user"
            ? entry.role
            : "user";
        const content = toText(entry?.content);
        if (!content) return null;
        return { role, content };
      })
      .filter(Boolean);

    if (
      normalizedMessages.length < 2 ||
      normalizedMessages[normalizedMessages.length - 1].role !== "assistant"
    ) {
      skipped += 1;
      continue;
    }

    const textLines = [`System: ${systemPrompt}`];
    for (const message of normalizedMessages) {
      if (message.role === "system") continue;
      if (message.role === "assistant") {
        textLines.push(`Assistant: ${message.content}`);
      } else {
        textLines.push(`User: ${message.content}`);
      }
    }

    rows.push({ text: textLines.join("\n") });
    continue;
  }

  const prompt = toText(record.prompt || record.user || record.input);
  const completion = toText(record.completion || record.assistant || record.output);
  if (!prompt || !completion) {
    skipped += 1;
    continue;
  }

  rows.push({
    text: [`System: ${systemPrompt}`, `User: ${prompt}`, `Assistant: ${completion}`].join("\n"),
  });
}

if (!rows.length) {
  console.error("No valid records found. Nothing was written.");
  process.exit(1);
}

const jsonl = rows.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
fs.writeFileSync(absoluteOutput, jsonl, "utf8");

console.log(`Wrote ${rows.length} rows to ${absoluteOutput}`);
console.log(`Skipped ${skipped} invalid records`);
