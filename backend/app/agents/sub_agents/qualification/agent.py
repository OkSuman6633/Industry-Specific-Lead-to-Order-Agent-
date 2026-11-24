from google.adk.agents import Agent
from app.core.config import settings
from app.agents.shared_libraries.prompts import QUALIFICATION_INSTRUCTION

root_agent = Agent(
    name="lead_qualification_agent",
    model=settings.gemini_model,
    description="Extracts structured facts and missing requirements from a service enquiry.",
    instruction=QUALIFICATION_INSTRUCTION,
    output_key="qualification_result",
)
