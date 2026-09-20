from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import math
import hmac
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ----------------------------------------------------------------------------
# Config (zero hardcoded secrets — everything from process env)
# ----------------------------------------------------------------------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_MINUTES = int(os.environ.get('ACCESS_TOKEN_MINUTES', '43200'))
OTP_PEPPER = os.environ['OTP_PEPPER']
MOCK_OTP = os.environ.get('MOCK_OTP', '1234')
APP_ENV = os.environ.get('APP_ENV', 'development')
WALLET_TARGET_LIMIT = float(os.environ.get('WALLET_TARGET_LIMIT', '10000'))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

users = db.users
otps = db.otps
wallets = db.wallets
transactions = db.transactions
scratch_cards = db.scratch_cards
b2b_master = db.b2b_master

app = FastAPI(title="CashPe API")
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cashpe")

# ----------------------------------------------------------------------------
# Cashback engine config — B2B net-margin (commission) per service type.
# Max cashback = 50% of net gross margin. Guarantees >= Re.1 (cashback for sure).
# ----------------------------------------------------------------------------
COMMISSION_RATES = {
    "mobile": 0.03,
    "dth": 0.04,
    "electricity": 0.015,
    "broadband": 0.05,
}

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def otp_digest(code: str) -> str:
    return hmac.new(OTP_PEPPER.encode(), code.encode(), hashlib.sha256).hexdigest()

def make_token(uid: str) -> str:
    t = now_utc()
    payload = {"sub": uid, "iat": t, "exp": t + timedelta(minutes=ACCESS_TOKEN_MINUTES), "typ": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def auth_error():
    return HTTPException(status_code=401, detail="Invalid or expired token",
                         headers={"WWW-Authenticate": "Bearer"})

async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds or creds.scheme.lower() != "bearer":
        raise auth_error()
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM],
                             options={"require": ["sub", "iat", "exp"]})
        uid = payload["sub"]
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise auth_error()
    user = await users.find_one({"id": uid})
    if not user:
        raise auth_error()
    return user

def public_user(user: dict) -> dict:
    return {"id": user["id"], "phone": user["phone"],
            "name": user.get("name"), "has_pin": bool(user.get("pin_hash"))}

async def get_or_create_wallet(uid: str) -> dict:
    w = await wallets.find_one({"user_id": uid})
    if not w:
        w = {"id": str(uuid.uuid4()), "user_id": uid, "balance": 0.0,
             "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
        await wallets.insert_one(w)
    return w

async def adjust_balance(uid: str, delta: float) -> float:
    w = await get_or_create_wallet(uid)
    new_balance = round(w["balance"] + delta, 2)
    await wallets.update_one({"user_id": uid},
                             {"$set": {"balance": new_balance, "updated_at": iso(now_utc())}})
    return new_balance

# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class PhoneIn(BaseModel):
    phone: str = Field(min_length=10, max_length=15)

class OTPIn(BaseModel):
    phone: str = Field(min_length=10, max_length=15)
    otp: str = Field(pattern=r"^\d{4}$")

class PinIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")

class NameIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)

class AddMoneyIn(BaseModel):
    amount: float = Field(gt=0, le=100000)

class BillFetchIn(BaseModel):
    service_type: str
    operator: str
    account: str = Field(min_length=3, max_length=40)

class PayIn(BaseModel):
    service_type: str
    operator: str
    account: str = Field(min_length=3, max_length=40)
    amount: float = Field(gt=0, le=100000)
    plan_label: Optional[str] = None
    payment_method: str = Field(default="cashfree")  # 'cashfree' | 'wallet'
    pin: Optional[str] = None
    validity_days: Optional[int] = None
    validity_label: Optional[str] = None

# ----------------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "CashPe API running", "status": "ok"}

# ----------------------------------------------------------------------------
# Auth — mobile OTP (simulated), JWT, bcrypt wallet PIN
# ----------------------------------------------------------------------------
@api_router.post("/auth/request-otp")
async def request_otp(body: PhoneIn):
    phone = body.phone.strip()
    if APP_ENV == "production":
        code = f"{random.randint(0, 9999):04d}"
    else:
        code = MOCK_OTP
    await otps.replace_one(
        {"phone": phone},
        {"phone": phone, "digest": otp_digest(code), "attempts": 0,
         "expires_at": iso(now_utc() + timedelta(minutes=5))},
        upsert=True)
    result = {"message": "OTP sent"}
    if APP_ENV != "production":
        result["preview_otp"] = code
    return result

