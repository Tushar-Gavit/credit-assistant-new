from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .ai_service import AdvisoryError, generate_advisory
from .config import settings
from .database import get_db
from .metrics import compute_cur, compute_dti, score_band
from .models import AIAdvisory, FinancialMetric, User
from .schemas import AdvisoryOut, LoginIn, MetricIn, MetricOut, RegisterIn, TokenOut, UserOut
from .security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api")


def _latest(db: Session, user_id: int, offset: int = 0) -> FinancialMetric | None:
    return db.scalar(
        select(FinancialMetric)
        .where(FinancialMetric.user_id == user_id)
        .order_by(desc(FinancialMetric.created_at), desc(FinancialMetric.id))
        .offset(offset)
        .limit(1)
    )


# ---------- Auth ----------
@router.post("/auth/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    user = User(name=body.name.strip(), email=email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    return TokenOut(access_token=create_token(user.id), user=user)


@router.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    return TokenOut(access_token=create_token(user.id), user=user)


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


# ---------- Metrics (Scenarios 1 & 4) ----------
@router.post("/metrics", response_model=MetricOut, status_code=201)
def add_metric(body: MetricIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    prev = _latest(db, user.id)
    entry = FinancialMetric(
        user_id=user.id,
        **body.model_dump(),
        dti_ratio=compute_dti(body.monthly_income, body.total_emi),
        cur_ratio=compute_cur(body.card_limit, body.card_balance),
        score_band=score_band(body.cibil_score),
        score_delta=(body.cibil_score - prev.cibil_score) if prev else None,
    )
    db.add(entry)
    db.commit()
    return entry


@router.get("/metrics", response_model=list[MetricOut])
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(FinancialMetric).where(FinancialMetric.user_id == user.id).order_by(FinancialMetric.created_at, FinancialMetric.id)
    )
    return list(rows)


@router.get("/metrics/latest", response_model=MetricOut)
def latest_metric(user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = _latest(db, user.id)
    if not m:
        raise HTTPException(404, "No financial entries yet")
    return m


# ---------- AI advisory (Scenario 2) ----------
def _advisory_out(a: AIAdvisory) -> AdvisoryOut:
    return AdvisoryOut.model_validate(a)


@router.post("/advisory", response_model=AdvisoryOut, status_code=201)
def create_advisory(user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = _latest(db, user.id)
    if not m:
        raise HTTPException(404, "Add your financial details first")
    prev = _latest(db, user.id, offset=1)
    try:
        adv = generate_advisory(m, prev.cibil_score if prev else None)
    except AdvisoryError as e:
        raise HTTPException(502, str(e))
    row = AIAdvisory(
        user_id=user.id,
        metric_id=m.id,
        summary=adv.summary,
        bottlenecks=[b.model_dump() for b in adv.bottlenecks],
        roadmap=[s.model_dump() for s in adv.roadmap],
        model_name=settings.anthropic_model,
    )
    db.add(row)
    db.commit()
    return _advisory_out(row)


@router.get("/advisory/latest", response_model=AdvisoryOut)
def latest_advisory(user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.scalar(select(AIAdvisory).where(AIAdvisory.user_id == user.id).order_by(desc(AIAdvisory.created_at), desc(AIAdvisory.id)).limit(1))
    if not a:
        raise HTTPException(404, "No advisory generated yet")
    return _advisory_out(a)
