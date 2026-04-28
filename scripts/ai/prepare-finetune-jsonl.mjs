#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

const getArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return String(args[index + 1] || fallback);
};

const inputPath = getArg('--input');
const outputPath = getArg('--output');
const validationOutputPath = getArg('--validation-output');
const validationRatioRaw = Number(getArg('--validation-ratio', '0'));
const validationRatio = Number.isFinite(validationRatioRaw)
  ? Math.min(0.5, Math.max(0, validationRatioRaw))
  : 0;
const seedRaw = Number(getArg('--seed', '42'));
const splitSeed = Number.isFinite(seedRaw) ? Math.trunc(seedRaw) : 42;
const systemPrompt =
  getArg('--system') ||
  'You are Kori, a marketplace assistant. Recommend only available marketplace items and avoid hallucinations.';

if (!inputPath || !outputPath) {
  console.error(
    'Usage: node scripts/ai/prepare-finetune-jsonl.mjs --input <source.json> --output <train.jsonl> [--validation-output <val.jsonl> --validation-ratio 0.1 --seed 42 --system "<prompt>"]',
  );
  process.exit(1);
}

const absoluteInput = path.resolve(process.cwd(), inputPath);
const absoluteOutput = path.resolve(process.cwd(), outputPath);
const absoluteValidationOutput = validationOutputPath
  ? path.resolve(process.cwd(), validationOutputPath)
  : '';

if (!fs.existsSync(absoluteInput)) {
  console.error(`Input file not found: ${absoluteInput}`);
  process.exit(1);
}

const sourceRaw = fs.readFileSync(absoluteInput, 'utf8');
let source;
try {
  source = JSON.parse(sourceRaw);
} catch (error) {
  console.error('Failed to parse input JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!Array.isArray(source)) {
  console.error('Input JSON must be an array of records.');
  process.exit(1);
}

const toText = (value, maxLength = 8000) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLength);
};

const normalizedRecords = [];
let skipped = 0;

for (const record of source) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    skipped += 1;
    continue;
  }

  if (Array.isArray(record.messages) && record.messages.length > 0) {
    const messages = record.messages
      .map((entry) => {
        const role = entry?.role === 'assistant' || entry?.role === 'system' ? entry.role : 'user';
        const content = toText(entry?.content);
        if (!content) return null;
        return { role, content };
      })
      .filter(Boolean);

    if (messages.length < 2 || messages[messages.length - 1].role !== 'assistant') {
      skipped += 1;
      continue;
    }

    normalizedRecords.push({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.filter((entry) => entry.role !== 'system'),
      ],
    });
    continue;
  }

  const prompt = toText(record.prompt || record.user || record.input);
  const completion = toText(record.completion || record.assistant || record.output);
  if (!prompt || !completion) {
    skipped += 1;
    continue;
  }

  normalizedRecords.push({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
      { role: 'assistant', content: completion },
    ],
  });
}

if (!normalizedRecords.length) {
  console.error('No valid records found. Nothing was written.');
  process.exit(1);
}

const seededRandom = (() => {
  let state = (splitSeed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
})();

const shuffled = normalizedRecords.slice();
for (let index = shuffled.length - 1; index > 0; index -= 1) {
  const swapIndex = Math.floor(seededRandom() * (index + 1));
  const temp = shuffled[index];
  shuffled[index] = shuffled[swapIndex];
  shuffled[swapIndex] = temp;
}

let trainRecords = shuffled;
let validationRecords = [];

if (absoluteValidationOutput && validationRatio > 0 && shuffled.length >= 5) {
  const desiredValidationCount = Math.max(1, Math.floor(shuffled.length * validationRatio));
  const validationCount = Math.min(shuffled.length - 1, desiredValidationCount);
  validationRecords = shuffled.slice(0, validationCount);
  trainRecords = shuffled.slice(validationCount);
}

const toJsonl = (rows) => rows.map((entry) => JSON.stringify(entry)).join('\n') + '\n';

fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
fs.writeFileSync(absoluteOutput, toJsonl(trainRecords), 'utf8');

if (absoluteValidationOutput && validationRecords.length > 0) {
  fs.mkdirSync(path.dirname(absoluteValidationOutput), { recursive: true });
  fs.writeFileSync(absoluteValidationOutput, toJsonl(validationRecords), 'utf8');
}

console.log(`Wrote ${trainRecords.length} training records to ${absoluteOutput}`);
if (absoluteValidationOutput) {
  if (validationRecords.length > 0) {
    console.log(
      `Wrote ${validationRecords.length} validation records to ${absoluteValidationOutput} (ratio=${validationRatio})`,
    );
  } else {
    console.log(
      `Validation output was requested but not created (records too small or ratio=${validationRatio}).`,
    );
  }
}
console.log(`Skipped ${skipped} invalid records`);
