from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    metrics: Mapped[list["FinancialMetric"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    advisories: Mapped[list["AIAdvisory"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class FinancialMetric(Base):
    __tablename__ = "financial_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cibil_score: Mapped[int] = mapped_column(Integer)
    monthly_income: Mapped[float] = mapped_column(Float)   # net in-hand, INR
    total_emi: Mapped[float] = mapped_column(Float)        # active monthly EMIs, INR
    card_limit: Mapped[float] = mapped_column(Float)       # cumulative credit card limit, INR
    card_balance: Mapped[float] = mapped_column(Float)     # current card outstanding, INR
    dti_ratio: Mapped[float] = mapped_column(Float)        # percent
    cur_ratio: Mapped[float] = mapped_column(Float)        # percent
    score_band: Mapped[str] = mapped_column(String(32))
    score_delta: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped[User] = relationship(back_populates="metrics")


class AIAdvisory(Base):
    __tablename__ = "ai_advisories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    metric_id: Mapped[int] = mapped_column(ForeignKey("financial_metrics.id", ondelete="CASCADE"))
    summary: Mapped[str] = mapped_column(Text)
    bottlenecks: Mapped[list] = mapped_column(JSON)
    roadmap: Mapped[list] = mapped_column(JSON)
    model_name: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="advisories")