@api_router.post("/auth/verify-otp")
async def verify_otp(body: OTPIn):
    phone = body.phone.strip()
    record = await otps.find_one({"phone": phone})
    if not record:
        raise HTTPException(400, "Please request an OTP first")
    expires = datetime.fromisoformat(record["expires_at"])
    if expires <= now_utc() or record.get("attempts", 0) >= 5:
        await otps.delete_one({"phone": phone})
        raise HTTPException(400, "OTP expired. Please request again.")
    if not hmac.compare_digest(record["digest"], otp_digest(body.otp)):
        await otps.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect OTP")
    await otps.delete_one({"phone": phone})

    user = await users.find_one({"phone": phone})
    is_new = False
    if not user:
        user = {"id": str(uuid.uuid4()), "phone": phone, "name": None,
                "pin_hash": None, "pin_failures": 0, "created_at": iso(now_utc())}
        await users.insert_one(user)
        await get_or_create_wallet(user["id"])
        is_new = True
    return {"token": make_token(user["id"]), "user": public_user(user), "is_new": is_new}

@api_router.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)

@api_router.post("/auth/profile")
async def set_profile(body: NameIn, user=Depends(current_user)):
    await users.update_one({"id": user["id"]}, {"$set": {"name": body.name.strip()}})
    updated = await users.find_one({"id": user["id"]})
    return public_user(updated)

@api_router.post("/auth/set-pin")
async def set_pin(body: PinIn, user=Depends(current_user)):
    hashed = bcrypt.hashpw(body.pin.encode(), bcrypt.gensalt(rounds=12)).decode()
    await users.update_one({"id": user["id"]}, {"$set": {"pin_hash": hashed, "pin_failures": 0}})
    return {"ok": True}

@api_router.post("/auth/verify-pin")
async def verify_pin(body: PinIn, user=Depends(current_user)):
    if user.get("pin_failures", 0) >= 5:
        raise HTTPException(429, "PIN locked. Try again later.")
    ok = bool(user.get("pin_hash")) and bcrypt.checkpw(body.pin.encode(), user["pin_hash"].encode())
    if not ok:
        await users.update_one({"id": user["id"]}, {"$inc": {"pin_failures": 1}})
        raise HTTPException(401, "Incorrect PIN")
    await users.update_one({"id": user["id"]}, {"$set": {"pin_failures": 0}})
    return {"ok": True}

# ----------------------------------------------------------------------------
# Wallet
# ----------------------------------------------------------------------------
@api_router.get("/wallet")
async def get_wallet(user=Depends(current_user)):
    w = await get_or_create_wallet(user["id"])
    return {"balance": w["balance"], "target_limit": WALLET_TARGET_LIMIT}

@api_router.post("/wallet/add")
async def add_money(body: AddMoneyIn, user=Depends(current_user)):
    # Simulated Cashfree add-money success (zero-trust in real life via webhook)
    new_balance = await adjust_balance(user["id"], body.amount)
    txn = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "type": "credit",
        "category": "add_money", "title": "Added to Wallet",
        "service_type": None, "operator": None, "account": None,
        "amount": round(body.amount, 2), "status": "success",
        "payment_method": "cashfree", "cashback": 0.0,
        "created_at": iso(now_utc()),
    }
    await transactions.insert_one(txn)
    txn.pop("_id", None)
    return {"balance": new_balance, "transaction": txn}

# ----------------------------------------------------------------------------
# Recharge / Bill payment + cashback engine
# ----------------------------------------------------------------------------
@api_router.post("/bill/fetch")
async def fetch_bill(body: BillFetchIn, user=Depends(current_user)):
    # Simulated BBPS bill fetch — deterministic-ish amount from account digits
    seed = sum(ord(c) for c in body.account)
    amount = 300 + (seed % 47) * 50  # ₹300 - ₹2600
    due = (now_utc() + timedelta(days=6)).date().isoformat()
    return {
        "operator": body.operator,
        "account": body.account,
        "consumer_name": (user.get("name") or "CashPe User"),
        "bill_amount": float(amount),
        "due_date": due,
        "bill_period": now_utc().strftime("%b %Y"),
    }

def compute_max_cashback(service_type: str, amount: float) -> int:
    rate = COMMISSION_RATES.get(service_type, 0.02)
    gross_margin = amount * rate
    max_cb = math.floor(gross_margin * 0.5)  # 50% net margin cap
    return max(1, max_cb)  # guaranteed cashback for sure

