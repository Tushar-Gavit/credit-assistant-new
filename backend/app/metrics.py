DTI_TARGET = 35.0
CUR_TARGET = 30.0


def compute_dti(income: float, emi: float) -> float:
    return round(emi / income * 100, 2) if income > 0 else 0.0


def compute_cur(limit: float, balance: float) -> float:
    return round(balance / limit * 100, 2) if limit > 0 else 0.0


def score_band(score: int) -> str:
    if score >= 750:
        return "Excellent"
    if score >= 700:
        return "Good"
    if score >= 650:
        return "Fair"
    return "Needs Attention"
