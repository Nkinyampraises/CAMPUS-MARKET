#!/usr/bin/env python3
"""
Download a manageable subset from Amazon Reviews 2023 and convert it to
prompt/completion training examples for the existing fine-tune pipeline.

Usage example:
  python scripts/ai/download-amazon-reviews23.py ^
    --categories All_Beauty ^
    --samples 180 ^
    --output data/ai/fine_tune_source.amazon_reviews23.sample.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

from huggingface_hub import hf_hub_download


DATASET_NAME = "McAuley-Lab/Amazon-Reviews-2023"


def clean_text(value: Any, max_len: int = 500) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text[:max_len]


def normalize_list(values: Any, max_items: int = 5, max_len_each: int = 140) -> list[str]:
    if not isinstance(values, list):
        return []
    output: list[str] = []
    for entry in values:
        text = clean_text(entry, max_len_each)
        if text:
            output.append(text)
        if len(output) >= max_items:
            break
    return output


def parse_price(value: Any) -> str:
    raw = clean_text(value, 80)
    if not raw or raw.lower() in {"none", "null", "nan"}:
        return "Price not listed"

    if raw.startswith("$"):
        return raw

    numeric_match = re.search(r"(\d+(?:\.\d+)?)", raw.replace(",", ""))
    if numeric_match:
        return f"${numeric_match.group(1)}"

    return raw


def build_prompt(record: dict[str, Any], category: str) -> str:
    title = clean_text(record.get("title"), 180) or "Unknown product"
    store = clean_text(record.get("store"), 120) or "Unknown store"
    price = parse_price(record.get("price"))
    rating = record.get("average_rating")
    rating_num = record.get("rating_number")
    features = normalize_list(record.get("features"), max_items=4, max_len_each=120)
    description = normalize_list(record.get("description"), max_items=3, max_len_each=150)

    features_line = "; ".join(features) if features else "No feature bullets provided"
    description_line = "; ".join(description) if description else "No long description provided"

    rating_line = "Rating unavailable"
    try:
        rating_float = float(rating)
        rating_count = int(rating_num or 0)
        if rating_count > 0:
            rating_line = f"{rating_float:.1f}/5 from {rating_count} ratings"
        else:
            rating_line = f"{rating_float:.1f}/5 (rating count unavailable)"
    except Exception:
        rating_line = "Rating unavailable"

    return (
        "You are helping a student compare an Amazon listing.\n"
        f"Category: {category}\n"
        f"Product title: {title}\n"
        f"Store: {store}\n"
        f"Price: {price}\n"
        f"Rating: {rating_line}\n"
        f"Top features: {features_line}\n"
        f"Description highlights: {description_line}\n\n"
        "Give a concise buyer guide with:\n"
        "1) Best fit use-cases\n"
        "2) Pros\n"
        "3) Watch-outs\n"
        "4) A quick buy/no-buy recommendation."
    )


def build_completion(record: dict[str, Any]) -> str:
    title = clean_text(record.get("title"), 180) or "This product"
    price = parse_price(record.get("price"))
    features = normalize_list(record.get("features"), max_items=4, max_len_each=120)
    description = normalize_list(record.get("description"), max_items=3, max_len_each=150)

    pros: list[str] = []
    if features:
        pros.extend(features[:2])
    if description:
        pros.append(description[0])
    if not pros:
        pros.append("The listing provides basic product metadata and category context.")

    watch_outs: list[str] = []
    if "Price not listed" in price:
        watch_outs.append("Pricing is missing, so compare costs before deciding.")
    if not features:
        watch_outs.append("Feature details are limited; verify specs on the product page.")
    if not description:
        watch_outs.append("Description is short, so check material/size compatibility manually.")
    if not watch_outs:
        watch_outs.append("Double-check warranty, return policy, and delivery timelines.")

    recommendation = "Buy if it matches your exact need and budget; otherwise compare 2-3 alternatives first."

    return (
        f"Best fit use-cases: {title} is most suitable for shoppers who need this category item at around {price}.\n"
        f"Pros: {'; '.join(pros[:3])}\n"
        f"Watch-outs: {'; '.join(watch_outs[:3])}\n"
        f"Recommendation: {recommendation}"
    )


def download_meta_file(category: str) -> str:
    filename = f"raw/meta_categories/meta_{category}.jsonl"
    return hf_hub_download(
        repo_id=DATASET_NAME,
        repo_type="dataset",
        filename=filename,
    )


def iter_meta_records(category: str) -> Iterable[dict[str, Any]]:
    local_path = download_meta_file(category)
    with open(local_path, "r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                payload = json.loads(line)
            except Exception:
                continue
            if isinstance(payload, dict):
                yield payload


def is_valid_record(record: dict[str, Any]) -> bool:
    title = clean_text(record.get("title"), 180)
    if len(title) < 6:
        return False
    asin = clean_text(record.get("parent_asin"), 80)
    if not asin:
        return False
    return True


def parse_categories(raw: str) -> list[str]:
    categories = [clean_text(item, 80) for item in str(raw or "").split(",")]
    categories = [item for item in categories if item]
    return categories or ["All_Beauty"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Amazon Reviews 2023 subset and create training source JSON.")
    parser.add_argument(
        "--categories",
        default="All_Beauty",
        help="Comma-separated Amazon category names (default: All_Beauty)",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=180,
        help="Total number of prompt/completion records to generate (default: 180)",
    )
    parser.add_argument(
        "--max-scan-per-category",
        type=int,
        default=2500,
        help="Safety limit for scanned source rows per category (default: 2500)",
    )
    parser.add_argument(
        "--output",
        default="data/ai/fine_tune_source.amazon_reviews23.sample.json",
        help="Output JSON file path",
    )
    args = parser.parse_args()

    categories = parse_categories(args.categories)
    total_samples = max(20, int(args.samples))
    per_category_target = math.ceil(total_samples / max(1, len(categories)))
    max_scan = max(100, int(args.max_scan_per_category))

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, Any]] = []
    summary: dict[str, dict[str, int]] = {}

    for category in categories:
        summary[category] = {"accepted": 0, "scanned": 0}
        try:
            iterator = iter_meta_records(category)
        except Exception as exc:
            raise RuntimeError(f"Failed to load category '{category}': {exc}") from exc

        seen_asins: set[str] = set()

        for record in iterator:
            summary[category]["scanned"] += 1
            if summary[category]["scanned"] > max_scan:
                break

            if not isinstance(record, dict):
                continue
            if not is_valid_record(record):
                continue

            asin = clean_text(record.get("parent_asin"), 80)
            if not asin or asin in seen_asins:
                continue

            prompt = build_prompt(record, category)
            completion = build_completion(record)
            if len(prompt) < 30 or len(completion) < 30:
                continue

            rows.append(
                {
                    "prompt": prompt,
                    "completion": completion,
                    "metadata": {
                        "dataset": DATASET_NAME,
                        "category": category,
                        "parent_asin": asin,
                        "main_category": clean_text(record.get("main_category"), 120),
                        "title": clean_text(record.get("title"), 200),
                    },
                }
            )
            seen_asins.add(asin)
            summary[category]["accepted"] += 1

            if summary[category]["accepted"] >= per_category_target:
                break

        if len(rows) >= total_samples:
            break

    rows = rows[:total_samples]
    if not rows:
        raise RuntimeError("No valid Amazon records were collected. Try different categories or larger scan limits.")

    output_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Saved {len(rows)} records to {output_path}")
    print("Category summary:")
    for category, stats in summary.items():
        print(f"- {category}: accepted={stats['accepted']} scanned={stats['scanned']}")


if __name__ == "__main__":
    main()