@api_router.post("/pay")
async def pay(body: PayIn, user=Depends(current_user)):
    if body.service_type not in COMMISSION_RATES:
        raise HTTPException(400, "Unsupported service")

    if body.payment_method == "wallet":
        if not user.get("pin_hash"):
            raise HTTPException(400, "Set a wallet PIN first")
        if not body.pin or not bcrypt.checkpw(body.pin.encode(), user["pin_hash"].encode()):
            await users.update_one({"id": user["id"]}, {"$inc": {"pin_failures": 1}})
            raise HTTPException(401, "Incorrect PIN")
        w = await get_or_create_wallet(user["id"])
        if w["balance"] < body.amount:
            raise HTTPException(400, "Insufficient wallet balance")
        await adjust_balance(user["id"], -body.amount)

    # Successful transaction (simulated B2B recharge success)
    txn_id = str(uuid.uuid4())
    label = body.plan_label or f"{body.operator} payment"
    expiry_date = None
    if body.validity_days and body.validity_days > 0:
        expiry_date = iso(now_utc() + timedelta(days=body.validity_days))
    txn = {
        "id": txn_id, "user_id": user["id"], "type": "debit",
        "category": body.service_type, "title": label,
        "service_type": body.service_type, "operator": body.operator,
        "account": body.account, "amount": round(body.amount, 2),
        "status": "success", "payment_method": body.payment_method,
        "cashback": 0.0, "created_at": iso(now_utc()),
        "expiry_date": expiry_date, "validity_label": body.validity_label,
        "reminder_dismissed": False,
    }
    await transactions.insert_one(txn)

    # Generate a guaranteed (unscratched) scratch card
    max_cb = compute_max_cashback(body.service_type, body.amount)
    reward = random.randint(1, max_cb)
    card = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "transaction_id": txn_id,
        "amount": reward, "max_amount": max_cb, "scratched": False,
        "operator": body.operator, "service_type": body.service_type,
        "created_at": iso(now_utc()), "scratched_at": None,
    }
    await scratch_cards.insert_one(card)

    # Refill B2B master wallet toward target after each txn (Option 2)
    await refill_b2b_master(body.amount)

    card.pop("_id", None)
    txn.pop("_id", None)
    return {"transaction": txn, "scratch_card_id": card["id"]}

@api_router.get("/transactions")
async def list_transactions(user=Depends(current_user)):
    cursor = transactions.find({"user_id": user["id"]}).sort("created_at", -1).limit(200)
    items = await cursor.to_list(200)
    for it in items:
        it.pop("_id", None)
    return items

# ----------------------------------------------------------------------------
# Recharge / bill expiry reminders (in-app alerts)
# ----------------------------------------------------------------------------
@api_router.get("/reminders")
async def get_reminders(user=Depends(current_user)):
    cursor = transactions.find({
        "user_id": user["id"],
        "type": "debit",
        "expiry_date": {"$ne": None},
        "reminder_dismissed": {"$ne": True},
    }).sort("created_at", -1)
    items = await cursor.to_list(500)
    today = now_utc().date()
    seen = set()
    result = []
    for it in items:
        if not it.get("expiry_date"):
            continue
        key = (it.get("service_type"), it.get("account"))
        if key in seen:
            continue
        seen.add(key)
        exp = datetime.fromisoformat(it["expiry_date"]).date()
        days_left = (exp - today).days
        if days_left < 0:
            status = "expired"
        elif days_left == 0:
            status = "today"
        elif days_left <= 3:
            status = "expiring"
        else:
            status = "upcoming"
        result.append({
            "id": it["id"],
            "service_type": it.get("service_type"),
            "operator": it.get("operator"),
            "account": it.get("account"),
            "amount": it.get("amount"),
            "expiry_date": it["expiry_date"],
            "days_left": days_left,
            "status": status,
            "validity_label": it.get("validity_label"),
            "title": it.get("title"),
        })
    result.sort(key=lambda r: r["expiry_date"])
    return result

