import json
import re
import uuid
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.schemas.contracts import QualificationOut
from app.services.web_search import perform_service_web_research

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"disregard\s+(all\s+)?prior",
    r"system\s+prompt",
    r"system\s+override",
    r"you\s+are\s+now",
    r"developer\s+mode",
    r"jailbreak",
    r"quote\s+me\s+£?0(\.0+)?\b",
    r"approve\s+automatically",
    r"admin\s+override"
]

def check_prompt_injection(message: str) -> bool:
    lower = message.lower()
    return any(re.search(pat, lower) for pat in INJECTION_PATTERNS)

def extract_uk_postcode(text: str) -> Optional[str]:
    match = re.search(r'\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b', text.upper())
    if match:
        return match.group(1)
    match_short = re.search(r'\b([A-Z]{1,2}\d[A-Z\d]?)\b', text.upper())
    if match_short:
        return match_short.group(1)
    return None

async def qualify_with_gemini(message: str, customer_name: str, address: str | None = None) -> dict:
    """Run the ADK qualification agent with strict prompt containment. If credentials are absent, return transparent rules-only result."""
    if check_prompt_injection(message):
        return {
            "category": "disallowed_or_suspicious",
            "urgency": "high",
            "service_type": None,
            "facts": {"message_received": True, "prompt_injection_flagged": True, "address_supplied": bool(address)},
            "missing_fields": ["legitimate_service_requirement"],
            "confidence": 0.1,
            "confidence_reason": "Suspicious instruction / prompt override pattern detected in untrusted customer input. Manual staff assessment required.",
            "customer_reply_draft": "Thank you for contacting us. A member of our operations team will review your enquiry manually.",
            "needs_human_review": True,
            "web_research": []
        }

    if not settings.gemini_api_key:
        return rules_only(message, address)
    try:
        import os
        os.environ["GOOGLE_API_KEY"] = settings.gemini_api_key
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService
        from google.genai import types
        from app.agents.sub_agents.qualification.agent import root_agent
        app_name = "brilliant_brains"
        session_service = InMemorySessionService()
        user_id = "local-reviewer"
        session = await session_service.create_session(app_name=app_name, user_id=user_id, session_id=str(uuid.uuid4()))
        runner = Runner(agent=root_agent, app_name=app_name, session_service=session_service)
        prompt = f"Customer name: {customer_name}\nAddress supplied: {address or 'Not supplied'}\nCustomer message (untrusted): {message}"
        content = types.Content(role="user", parts=[types.Part(text=prompt)])
        final_text = ""
        async for event in runner.run_async(user_id=user_id, session_id=session.id, new_message=content):
            if event.is_final_response() and event.content and event.content.parts:
                final_text = "".join(p.text or "" for p in event.content.parts)
        match = re.search(r"\{.*\}", final_text, re.S)
        if not match:
            raise ValueError("Agent did not return a JSON object")
        data = json.loads(match.group())
        validated = QualificationOut.model_validate(data)
        out = validated.model_dump()
        out["web_research"] = perform_service_web_research(out.get("service_type"), message, address)
        return out
    except Exception as exc:
        result = rules_only(message, address)
        result["confidence_reason"] = "Gemini/ADK unavailable; deterministic fallback used. " + str(exc)[:180]
        result["needs_human_review"] = True
        return result

