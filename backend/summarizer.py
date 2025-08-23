import json
import os
import time
from typing import Tuple
from jsonschema import Draft202012Validator

SCHEMA = {
    "type": "object",
    "properties": {
        "summary_bullets": {"type": "array", "items": {"type": "string"}},
        "decisions": {"type": "array", "items": {"type": "string"}},
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "owner": {"type": ["string", "null"]},
                    "due_date": {"type": ["string", "null"]},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]}
                },
                "required": ["description", "priority"],
                "additionalProperties": True
            }
        }
    },
    "required": ["summary_bullets", "decisions", "action_items"],
    "additionalProperties": False
}


def _validate(data: dict):
    Draft202012Validator(SCHEMA).validate(data)

# ---------- Stub fallback ----------


def _rules_stub(notes_text: str, title: str) -> dict:
    lines = [ln.strip()
             for ln in (notes_text or "").splitlines() if ln.strip()]
    bullets, decisions, actions = [], [], []
    for ln in lines:
        low = ln.lower()
        if low.startswith(("decision:", "decisions:")):
            decisions.append(ln.split(":", 1)[1].strip() or ln)
        elif low.startswith(("ai:", "action:", "todo:")):
            desc = ln.split(":", 1)[1].strip() or ln
            actions.append({"description": desc, "owner": None,
                           "due_date": None, "priority": "medium"})
        else:
            bullets.append(ln)
    if not bullets and lines:
        bullets = lines[:5]
    result = {"summary_bullets": bullets[:8],
              "decisions": decisions[:8], "action_items": actions[:15]}
    _validate(result)
    return result

# ---------- OpenAI prompt + call ----------


def _prompt(title: str, notes: str) -> str:
    return f"""
You are an assistant that turns meeting notes into structured outcomes.

Meeting title: {title}

Notes (raw text):
\"\"\"{notes}\"\"\"

Return STRICT JSON with this schema:
{json.dumps(SCHEMA, indent=2)}

Rules:
- Write concise, actionable bullets.
- Extract clear decisions.
- For action_items, infer priority (low/medium/high). Owner/due_date may be null.
- Do NOT include any extra keys or prose, only the JSON object.
"""


def _call_openai(title: str, notes: str, model: str) -> Tuple[dict, dict]:
    # Build an httpx client that ignores proxy env vars entirely.
    # trust_env=False prevents httpx from using HTTP(S)_PROXY, etc.
    import httpx
    from openai import OpenAI

    http_client = httpx.Client(timeout=30.0, trust_env=False)
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"),
                    http_client=http_client)

    prompt = _prompt(title, notes)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You output only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=400,  # cost cap
    )

    content = (resp.choices[0].message.content or "").strip()

    # Strip ``` fences if present
    if content.startswith("```"):
        content = content.strip("`").lstrip("json").strip()

    # Best-effort slice to outermost JSON if any stray text appears
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        content = content[start:end+1]

    data = json.loads(content)
    _validate(data)

    usage = getattr(resp, "usage", None)
    usage_meta = {
        "prompt_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
        "completion_tokens": getattr(usage, "completion_tokens", None) if usage else None,
        "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
    }

    meta = {
        "provider": "openai",
        "model": model,
        "prompt_version": os.getenv("PROMPT_VERSION", "v1"),
        "usage": usage_meta
    }
    return data, meta

# ---------- Public API ----------


def summarize_notes(title: str, notes_text: str) -> Tuple[dict, dict]:
    """
    Returns (result_dict, meta_dict).
    Uses OpenAI when configured, otherwise falls back to the rules-based stub.
    """
    provider = os.getenv("LLM_PROVIDER", "stub").lower()

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        # Try twice to recover from minor transient issues; then fall back to stub.
        for _ in range(2):
            try:
                return _call_openai(title, notes_text, model)
            except Exception as e:
                print("[LLM ERROR]", repr(e))  # TEMP log during dev
                time.sleep(0.5)

    # Fallback: stub (works offline / without key)
    out = _rules_stub(notes_text, title)
    meta = {"provider": "stub", "model": "rules",
            "prompt_version": os.getenv("PROMPT_VERSION", "v1"), "usage": None}
    return out, meta
