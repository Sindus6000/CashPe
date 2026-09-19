"""CashPe backend integration tests — covers auth, wallet, recharge/bill,
scratch cards, transactions, B2B master, and JWT protection."""
import os
import random
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cashpe-fintech.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _phone():
    # unique per test to avoid state collisions
    return f"90{random.randint(10000000, 99999999)}"


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    ss.headers.update({"Content-Type": "application/json"})
    return ss


@pytest.fixture(scope="module")
def auth(s):
    """Provision a fresh authenticated user with wallet + PIN=4321."""
    phone = _phone()
    r = s.post(f"{API}/auth/request-otp", json={"phone": phone})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("preview_otp") == "1234"

    r = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "1234"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    assert r.json()["is_new"] is True

    h = {"Authorization": f"Bearer {token}"}

    r = s.post(f"{API}/auth/set-pin", json={"pin": "4321"}, headers=h)
    assert r.status_code == 200, r.text

    return {"phone": phone, "token": token, "headers": h}


# ---------- Health ----------
def test_health(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Auth: OTP flows ----------
def test_request_otp_preview(s):
    r = s.post(f"{API}/auth/request-otp", json={"phone": _phone()})
    assert r.status_code == 200
    assert r.json().get("preview_otp") == "1234"


def test_verify_otp_wrong_rejected(s):
    phone = _phone()
    s.post(f"{API}/auth/request-otp", json={"phone": phone})
    r = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "0000"})
    assert r.status_code == 400
    assert "otp" in r.text.lower() or "incorrect" in r.text.lower()


def test_verify_otp_reused_rejected(s):
    phone = _phone()
    s.post(f"{API}/auth/request-otp", json={"phone": phone})
    r1 = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "1234"})
    assert r1.status_code == 200
    r2 = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "1234"})
    assert r2.status_code == 400  # OTP already consumed


# ---------- Auth: PIN flows ----------
def test_set_and_verify_pin_ok(s, auth):
    r = s.post(f"{API}/auth/verify-pin", json={"pin": "4321"}, headers=auth["headers"])
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_wrong_pin_rejected_and_lock_after_5(s):
    # separate user to burn 5 failures without polluting main user
    phone = _phone()
    s.post(f"{API}/auth/request-otp", json={"phone": phone})
    tok = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "1234"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    s.post(f"{API}/auth/set-pin", json={"pin": "4321"}, headers=h)

    for _ in range(5):
        r = s.post(f"{API}/auth/verify-pin", json={"pin": "0000"}, headers=h)
        assert r.status_code == 401
    # 6th attempt should hit lock (429)
    r = s.post(f"{API}/auth/verify-pin", json={"pin": "4321"}, headers=h)
    assert r.status_code == 429, r.text


# ---------- Me ----------
def test_me_has_pin(s, auth):
    r = s.get(f"{API}/me", headers=auth["headers"])
    assert r.status_code == 200
    data = r.json()
    assert data["phone"] == auth["phone"]
    assert data["has_pin"] is True


# ---------- Wallet ----------
def test_wallet_initial(s, auth):
    r = s.get(f"{API}/wallet", headers=auth["headers"])
    assert r.status_code == 200
    body = r.json()
    assert "balance" in body and "target_limit" in body


