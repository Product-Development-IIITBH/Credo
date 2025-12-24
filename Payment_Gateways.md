# Payment Gateways – Secrets & Integration Reference

> **Purpose**
> This document is a **developer & operations reference** for how each payment gateway
> (UCO, Canara, SBI) works in **SAPv2 + Credo architecture**, including:
>
> - Required secrets / environment variables
> - How requests are created
> - How callbacks & verification work
> - What is trusted vs not trusted
> - A **Console Gateway** for local/dev environments
>
> **Audience**: Backend developers, DevOps, reviewers, auditors

---

## 1. Common Rules (All Gateways)

These rules apply **universally**:

1. **SAPv2 is the public callback endpoint**
2. **Credo performs decryption + verification**
3. **Business logic never runs in Credo**
4. **merchantOrderNo is the primary anchor**
5. **Gateway callbacks are never trusted directly**
6. **Requery / verification is the source of truth**

---

## 2. Gateway Comparison (Quick View)

| Gateway           | Redirect | Callback Trust | Verification        | Crypto         |
| ----------------- | -------- | -------------- | ------------------- | -------------- |
| UCO (Getepay)     | Yes      | ❌ No          | Mandatory Requery   | AES (Key + IV) |
| SBI ePay          | Yes      | ❌ No          | Double Verification | Symmetric      |
| Canara (BillDesk) | Yes      | ⚠️ Partial     | Status + Signature  | JWS (HMAC)     |
| Console (Dev)     | No       | ✅ Yes         | None                | None           |

---

## 3. UCO Bank (Getepay)

### 3.1 Required Secrets (Environment Variables)

```env
UCO_MID=
UCO_TERMINAL_ID=
UCO_EPAY_KEY=
UCO_EPAY_IV=
UCO_PAYMENT_URL=
UCO_CALLBACK_URL=
UCO_REQUERY_URL=
```

### 3.2 How UCO Works (Flow)

```
SAPv2 → Credo → UCO Gateway
                    ↓
               Bank Page
                    ↓
              Callback → SAPv2 → Credo
                    ↓
                Requery API
```

### 3.3 Important Fields Mapping

| Concept         | UCO Field                |
| --------------- | ------------------------ |
| merchantOrderNo | merchantTransactionId    |
| refno           | getepayTxnId / paymentId |
| status          | paymentStatus            |

### 3.4 Verification Rules

- ❌ Do NOT trust callback payload
- ✅ Always call **UCO Requery API**
- ✅ Requery response = final truth
- ❌ refno may be missing for failed payments

---

## 4. SBI ePay (eSBI)

### 4.1 Required Secrets

```env
SBI_MERCHANT_ID=
SBI_ARRAY_KEY=
SBI_PAYMENT_URL=
SBI_SUCCESS_URL=
SBI_FAILURE_URL=
SBI_DOUBLE_VERIFICATION_URL=
SBI_AGGREGATOR_ID=
```

### 4.2 How SBI Works (Flow)

```
SAPv2 → Credo → SBI (Encrypted Form Post)
                       ↓
                    Bank Page
                       ↓
      success/failure/push → SAPv2 → Credo
                       ↓
              Double Verification API
```

### 4.3 Important Fields Mapping

| Concept         | SBI Field          |
| --------------- | ------------------ |
| merchantOrderNo | MerchantOrderNo    |
| refno           | SBIePayReferenceID |
| status          | Status             |

### 4.4 Verification Rules (CRITICAL)

- ❌ Never trust success callback alone
- ❌ Never trust failure callback alone
- ❌ Never trust push notification alone
- ✅ **Double Verification API is mandatory**
- ❌ refno may repeat across retries

---

## 5. Canara Bank (BillDesk)

### 5.1 Required Secrets

```env
CANARA_MERCHANT_ID=
CANARA_SECRET_KEY=
CANARA_CLIENT_ID=
CANARA_PAYMENT_URL=
CANARA_CALLBACK_URL=
CANARA_REVERIFICATION_URL=
```

### 5.2 How Canara Works (Flow)

```
SAPv2 → Credo → Canara (JWS Signed Request)
                       ↓
                  Bank Page
                       ↓
                Signed Callback → SAPv2 → Credo
```

### 5.3 Important Fields Mapping

| Concept         | Canara Field  |
| --------------- | ------------- |
| merchantOrderNo | orderid       |
| refno           | transactionid |
| status          | auth_status   |

### 5.4 Status Codes

| auth_status | Meaning        |
| ----------- | -------------- |
| 0300        | SUCCESS        |
| others      | FAILED / ERROR |

### 5.5 Verification Rules

- ✅ Callback is cryptographically signed
- ⚠️ Still normalize response before emitting event
- ❌ Never apply business logic directly

---

## 6. Console Gateway (Development Only)

> **Purpose**: Allow developers to bypass real gateways during local/dev testing.

### 6.1 When to Use

- Local development
- CI pipelines
- Frontend integration testing
- Demo environments

❌ NEVER enable in production

---

### 6.2 How Console Gateway Works

```
SAPv2 → Credo (Console Gateway)
           ↓
       Immediate Response
           ↓
    Emit PaymentCompleted Event
```

### 6.3 Console Gateway Behavior

- No encryption
- No redirect
- No callback
- Immediate deterministic response

### 6.4 Sample Config

```env
PAYMENT_GATEWAY=CONSOLE
```

### 6.5 Sample Response

```json
{
  "merchantOrderNo": "DEV-ORDER-001",
  "gateway": "CONSOLE",
  "status": "SUCCESS",
  "refno": "DEV-REF-001",
  "amount": 100
}
```

### 6.6 Safety Guards

- Environment check required
- Hard fail if enabled in production

---

## 7. What to Trust vs What Not to Trust

| Item                       | Trust?        |
| -------------------------- | ------------- |
| merchantOrderNo            | ✅ Always     |
| Gateway callback payload   | ❌ No         |
| Requery / verification API | ✅ Yes        |
| refno                      | ⚠️ Audit only |
| Console gateway result     | ✅ Dev only   |

---

## 8. Summary

- UCO & SBI require **mandatory requery**
- Canara relies on **signed status codes**
- SAPv2 is the **network boundary**
- Credo is the **gateway authority**
- Console gateway speeds up development safely

> This document should be treated as the **canonical reference** for payment gateway behavior.

---
