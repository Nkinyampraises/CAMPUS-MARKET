# AI Fine-Tuning Guide (Kori)

This project already uses listing retrieval and ranking at runtime.  
Fine-tuning should improve tone + decision style, not replace retrieval.

## 1) Choose provider

Supported server providers:

- `openai`
- `gemini`
- `huggingface`
- `auto` (tries Hugging Face, then Gemini, then OpenAI if keys exist)

Set in `.env`:

```bash
AI_PROVIDER="huggingface"
# or AI_PROVIDER="gemini"
```

Important: API keys must be created in your own account security settings (cannot be generated automatically by this repo).

Key setup pages:

- Gemini API keys: https://ai.google.dev/gemini-api/docs/api-key
- Hugging Face tokens: https://huggingface.co/docs/hub/en/security-tokens

## 2) Prepare source data

Use either:

- `prompt` + `completion`
- `messages` (last message must be assistant)

Starter files:

- `data/ai/fine_tune_source.example.json`
- `data/ai/fine_tune_source.marketplace.json` (project-specific, added for this marketplace)

## 3) Build training files

OpenAI-style chat JSONL:

```bash
npm run ai:prepare-finetune:marketplace
```

Output:

- `tmp/ai/fine_tune_train_marketplace.jsonl`

Amazon Reviews 2023 sample pipeline (downloads and converts a filtered subset):

```bash
npm run ai:download-amazon:sample
npm run ai:prepare-finetune:amazon:split
```

Outputs:

- `data/ai/fine_tune_source.amazon_reviews23.sample.json`
- `tmp/ai/fine_tune_train_amazon.jsonl`
- `tmp/ai/fine_tune_validation_amazon.jsonl`

Hugging Face SFT JSONL (`text` column):

```bash
npm run ai:prepare-hf-sft:marketplace
```

Output:

- `tmp/ai/hf_sft_train_marketplace.jsonl`

Amazon sample for Hugging Face SFT:

```bash
npm run ai:prepare-hf-sft:amazon
```

Output:

- `tmp/ai/hf_sft_train_amazon.jsonl`

Multi-assistant style variants (more “other AI-like” response quality):

```bash
npm run ai:prepare-finetune:multi-assistant
npm run ai:prepare-hf-sft:multi-assistant
```

Outputs:

- `tmp/ai/fine_tune_train_multi_assistant.jsonl`
- `tmp/ai/hf_sft_train_multi_assistant.jsonl`

## 4) OpenAI fine-tune (API-driven path)

OpenAI API reference:

- Files API: https://platform.openai.com/docs/api-reference/files
- Fine-tuning API: https://platform.openai.com/docs/api-reference/fine-tuning
- Supervised fine-tuning guide: https://platform.openai.com/docs/guides/supervised-fine-tuning

```bash
npm run ai:openai:finetune:amazon:dry-run
npm run ai:openai:finetune:amazon
# optional: wait for completion in terminal
npm run ai:openai:finetune:amazon:wait
```

Then set:

```bash
OPENAI_CHAT_MODEL="<fine-tuned-model-id>"
AI_PROVIDER="openai"
```

What the helper does:

- Validates JSONL structure before any API call
- Uploads training and validation files with `purpose=fine-tune`
- Creates a fine-tuning job with your base model
- Optionally waits and prints final model ID when complete
- Uses a versioned base model ID (`gpt-4.1-mini-2025-04-14`) and retries if a non-fine-tunable alias is provided

## 5) Hugging Face fine-tune

Use `tmp/ai/hf_sft_train_marketplace.jsonl` with AutoTrain or TRL SFT.

If using AutoTrain, supply a dataset with a `text` field (already produced by `prepare-hf-sft-jsonl.mjs`).

### 5.1 AutoTrain API path (can be unstable)

Automated submit from this repo:

```bash
npm run ai:hf:autotrain:amazon
# optional: poll logs for 30 minutes
npm run ai:hf:autotrain:amazon:wait
```

Optional env:

```bash
HF_AUTOTRAIN_API_KEY="<your-token>"
HF_AUTOTRAIN_API_BASE="https://<your-space-subdomain>.hf.space"
```

Notes:

- `HF_AUTOTRAIN_API_KEY` is optional. If unset, the helper falls back to `HUGGING_FACE_API_KEY` / `HF_TOKEN`.
- `HF_AUTOTRAIN_API_BASE` is optional and only needed when using a custom AutoTrain endpoint.
- If `create_project` returns HTTP 500, treat it as endpoint-side failure and use the Colab path below.

### 5.2 Google Colab path (recommended fallback)

Use the included notebook:

- `docs/hf-colab-sft.ipynb`

Workflow:

1. Open `docs/hf-colab-sft.ipynb` in Google Colab.
2. Run cells to install deps, upload `tmp/ai/hf_sft_train_amazon.jsonl`, and train LoRA/QLoRA.
3. Push adapter and merged model to your Hugging Face Hub repo.
4. Set your runtime model to the merged repo id.

Then run inference in this app by setting:

```bash
AI_PROVIDER="huggingface"
HUGGING_FACE_API_KEY="<your-token>"
HUGGING_FACE_MODEL="<your-merged-model-repo-id>"
```

Runtime note:

- This server now falls back to Hugging Face Inference API when router chat reports `model_not_supported`, which helps with custom fine-tuned repos.

## 6) Gemini usage

For runtime (no fine-tune required):

```bash
AI_PROVIDER="gemini"
GEMINI_API_KEY="<your-key>"
GEMINI_CHAT_MODEL="gemini-2.0-flash"
```

## Notes

- Remove personal/sensitive data before training.
- Keep examples aligned with live catalog behavior (no fake products).
- Keep retrieval active so recommendations stay grounded in current inventory.