def test_wallet_add_money(s, auth):
    r0 = s.get(f"{API}/wallet", headers=auth["headers"]).json()
    r = s.post(f"{API}/wallet/add", json={"amount": 500}, headers=auth["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["balance"] == round(r0["balance"] + 500, 2)
    txn = body["transaction"]
    assert txn["type"] == "credit" and txn["category"] == "add_money"
    # verify persistence via GET
    r1 = s.get(f"{API}/wallet", headers=auth["headers"]).json()
    assert r1["balance"] == body["balance"]


# ---------- Bill fetch ----------
def test_bill_fetch(s, auth):
    r = s.post(f"{API}/bill/fetch",
               json={"service_type": "electricity", "operator": "BSES Rajdhani", "account": "1234567890"},
               headers=auth["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["bill_amount"] > 0
    assert "due_date" in body and "consumer_name" in body


# ---------- Pay: cashfree ----------
def test_pay_cashfree_creates_scratch_card(s, auth):
    r = s.post(f"{API}/pay",
               json={"service_type": "mobile", "operator": "Jio", "account": "9998887770",
                     "amount": 299, "plan_label": "Jio 299 28d",
                     "payment_method": "cashfree"},
               headers=auth["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["transaction"]["type"] == "debit"
    assert body["scratch_card_id"]

    # Cashback within 50% net-margin cap: mobile 3% -> max floor(299*0.03*0.5)=4, min 1
    card = s.get(f"{API}/scratchcards/{body['scratch_card_id']}", headers=auth["headers"]).json()
    assert card["amount"] is None  # hidden until scratched
    assert 1 <= card["max_amount"] <= 4


# ---------- Pay: wallet + PIN ----------
def test_pay_wallet_wrong_pin_rejected(s, auth):
    r = s.post(f"{API}/pay",
               json={"service_type": "mobile", "operator": "Airtel", "account": "9998887770",
                     "amount": 10, "payment_method": "wallet", "pin": "0000"},
               headers=auth["headers"])
    assert r.status_code == 401


def test_pay_wallet_insufficient_balance(s):
    # Fresh user with PIN but empty wallet
    phone = _phone()
    ss = requests.Session()
    ss.post(f"{API}/auth/request-otp", json={"phone": phone})
    tok = ss.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "1234"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    ss.post(f"{API}/auth/set-pin", json={"pin": "4321"}, headers=h)
    r = ss.post(f"{API}/pay",
                json={"service_type": "mobile", "operator": "Jio", "account": "9998887770",
                      "amount": 500, "payment_method": "wallet", "pin": "4321"},
                headers=h)
    assert r.status_code == 400
    assert "insufficient" in r.text.lower()


def test_pay_wallet_success_deducts(s, auth):
    # Ensure enough balance
    s.post(f"{API}/wallet/add", json={"amount": 1000}, headers=auth["headers"])
    before = s.get(f"{API}/wallet", headers=auth["headers"]).json()["balance"]
    r = s.post(f"{API}/pay",
               json={"service_type": "broadband", "operator": "ACT", "account": "acct1",
                     "amount": 200, "payment_method": "wallet", "pin": "4321"},
               headers=auth["headers"])
    assert r.status_code == 200, r.text
    after = s.get(f"{API}/wallet", headers=auth["headers"]).json()["balance"]
    assert round(before - after, 2) == 200.0


# ---------- Scratch cards ----------
def test_scratch_hides_amount_and_credits_once(s, auth):
    # create a card
    pay = s.post(f"{API}/pay",
                 json={"service_type": "dth", "operator": "Tata Play", "account": "1234567890",
                       "amount": 400, "payment_method": "cashfree"},
                 headers=auth["headers"]).json()
    cid = pay["scratch_card_id"]

    # list hides amount
    lst = s.get(f"{API}/scratchcards", headers=auth["headers"]).json()
    target = next(c for c in lst if c["id"] == cid)
    assert target["amount"] is None
    assert target["scratched"] is False

    bal_before = s.get(f"{API}/wallet", headers=auth["headers"]).json()["balance"]

    r1 = s.post(f"{API}/scratchcards/{cid}/scratch", headers=auth["headers"])
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["amount"] >= 1 and j1["already"] is False
    assert round(j1["balance"] - bal_before, 2) == float(j1["amount"])

    # idempotency
    r2 = s.post(f"{API}/scratchcards/{cid}/scratch", headers=auth["headers"])
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["already"] is True
    assert j2["amount"] == j1["amount"]

    bal_after = s.get(f"{API}/wallet", headers=auth["headers"]).json()["balance"]
    assert round(bal_after - bal_before, 2) == float(j1["amount"])  # credited exactly once


# ---------- Transactions ----------
def test_transactions_sorted_desc(s, auth):
    r = s.get(f"{API}/transactions", headers=auth["headers"])
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    ts = [it["created_at"] for it in items]
    assert ts == sorted(ts, reverse=True)


# ---------- B2B master ----------
def test_b2b_master_refill_to_target(s, auth):
    m0 = s.get(f"{API}/b2b/master", headers=auth["headers"]).json()
    target = m0["target_limit"]
    # Perform a payment then observe refill
    s.post(f"{API}/pay",
           json={"service_type": "mobile", "operator": "Vi", "account": "9998887770",
                 "amount": 149, "payment_method": "cashfree"},
           headers=auth["headers"])
    m1 = s.get(f"{API}/b2b/master", headers=auth["headers"]).json()
    assert m1["balance"] == target  # restored to target
    assert m1["total_refilled"] >= m0.get("total_refilled", 0)


# ---------- Auth protection ----------
def test_protected_missing_token(s):
    r = s.get(f"{API}/wallet")
    assert r.status_code in (401, 403)


def test_protected_bad_token(s):
    r = s.get(f"{API}/wallet", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401
