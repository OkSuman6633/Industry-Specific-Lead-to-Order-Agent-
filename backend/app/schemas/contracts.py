from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=100)
    company_name: Optional[str] = None

class LeadIn(BaseModel):
    channel: str = "website"
    external_ref: Optional[str] = None
    customer_name: str = Field(min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    message: str = Field(min_length=3, max_length=5000)
    consent: bool
    address: Optional[str] = None
    idempotency_key: Optional[str] = None

class LeadUpdateIn(BaseModel):
    customer_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    message: Optional[str] = None
    notes: Optional[str] = None

class LeadMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    sender: str = "customer"

class ServiceIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    base_price: float = Field(ge=0)
    vat_rate: float = Field(default=20.0, ge=0, le=100)
    active: bool = True

class TerritoryIn(BaseModel):
    postcode_prefix: str = Field(min_length=1, max_length=10)
    active: bool = True

class QuoteIn(BaseModel):
    service_id: str
    quantity: int = Field(default=1, ge=1, le=100)
    notes: str = ""
    is_vat_exempt: bool = False
    custom_exclusions: list[str] = []

class QuoteLineItemIn(BaseModel):
    service_id: Optional[str] = None
    service: str
    quantity: int = Field(default=1, ge=1, le=100)
    unit_price: float = Field(ge=0)
    vat_rate: float = Field(default=20.0, ge=0, le=100)
    line_total: Optional[float] = None
    notes: Optional[str] = ""

class QuoteUpdateIn(BaseModel):
    line_items: list[QuoteLineItemIn]
    notes: Optional[str] = ""
    exclusions: Optional[list[str]] = None
    is_vat_exempt: Optional[bool] = None

class ApproveIn(BaseModel):
    expected_version: Optional[int] = None
    expected_generation: Optional[int] = None

class RejectQuoteIn(BaseModel):
    reason: str = "Scope revision requested or customer declined"

class SendQuoteIn(BaseModel):
    channel: str = "website"
    simulate_failure: bool = False

class AcceptQuoteIn(BaseModel):
    notes: Optional[str] = ""

class ScheduleIn(BaseModel):
    scheduled_time: str
    timezone: str = "Europe/London"
    technician_name: Optional[str] = "Assigned Field Engineer"
    notes: Optional[str] = ""

class SettingIn(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    value: Any

class WhatsAppWebhookPayload(BaseModel):
    object: Optional[str] = None
    entry: Optional[list[dict[str, Any]]] = None
    provider_event_id: Optional[str] = None
    sender_phone: Optional[str] = None
    sender_name: Optional[str] = None
    message: Optional[str] = None
    consent: Optional[bool] = True

class QualificationOut(BaseModel):
    category: str
    urgency: str
    service_type: Optional[str] = None
    facts: dict[str, Any] = {}
    missing_fields: list[str] = []
    confidence: float = 0.0
    confidence_reason: str = ""
    customer_reply_draft: str = ""
    needs_human_review: bool = True
