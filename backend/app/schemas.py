from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MetricIn(BaseModel):
    cibil_score: int = Field(ge=300, le=900)
    monthly_income: float = Field(gt=0, description="Net in-hand monthly income, INR")
    total_emi: float = Field(ge=0, description="Total active monthly EMIs, INR")
    card_limit: float = Field(ge=0, description="Cumulative credit card limit, INR")
    card_balance: float = Field(ge=0, description="Current card balance used, INR")

    @model_validator(mode="after")
    def balance_within_limit(self):
        if self.card_balance > self.card_limit:
            raise ValueError("card_balance cannot exceed card_limit")
        return self


class MetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cibil_score: int
    monthly_income: float
    total_emi: float
    card_limit: float
    card_balance: float
    dti_ratio: float
    cur_ratio: float
    score_band: str
    score_delta: int | None
    created_at: datetime


# ---- AI advisory: this schema is also the tool schema enforced on the LLM ----
class Bottleneck(BaseModel):
    issue: str = Field(description="Short name, e.g. 'Credit utilization above 30%'")
    severity: Literal["high", "medium", "low"]
    detail: str = Field(description="One or two sentences with the user's actual numbers")


class RoadmapStep(BaseModel):
    step: int = Field(ge=1, le=5)
    title: str
    action: str = Field(description="Concrete action using Indian instruments/norms")
    timeline: str = Field(description="e.g. 'Within 7 days' or 'Next 30-45 days'")
    expected_impact: str


class Advisory(BaseModel):
    summary: str = Field(description="Max 3 sentences")
    bottlenecks: list[Bottleneck] = Field(min_length=1, max_length=5)
    roadmap: list[RoadmapStep] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def steps_sequenced(self):
        if [s.step for s in self.roadmap] != [1, 2, 3, 4, 5]:
            raise ValueError("roadmap steps must be numbered 1..5 in order")
        return self


class AdvisoryOut(Advisory):
    model_config = ConfigDict(from_attributes=True)
    id: int
    metric_id: int
    model_name: str
    created_at: datetime