@api_router.post("/reminders/{txn_id}/dismiss")
async def dismiss_reminder(txn_id: str, user=Depends(current_user)):
    res = await transactions.update_one(
        {"id": txn_id, "user_id": user["id"]},
        {"$set": {"reminder_dismissed": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Reminder not found")
    return {"ok": True}

# ----------------------------------------------------------------------------
# Scratch cards
# ----------------------------------------------------------------------------
@api_router.get("/scratchcards")
async def list_scratch_cards(user=Depends(current_user)):
    cursor = scratch_cards.find({"user_id": user["id"]}).sort("created_at", -1).limit(200)
    items = await cursor.to_list(200)
    result = []
    for it in items:
        it.pop("_id", None)
        # hide reward amount for unscratched cards
        if not it["scratched"]:
            it_public = {**it, "amount": None}
            result.append(it_public)
        else:
            result.append(it)
    return result

@api_router.get("/scratchcards/{card_id}")
async def get_scratch_card(card_id: str, user=Depends(current_user)):
    card = await scratch_cards.find_one({"id": card_id, "user_id": user["id"]})
    if not card:
        raise HTTPException(404, "Card not found")
    card.pop("_id", None)
    if not card["scratched"]:
        return {**card, "amount": None}
    return card

@api_router.post("/scratchcards/{card_id}/scratch")
async def scratch_card(card_id: str, user=Depends(current_user)):
    card = await scratch_cards.find_one({"id": card_id, "user_id": user["id"]})
    if not card:
        raise HTTPException(404, "Card not found")
    if card["scratched"]:
        return {"amount": card["amount"], "already": True}
    # Credit cashback to wallet
    new_balance = await adjust_balance(user["id"], card["amount"])
    await scratch_cards.update_one({"id": card_id},
                                   {"$set": {"scratched": True, "scratched_at": iso(now_utc())}})
    cb_txn = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "type": "credit",
        "category": "cashback", "title": "Scratch Card Cashback",
        "service_type": card.get("service_type"), "operator": card.get("operator"),
        "account": None, "amount": float(card["amount"]), "status": "success",
        "payment_method": "cashback", "cashback": float(card["amount"]),
        "created_at": iso(now_utc()),
    }
    await transactions.insert_one(cb_txn)
    return {"amount": card["amount"], "balance": new_balance, "already": False}

# ----------------------------------------------------------------------------
# B2B Wallet Refill Automation Engine (Option 2 — Refill to Target Limit)
# ----------------------------------------------------------------------------
async def get_b2b_master() -> dict:
    m = await b2b_master.find_one({"id": "master"})
    if not m:
        m = {"id": "master", "balance": WALLET_TARGET_LIMIT, "target_limit": WALLET_TARGET_LIMIT,
             "last_refill": None, "total_refilled": 0.0, "updated_at": iso(now_utc())}
        await b2b_master.insert_one(m)
    return m

async def refill_b2b_master(spent: float):
    """After each txn the B2B API balance drops by `spent`. Compute the exact
    deficit vs the target and trigger an auto top-up (via VAN/Auto-Payout) for
    the EXACT deficit so balance is restored to target without over-funding."""
    m = await get_b2b_master()
    balance = m["balance"] - spent
    target = m["target_limit"]
    deficit = round(target - balance, 2)
    refilled = 0.0
    if deficit > 0:
        balance = round(balance + deficit, 2)  # simulated VAN auto-payout
        refilled = deficit
    await b2b_master.update_one({"id": "master"}, {"$set": {
        "balance": balance,
        "last_refill": iso(now_utc()) if refilled else m.get("last_refill"),
        "total_refilled": round(m.get("total_refilled", 0.0) + refilled, 2),
        "updated_at": iso(now_utc()),
    }})

@api_router.get("/b2b/master")
async def b2b_master_status(user=Depends(current_user)):
    m = await get_b2b_master()
    m.pop("_id", None)
    return m

# ----------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
# ==========================================
# Pay2all Wallet Auto-Top-Up & Target Limit Logic
# ==========================================

async def get_pay2all_balance():
    # Mee Pay2all wallet current balance ni check chese API call ikkada untundi
    current_balance = 5000.0  
    return current_balance

async def cashfree_payout_to_pay2all_van(amount):
    # Cashfree Payouts dwara Pay2all Virtual Account (VAN) ki amount transfer chese logic
    print(f"Transferring ₹{amount} to Pay2all VAN via Cashfree Payouts...")
    return True

async def check_and_auto_top_up_pay2all(transaction_amount: float):
    """
    Wallet Target Limit: ₹10,000
    Ee logic prakaram, Pay2all wallet balance ₹10,000 (Target Limit) kante 
    leduda transaction amount kante thakkuvaga unte automatic ga top-up avtundi.
    """
    TARGET_LIMIT = 10000.0
    current_pay2all_balance = await get_pay2all_balance()

    if current_pay2all_balance < TARGET_LIMIT or current_pay2all_balance < transaction_amount:
        top_up_amount = TARGET_LIMIT - current_pay2all_balance
        
        if top_up_amount > 0:
            print(f"Pay2all balance is below target limit. Triggering auto-top-up...")
            await cashfree_payout_to_pay2all_van(top_up_amount)


# ==========================================
# Bill Payment Route Integration Example
# ==========================================

@app.post("/api/bill/pay")
async def process_bill_payment(request_data: dict):
    try:
        amount = float(request_data.get("amount", 0))
        
        # 👇 Customer payment chese mundu wallet target limit & auto-top-up check avtundi
        await check_and_auto_top_up_pay2all(amount)

        # Mee regular Pay2all / BBPS bill payment process ikkada continue avtundi
        return {
            "success": True, 
            "message": "Bill payment processed and wallet auto-top-up checked successfully!"
        }

    except Exception as error:
        return {"success": False, "error": str(error)}
