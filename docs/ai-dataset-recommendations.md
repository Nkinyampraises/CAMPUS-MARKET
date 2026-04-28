# AI Dataset Recommendations (Marketplace)

Date checked: 2026-04-27

## Best starting point for this project

1. Use your own marketplace data first:
- `data/ai/fine_tune_source.marketplace.json`
- Real user chat logs + accepted recommendations (after PII cleanup)
- Your listing catalog snapshots from this app

Why:
- It matches your exact domain (Cameroon student marketplace, XAF budgets, room/kitchen intents).
- It minimizes hallucination drift versus generic e-commerce datasets.

## External datasets to blend in

1. Bitext Retail eCommerce Chatbot Dataset
- Link: https://huggingface.co/datasets/bitext/Bitext-retail-ecommerce-llm-chatbot-training-dataset
- Use for: intent coverage, support wording patterns, fallback QA behavior.
- Notes: synthetic/hybrid data; adapt tone and policy to your app.

2. Shopify Product Catalogue Benchmark
- Link: https://huggingface.co/datasets/Shopify/product-catalogue
- Use for: product taxonomy understanding and category normalization.
- Notes: strong for classification; not a direct chat-response dataset.

3. Mercari MerRec
- Link: https://huggingface.co/datasets/mercari-us/merrec
- Use for: recommendation and user-item interaction research.
- Notes: very large and recommendation-focused; not plug-and-play for assistant replies.

4. Amazon Reviews 2023 (official mirror)
- Link: https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023
- Use for: product language diversity and review-informed ranking features.
- Notes: very large; requires heavy filtering to avoid domain mismatch.

## Suggested blend strategy

1. 70% project-native examples (your own marketplace style)
2. 20% Bitext retail QA for intent breadth
3. 10% catalog/taxonomy examples from Shopify/Amazon subsets

Keep all generated responses grounded to live listings during inference.
