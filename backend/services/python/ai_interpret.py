import os
import json

PROMPTS = {
    "normality": "Interpret normality results in academic English APA 7 max 150 words. Results: {data}",
    "item-analysis": "Interpret item analysis results in academic English APA 7 max 150 words. Results: {data}",
    "reliability": "Interpret reliability results in academic English APA 7 max 150 words. Results: {data}",
    "content-validity": "Interpret content validity results in academic English APA 7 max 150 words. Results: {data}",
    "efa": "Interpret EFA results in academic English APA 7 max 200 words. Results: {data}",
    "cfa": "Interpret CFA results in academic English APA 7 max 200 words. Results: {data}",
    "sem": "Interpret SEM results in academic English APA 7 max 200 words. Results: {data}",
}

def get_ai_interpretation(module, data, lang="en"):
    import anthropic
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    client = anthropic.Anthropic(api_key=key)
    prompt = PROMPTS.get(module, PROMPTS["normality"]).format(data=json.dumps(data)[:2000])
    if lang == "tr":
        prompt += " Please respond in Turkish."
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )
    return msg.content[0].text
