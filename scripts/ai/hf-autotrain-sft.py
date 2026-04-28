#!/usr/bin/env python3
"""
Hugging Face AutoTrain SFT helper.

What this script does:
- Loads HF token from env or local .env
- Optionally loads a dedicated AutoTrain API key for submit/log polling
- Validates SFT JSONL input (expects {"text": "..."} rows)
- Creates/updates a Hub dataset repo and uploads train.jsonl
- Submits an AutoTrain `llm:sft` project via hosted AutoTrain API
- Optionally polls logs for a short period

Notes:
- This submits a remote training job; completion time depends on hardware queue.
- Model artifacts are expected under <username>/<project_name> when job succeeds.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests
from huggingface_hub import HfApi


DEFAULT_AUTOTRAIN_API_BASE = "https://autotrain-projects-autotrain-advanced.hf.space"
COLAB_NOTEBOOK_PATH = "docs/hf-colab-sft.ipynb"


class ApiHttpError(RuntimeError):
    def __init__(self, url: str, status_code: int, detail: str):
        super().__init__(f"HTTP {status_code} calling {url}: {detail}")
        self.url = url
        self.status_code = status_code
        self.detail = detail


def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def resolve_hf_token() -> str:
    for key in ("HUGGING_FACE_API_KEY", "HF_TOKEN", "HUGGINGFACE_API_KEY"):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise RuntimeError("Missing Hugging Face token. Set HUGGING_FACE_API_KEY or HF_TOKEN in env/.env.")


def resolve_autotrain_token(default_token: str) -> str:
    for key in ("HF_AUTOTRAIN_API_KEY", "AUTOTRAIN_API_KEY"):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    return default_token


def parse_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for idx, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except Exception as exc:
                raise RuntimeError(f"{path}: invalid JSON at line {idx}: {exc}") from exc
            if not isinstance(payload, dict):
                raise RuntimeError(f"{path}: line {idx} must be a JSON object.")
            rows.append(payload)
    return rows


def validate_sft_jsonl(path: Path) -> int:
    if not path.exists():
        raise RuntimeError(f"File not found: {path}")
    if path.suffix.lower() != ".jsonl":
        raise RuntimeError(f"Expected .jsonl file, got: {path.name}")

    rows = parse_jsonl(path)
    if not rows:
        raise RuntimeError(f"No rows found in {path}")

    for index, row in enumerate(rows, start=1):
        text = row.get("text")
        if not isinstance(text, str) or not text.strip():
            raise RuntimeError(f"{path}: row {index} missing non-empty 'text' field.")

    return len(rows)


def stable_short_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]


def request_json(
    method: str,
    url: str,
    token: str,
    payload: dict[str, Any] | None = None,
    timeout_s: int = 120,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            headers=headers,
            json=payload,
            timeout=timeout_s,
        )
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Network error calling {url}: {exc}") from exc

    body_text = (response.text or "").strip()
    if not response.ok:
        try:
            body_json = response.json()
            detail = json.dumps(body_json, ensure_ascii=False)
        except Exception:
            detail = body_text[:500] or "unknown error"
        raise ApiHttpError(url=url, status_code=response.status_code, detail=detail)

    try:
        return response.json()
    except Exception:
        if body_text:
            return {"raw": body_text}
        return {}


def extract_log_text(payload: dict[str, Any]) -> str:
    if not isinstance(payload, dict):
        return ""
    for key in ("logs", "log", "message", "detail", "raw"):
        value = payload.get(key)
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return "\n".join(str(item) for item in value)
    return json.dumps(payload, ensure_ascii=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Submit Hugging Face AutoTrain LLM SFT job.")
    parser.add_argument(
        "--train-file",
        default="tmp/ai/hf_sft_train_amazon.jsonl",
        help="SFT training JSONL with {'text': ...} rows.",
    )
    parser.add_argument("--project-name", default="kori-amazon-sft", help="AutoTrain project/model repo name.")
    parser.add_argument(
        "--dataset-repo",
        default="",
        help="Optional dataset repo id (<user>/<repo>). Defaults to <user>/<project>-data.",
    )
    parser.add_argument(
        "--base-model",
        default="HuggingFaceTB/SmolLM2-135M-Instruct",
        help="Base model to fine-tune.",
    )
    parser.add_argument(
        "--hardware",
        default="spaces-cpu-basic",
        help="AutoTrain hardware type (for example: spaces-cpu-basic, spaces-t4-small, spaces-a10g-small).",
    )
    parser.add_argument(
        "--api-base-url",
        default="",
        help="AutoTrain API base URL. Defaults to HF_AUTOTRAIN_API_BASE env var or hosted public API.",
    )
    parser.add_argument("--epochs", type=int, default=1, help="Training epochs.")
    parser.add_argument("--batch-size", type=int, default=2, help="Per-device batch size.")
    parser.add_argument(
        "--gradient-accumulation",
        type=int,
        default=4,
        help="Gradient accumulation steps.",
    )
    parser.add_argument("--learning-rate", type=float, default=3e-5, help="Learning rate.")
    parser.add_argument("--max-length", type=int, default=2048, help="Model max sequence length.")
    parser.add_argument("--no-peft", action="store_true", help="Disable PEFT/LoRA.")
    parser.add_argument("--dotenv", default=".env", help="Dotenv path to load token from.")
    parser.add_argument(
        "--dataset-public",
        action="store_true",
        help="Create dataset repo as public (default private).",
    )
    parser.add_argument("--wait", action="store_true", help="Poll logs for a limited time after submission.")
    parser.add_argument(
        "--wait-minutes",
        type=int,
        default=20,
        help="How many minutes to poll logs when --wait is enabled.",
    )
    parser.add_argument("--poll-interval", type=int, default=30, help="Log polling interval (seconds).")
    args = parser.parse_args()

    load_dotenv(Path(args.dotenv).resolve())
    hf_token = resolve_hf_token()
    autotrain_token = resolve_autotrain_token(hf_token)
    api_base_url = (
        args.api_base_url.strip()
        or os.environ.get("HF_AUTOTRAIN_API_BASE", "").strip()
        or DEFAULT_AUTOTRAIN_API_BASE
    ).rstrip("/")

    train_path = Path(args.train_file).resolve()
    row_count = validate_sft_jsonl(train_path)
    print(f"SFT file validated: {train_path} ({row_count} rows)")

    api = HfApi(token=hf_token)
    me = api.whoami()
    username = str(me.get("name", "")).strip()
    if not username:
        raise RuntimeError("Unable to resolve Hugging Face username from token.")

    dataset_repo = args.dataset_repo.strip() or f"{username}/{args.project_name}-data"
    model_repo = f"{username}/{args.project_name}"
    dataset_private = not args.dataset_public

    print(f"Using Hugging Face user: {username}")
    print(f"Ensuring dataset repo: {dataset_repo} (private={dataset_private})")
    api.create_repo(repo_id=dataset_repo, repo_type="dataset", private=dataset_private, exist_ok=True)
    api.upload_file(
        path_or_fileobj=str(train_path),
        path_in_repo="train.jsonl",
        repo_id=dataset_repo,
        repo_type="dataset",
        commit_message=f"Upload SFT training data ({row_count} rows)",
    )
    print("Dataset uploaded to Hub as train.jsonl")

    api.create_repo(repo_id=model_repo, repo_type="model", private=False, exist_ok=True)
    print(f"Ensured model repo exists: {model_repo}")

    project_suffix = stable_short_hash(f"{username}:{args.project_name}:{int(time.time())}")
    project_name = f"{args.project_name}-{project_suffix}"

    payload = {
        "username": username,
        "project_name": project_name,
        "task": "llm:sft",
        "base_model": args.base_model,
        "hub_dataset": dataset_repo,
        "train_split": "train",
        "hardware": args.hardware,
        "column_mapping": {
            "text_column": "text",
        },
        "params": {
            "block_size": 1024,
            "model_max_length": args.max_length,
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "lr": args.learning_rate,
            "peft": not args.no_peft,
            "quantization": "int4",
            "target_modules": "all-linear",
            "padding": "right",
            "optimizer": "adamw_torch",
            "scheduler": "linear",
            "gradient_accumulation": args.gradient_accumulation,
            "mixed_precision": None,
            "chat_template": "chatml",
        },
    }

    print(f"Submitting AutoTrain project: {project_name}")
    try:
        response = request_json(
            method="POST",
            url=f"{api_base_url}/api/create_project",
            token=autotrain_token,
            payload=payload,
        )
    except ApiHttpError as error:
        if error.status_code >= 500:
            print("")
            print("AutoTrain API returned a server-side failure (HTTP 5xx).")
            print("This is usually endpoint-side instability rather than your dataset format.")
            print(f"Suggested fallback: run Colab fine-tuning notebook -> {COLAB_NOTEBOOK_PATH}")
            print("Then set HUGGING_FACE_MODEL to your trained repo id in .env and restart the server.")
            print("")
        raise

    job_id = (
        str(response.get("job_id", "")).strip()
        or str(response.get("jid", "")).strip()
        or str(response.get("job", "")).strip()
    )
    print(f"AutoTrain response: {json.dumps(response, ensure_ascii=False)}")
    if not job_id:
        raise RuntimeError("Project submission returned no job id. See response above.")

    print(f"AutoTrain job id: {job_id}")
    print(f"Expected model repo after success: {model_repo}")
    print("When training succeeds, set HUGGING_FACE_MODEL to the trained repo id.")

    if args.wait:
        end_time = time.time() + max(1, args.wait_minutes) * 60
        last_digest = ""
        while time.time() < end_time:
            try:
                logs_payload = request_json(
                    method="POST",
                    url=f"{api_base_url}/api/logs",
                    token=autotrain_token,
                    payload={"jid": job_id},
                    timeout_s=120,
                )
                text = extract_log_text(logs_payload).strip()
                digest = stable_short_hash(text[:4000]) if text else ""
                if digest and digest != last_digest:
                    print("---- AutoTrain logs update ----")
                    if len(text) > 2000:
                        print(text[-2000:])
                    else:
                        print(text)
                    last_digest = digest
            except Exception as error:
                print(f"Log polling warning: {error}")

            time.sleep(max(10, args.poll_interval))

        print("Stopped waiting. Training may still be running in Hugging Face AutoTrain.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}")
        raise SystemExit(1)
