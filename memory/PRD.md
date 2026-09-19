# CashPe — Product Requirements Document

## Original Problem Statement
Build "CashPe" — an All-India mobile-first multi-utility Recharge, Electricity (BBPS), Broadband, DTH, and instant cashback app. Secure fintech workflows: mobile OTP login, JWT, bcrypt 4-digit wallet PIN, guaranteed loss-proof scratch-card cashback (50% net-margin cap), in-app wallet, B2B wallet refill-to-target automation, and simulated Cashfree payment settlement.

## Tech Stack (as delivered on Emergent)
- **Frontend:** Expo (React Native) + expo-router, react-query, reanimated, gesture-handler, phosphor icons, expo-linear-gradient. (Native Android app — not a PWA.)
- **Backend:** FastAPI + Motor (MongoDB), PyJWT, bcrypt.
- **DB:** MongoDB (users, otps, wallets, transactions, scratch_cards, b2b_master).

## User Choices
- Payment (Cashfree) & B2B recharge/BBPS: **Demo/simulation mode** (plug real keys later).
- Login: **Mobile OTP** (OTP simulated = 1234 in preview).
- Services: **all** (mobile, DTH, electricity, broadband).
- Must-haves: scratch-card cashback + wallet, transaction history, 4-digit PIN.
- Design: simple, bright, attractive; "cashback for sure" shown pictorially. Emerald + Amber theme.

## User Personas
- **Retail user:** recharges mobile/DTH, pays electricity/broadband bills, wins guaranteed cashback, manages wallet.
- **Owner/operator (view):** monitors B2B master working-capital float that auto-refills to target.

## Core Requirements (static)
1. OTP login + JWT + bcrypt 4-digit wallet PIN (lock after 5 fails).
2. Services: mobile, DTH, electricity, broadband with operator/biller catalog.
3. BBPS bill fetch (simulated) for electricity/broadband.
4. Payment via simulated Cashfree or CashPe wallet (wallet requires PIN).
5. Guaranteed scratch-card cashback = random(1 .. floor(amount * commission * 0.5)), min ₹1.
6. In-app wallet: balance, add money, transaction ledger with filters.
7. B2B master wallet refill-to-target automation after every transaction.

## Implemented (2026-06)
- [x] Backend auth: request-otp, verify-otp (auto-register), set-pin, verify-pin, me, profile.
- [x] Wallet: get, add money (simulated Cashfree credit).
- [x] Recharge/bill: /bill/fetch, /pay (cashfree + wallet w/ PIN), cashback engine (50% cap).
- [x] Scratch cards: list (amount hidden until scratched), scratch (idempotent credit-once).
- [x] Transactions ledger; B2B master refill-to-target engine + /b2b/master status.
- [x] Frontend: Login (OTP), PIN setup, Home dashboard (wallet hero + services grid + cashback banner + recent activity + pending cards), Service flow (operator → account → plan/bill → method → pay), Scratch reveal modal (tap/swipe + confetti), Wallet (add money modal + filter chips + ledger), Rewards grid, Profile (B2B float + logout).
- [x] Backend tested 19/19 pytest PASS. Frontend E2E verified: login→pin→home→recharge→pay→scratch→credit; add money; bill fetch; wallet-PIN guard; DTH; tabs.

## Backlog / Remaining
- **P1:** Real Cashfree PG integration (order + webhook signature verification) once keys provided.
- **P1:** Real B2B recharge/BBPS provider (Cyrus/Pay2All/Setu) once keys provided; VAN auto-payout for refill.
- **P1:** Real SMS OTP provider (replace preview_otp) for production.
- **P2:** Plan browsing by circle/operator from a live plans API; recent recharges/quick-repeat.
- **P2:** Change-PIN & forgot-PIN flows; biometric unlock.
- **P2:** Referral/offers, transaction receipts/sharing, dark mode.

## Next Tasks
1. Await user's Cashfree + B2B provider keys → route through integration_expert for production integration.
2. Add quick-repeat / saved billers for faster repeat payments.
