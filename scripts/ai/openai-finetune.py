#!/usr/bin/env python3
"""
OpenAI supervised fine-tuning helper for this repository.

Features:
- Loads OPENAI_API_KEY from environment or local .env file
- Validates chat JSONL structure before upload
- Uploads training/validation files to /v1/files (purpose=fine-tune)
- Creates fine-tuning job via /v1/fine_tuning/jobs
- Optional wait mode to poll until completion

References:
- https://platform.openai.com/docs/api-reference/files
- https://platform.openai.com/docs/api-reference/fine-tuning
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests


OPENAI_API_BASE = "https://api.openai.com/v1"


class OpenAIRequestError(RuntimeError):
    def __init__(self, path: str, status_code: int, message: str):
        super().__init__(f"OpenAI API error {status_code} on {path}: {message}")
        self.path = path
        self.status_code = status_code
        self.message = message


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


def build_headers() -> dict[str, str]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing. Set it in env or .env file.")

    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    project = os.environ.get("OPENAI_PROJECT", "").strip()
    if project:
        headers["OpenAI-Project"] = project

    org = os.environ.get("OPENAI_ORG_ID", "").strip()
    if org:
        headers["OpenAI-Organization"] = org

    return headers


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


def validate_chat_jsonl(path: Path) -> int:
    if not path.exists():
        raise RuntimeError(f"File not found: {path}")
    if path.suffix.lower() != ".jsonl":
        raise RuntimeError(f"Expected .jsonl file, got: {path.name}")

    rows = parse_jsonl(path)
    if not rows:
        raise RuntimeError(f"No rows found in {path}")

    for index, row in enumerate(rows, start=1):
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) < 2:
            raise RuntimeError(f"{path}: row {index} missing valid messages array.")

        if not isinstance(messages[-1], dict) or messages[-1].get("role") != "assistant":
            raise RuntimeError(f"{path}: row {index} last message must be assistant.")

        for msg_idx, message in enumerate(messages, start=1):
            if not isinstance(message, dict):
                raise RuntimeError(f"{path}: row {index} message {msg_idx} must be object.")
            role = str(message.get("role", "")).strip()
            content = message.get("content", "")
            if role not in {"system", "user", "assistant"}:
                raise RuntimeError(f"{path}: row {index} message {msg_idx} invalid role '{role}'.")
            if not isinstance(content, str) or not content.strip():
                raise RuntimeError(f"{path}: row {index} message {msg_idx} empty content.")

    return len(rows)


def request_json(
    method: str,
    path: str,
    headers: dict[str, str],
    json_body: dict[str, Any] | None = None,
    timeout_s: int = 120,
) -> dict[str, Any]:
    url = f"{OPENAI_API_BASE}{path}"
    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            headers={**headers, "Content-Type": "application/json"},
            json=json_body,
            timeout=timeout_s,
        )
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Network error calling {url}: {exc}") from exc

    if not response.ok:
        try:
            error_payload = response.json()
        except Exception:
            error_payload = {"error": {"message": response.text[:500]}}
        raise OpenAIRequestError(
            path=path,
            status_code=response.status_code,
            message=str(error_payload.get("error", {}).get("message", error_payload)),
        )

    try:
        return response.json()
    except Exception as exc:
        raise RuntimeError(f"Non-JSON response from {path}: {exc}") from exc


def upload_file(file_path: Path, headers: dict[str, str]) -> str:
    url = f"{OPENAI_API_BASE}/files"
    with file_path.open("rb") as handle:
        files = {"file": (file_path.name, handle, "application/jsonl")}
        data = {"purpose": "fine-tune"}
        try:
            response = requests.post(
                url,
                headers=headers,
                files=files,
                data=data,
                timeout=240,
            )
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(f"Network error uploading {file_path.name}: {exc}") from exc

    if not response.ok:
        try:
            payload = response.json()
        except Exception:
            payload = {"error": {"message": response.text[:500]}}
        raise RuntimeError(
            f"Failed to upload {file_path.name}: "
            f"{payload.get('error', {}).get('message', payload)}"
        )

    payload = response.json()
    file_id = str(payload.get("id", "")).strip()
    if not file_id:
        raise RuntimeError(f"Upload succeeded but no file id was returned for {file_path.name}.")
    return file_id


def candidate_models(requested_model: str) -> list[str]:
    requested = requested_model.strip()
    if not requested:
        return ["gpt-4.1-mini-2025-04-14"]

    candidates = [requested]
    stable_map = {
        "gpt-4.1": "gpt-4.1-2025-04-14",
        "gpt-4.1-mini": "gpt-4.1-mini-2025-04-14",
        "gpt-4.1-nano": "gpt-4.1-nano-2025-04-14",
    }
    fallback = stable_map.get(requested)
    if fallback and fallback not in candidates:
        candidates.append(fallback)
    return candidates


def create_finetune_job(
    headers: dict[str, str],
    model: str,
    training_file_id: str,
    validation_file_id: str,
    suffix: str,
) -> tuple[dict[str, Any], str]:
    last_error: OpenAIRequestError | None = None

    for candidate in candidate_models(model):
        payload: dict[str, Any] = {
            "model": candidate,
            "training_file": training_file_id,
        }
        if validation_file_id:
            payload["validation_file"] = validation_file_id
        if suffix.strip():
            payload["suffix"] = suffix.strip()

        try:
            job = request_json(
                "POST",
                "/fine_tuning/jobs",
                headers=headers,
                json_body=payload,
                timeout_s=120,
            )
            return job, candidate
        except OpenAIRequestError as error:
            last_error = error
            if error.status_code == 400 and "not available for fine-tuning" in error.message:
                print(f"Model '{candidate}' is not available for fine-tuning. Trying next candidate...")
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Failed to create fine-tuning job for unknown reason.")


def wait_for_job(job_id: str, headers: dict[str, str], interval_s: int = 20) -> dict[str, Any]:
    last_status = ""
    while True:
        job = request_json("GET", f"/fine_tuning/jobs/{job_id}", headers=headers, timeout_s=120)
        status = str(job.get("status", "")).strip() or "unknown"
        if status != last_status:
            print(f"Job {job_id} status: {status}")
            last_status = status

        if status in {"succeeded", "failed", "cancelled"}:
            return job

        time.sleep(max(5, interval_s))


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload JSONL files and create OpenAI fine-tuning job.")
    parser.add_argument("--train-file", required=True, help="Training JSONL file path.")
    parser.add_argument("--validation-file", default="", help="Optional validation JSONL file path.")
    parser.add_argument("--model", default="gpt-4.1-mini-2025-04-14", help="Base model to fine-tune.")
    parser.add_argument("--suffix", default="", help="Optional model suffix.")
    parser.add_argument("--wait", action="store_true", help="Wait and poll until job completes.")
    parser.add_argument("--poll-interval", type=int, default=20, help="Polling interval in seconds.")
    parser.add_argument("--dotenv", default=".env", help="Dotenv path to load API key from (default: .env).")
    parser.add_argument("--dry-run", action="store_true", help="Validate files only; skip upload/job creation.")
    args = parser.parse_args()

    load_dotenv(Path(args.dotenv).resolve())

    train_path = Path(args.train_file).resolve()
    val_path = Path(args.validation_file).resolve() if args.validation_file else None

    train_count = validate_chat_jsonl(train_path)
    print(f"Training file validated: {train_path} ({train_count} rows)")

    if val_path:
        val_count = validate_chat_jsonl(val_path)
        print(f"Validation file validated: {val_path} ({val_count} rows)")

    if args.dry_run:
        print("Dry run complete. No OpenAI API calls were made.")
        return

    headers = build_headers()

    print("Uploading training file...")
    training_file_id = upload_file(train_path, headers)
    print(f"Training file uploaded: {training_file_id}")

    validation_file_id = ""
    if val_path:
        print("Uploading validation file...")
        validation_file_id = upload_file(val_path, headers)
        print(f"Validation file uploaded: {validation_file_id}")

    print("Creating fine-tuning job...")
    job, selected_model = create_finetune_job(
        headers=headers,
        model=args.model,
        training_file_id=training_file_id,
        validation_file_id=validation_file_id,
        suffix=args.suffix,
    )
    job_id = str(job.get("id", "")).strip()
    if not job_id:
        raise RuntimeError(f"Fine-tuning job response did not include id: {job}")

    print(f"Fine-tuning job created: {job_id}")
    print(f"Model used: {selected_model}")
    print(f"Current status: {job.get('status')}")

    if args.wait:
        final_job = wait_for_job(job_id, headers=headers, interval_s=args.poll_interval)
        final_status = str(final_job.get("status", "")).strip() or "unknown"
        print(f"Final status: {final_status}")
        fine_tuned_model = str(final_job.get("fine_tuned_model", "")).strip()
        if fine_tuned_model:
            print(f"Fine-tuned model: {fine_tuned_model}")
        if final_status != "succeeded":
            error_payload = final_job.get("error")
            if error_payload:
                print(f"Job error: {error_payload}")
            raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}")
        raise SystemExit(1)
