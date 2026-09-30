"""AI advisory service. Schema enforcement is two-layered:
1) the model is forced to call a tool whose input_schema is the Pydantic `Advisory` schema;
2) the tool input is re-validated with Pydantic, retrying once on failure."""
from anthropic import Anthropic
from pydantic import ValidationError

from .config import settings
from .metrics import CUR_TARGET, DTI_TARGET
from .models import FinancialMetric
from .schemas import Advisory

SYSTEM_PROMPT = """You are a senior credit counsellor for retail borrowers in India (BFSI sector).
Ground every recommendation in Indian practice: CIBIL (TransUnion CIBIL) scoring bands, RBI guidelines,
e-NACH/auto-debit mandates, credit limit enhancement requests that use existing relationship data
(no hard inquiry), FD-backed secured credit cards (e.g. IDFC FIRST WOW, OneCard FD-backed variant),
paying card dues before the statement date to lower the reported balance, and not closing old cards.
Bureau updates depend on lender reporting and statement cycles: tell the user to expect changes
in roughly 30-45 days (RBI requires at least fortnightly reporting, but visible movement lags).
Rules: use INR with the Indian digit grouping (e.g. Rs 1,25,000); cite the user's real numbers;
never promise a specific score; never recommend new unsecured credit applications while
utilization or DTI is above target; recommend avoiding multiple hard inquiries.
This is educational guidance, not regulated financial advice."""


class AdvisoryError(Exception):
    pass


def _inr(x: float) -> str:
    s = f"{int(round(x))}"
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return f"Rs {s}"


def build_prompt(m: FinancialMetric, prev_score: int | None) -> str:
    delta = f"{m.cibil_score - prev_score:+d} vs previous entry ({prev_score})" if prev_score else "first entry"
    return f"""Borrower snapshot:
- CIBIL score: {m.cibil_score} ({m.score_band}); change: {delta}
- Monthly net in-hand income: {_inr(m.monthly_income)}
- Total active monthly EMIs: {_inr(m.total_emi)}
- Debt-to-Income (DTI): {m.dti_ratio}% (target < {DTI_TARGET:.0f}%)
- Credit card limit: {_inr(m.card_limit)}; balance used: {_inr(m.card_balance)}
- Credit Utilization Ratio (CUR): {m.cur_ratio}% (target < {CUR_TARGET:.0f}%)

Identify the real bottlenecks (only ones supported by the numbers) and give a sequenced
5-step roadmap, ordered by speed and impact. Submit it via the submit_advisory tool."""


def generate_advisory(m: FinancialMetric, prev_score: int | None) -> Advisory:
    if not settings.anthropic_api_key:
        raise AdvisoryError("ANTHROPIC_API_KEY is not configured")
    client = Anthropic(api_key=settings.anthropic_api_key)
    tool = {
        "name": "submit_advisory",
        "description": "Submit the structured credit health advisory.",
        "input_schema": Advisory.model_json_schema(),
    }
    last: Exception | None = None
    for _ in range(2):
        resp = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            tools=[tool],
            tool_choice={"type": "tool", "name": "submit_advisory"},
            messages=[{"role": "user", "content": build_prompt(m, prev_score)}],
        )
        block = next((b for b in resp.content if b.type == "tool_use"), None)
        try:
            return Advisory.model_validate(block.input)
        except (ValidationError, AttributeError) as e:
            last = e
    raise AdvisoryError(f"Model output failed schema validation: {last}")