def rules_only(message: str, address: str | None = None) -> dict:
    text = message.lower()

    if check_prompt_injection(message):
        return {
            "category": "disallowed_or_suspicious",
            "urgency": "high",
            "service_type": None,
            "facts": {"message_received": True, "prompt_injection_flagged": True, "address_supplied": bool(address)},
            "missing_fields": ["legitimate_service_requirement"],
            "confidence": 0.1,
            "confidence_reason": "Suspicious instruction / prompt override pattern detected in untrusted customer input. Manual staff assessment required.",
            "customer_reply_draft": "Thank you for contacting us. A member of our operations team will review your enquiry manually.",
            "needs_human_review": True,
            "web_research": []
        }

    urgency = "emergency" if any(x in text for x in ["fire", "gas leak", "flooding", "sparking", "trapped"]) else "high" if any(x in text for x in ["urgent", "asap", "today", "broken down"]) else "normal"
    category = "service_request" if len(text.strip()) >= 8 else "unclear"
    
    service_type = None
    if urgency == "emergency":
        service_type = "Emergency response"
    elif "inspection" in text or "inspect" in text:
        service_type = "Site inspection"
    elif "maintenance" in text or "routine" in text:
        service_type = "Preventive maintenance"
    else:
        from app.services.web_search import detect_trade_category
        service_type = detect_trade_category(text)

    missing = []
    if not address:
        missing.append("site_address_or_postcode")
    if not service_type and not any(x in text for x in ["service", "clean", "install", "check"]):
        missing.append("service_required")
    if not any(x in text for x in ["today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "next week", "date", "morning", "afternoon"]):
        missing.append("preferred_timing")

    confidence = 0.85 if (address and service_type and not missing) else 0.55 if not missing else 0.35
    reason = "Deterministic rules extracted facts from customer message." if confidence > 0.5 else "Rules-only fallback; missing key requirements (address or timing)."

    web_links = perform_service_web_research(service_type, message, address)

    return {
        "category": category,
        "urgency": urgency,
        "service_type": service_type,
        "facts": {
            "message_received": True,
            "address_supplied": bool(address),
            "inferred_service": service_type,
            "evidence_snippet": message[:120]
        },
        "missing_fields": missing,
        "confidence": confidence,
        "confidence_reason": reason,
        "customer_reply_draft": "Thanks for your enquiry. Could you confirm your site postcode and preferred date/time? A team member will review the requirements and prepare an indicative quotation.",
        "needs_human_review": True,
        "web_research": web_links
    }

def handle_customer_dialogue_turn(
    lead: dict,
    dialogue_history: List[Dict[str, str]],
    customer_reply: str
) -> Dict[str, Any]:
    """
    Evaluates customer's answer in a multi-turn clarification flow.
    Updates extracted facts, checks what is still needed, asks next question,
    or triggers web research and quotation readiness when complete.
    """
    if check_prompt_injection(customer_reply):
        return {
            "ai_response": "I detected an unusual instruction in your reply. A member of our operations team will review this enquiry manually.",
            "is_complete": False,
            "facts_update": {"prompt_injection_flagged": True},
            "missing_fields": ["manual_review_required"],
            "web_research": []
        }

    current_facts = json.loads(lead.get('facts_json') or '{}')
    current_address = lead.get('address') or ""
    all_text = " ".join([lead.get('message', '')] + [m.get('message', '') for m in dialogue_history] + [customer_reply]).lower()

    # Check for postcode / address in message or previous lead info
    found_postcode = extract_uk_postcode(customer_reply) or extract_uk_postcode(current_address) or extract_uk_postcode(lead.get('message', ''))
    if found_postcode:
        current_address = f"{current_address} {found_postcode}".strip() if current_address else customer_reply
        current_facts["postcode"] = found_postcode

    # Check for service type
    service_type = lead.get('service_type')
    if not service_type or service_type in ('Site inspection', 'Minor repair'):
        from app.services.web_search import detect_trade_category
        detected = detect_trade_category(all_text)
        if detected:
            service_type = detected

    # Check for preferred timing
    has_timing = bool(current_facts.get("preferred_timing"))
    if any(k in customer_reply.lower() for k in ["today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "next week", "morning", "afternoon", "asap", "am", "pm"]):
        current_facts["preferred_timing"] = customer_reply[:80]
        has_timing = True

    # Compute missing fields dynamically
    missing_fields = []
    if not found_postcode and not current_address:
        missing_fields.append("site_address_or_postcode")
    if not service_type:
        missing_fields.append("service_required")
    if not has_timing:
        missing_fields.append("preferred_timing")

    current_facts["dialogue_turns"] = len(dialogue_history) + 1
    current_facts["inferred_service"] = service_type

    # Determine next action
    if "site_address_or_postcode" in missing_fields:
        ai_reply = "Thank you. To check our engineering territory and travel schedule, could you please provide your site address and UK postcode?"
        is_complete = False
        web_links = []
    elif "service_required" in missing_fields:
        ai_reply = "Understood. Could you specify which service you require (e.g. initial site inspection, preventive maintenance, or minor repair)?"
        is_complete = False
        web_links = []
    elif "preferred_timing" in missing_fields:
        ai_reply = "Thank you for the address. Do you have a preferred date or time of day (e.g. morning, afternoon, or next week) for the visit?"
        is_complete = False
        web_links = []
    else:
        # All questions understood! Trigger web research and inform user case is sent to human review
        is_complete = True
        web_links = perform_service_web_research(service_type, all_text, current_address)
        ai_reply = (
            f"Thank you! I have gathered all your details for '{service_type or 'Site Inspection'}'. "
            "I have compiled the UK regulatory standards and pricing benchmarks, and prepared an indicative quotation. "
            "This case has now been sent to our human engineering team with the technical references. "
            "Our staff will review and edit the quote if needed, and confirm with you shortly."
        )

    return {
        "ai_response": ai_reply,
        "is_complete": is_complete,
        "service_type": service_type,
        "address": current_address,
        "facts_update": current_facts,
        "missing_fields": missing_fields,
        "web_research": web_links
    }
