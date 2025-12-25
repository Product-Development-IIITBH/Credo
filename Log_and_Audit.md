# Credo Service - Logging & Audit Strategy

## 1. What is "Audit" in Payment Context?

**Audit** = Creating an immutable trail of evidence for:

- **Security**: Detecting fraud, unauthorized access, tampering
- **Compliance**: Meeting regulatory requirements (PCI-DSS, RBI guidelines)
- **Operations**: Debugging failures, reconciliation, dispute resolution
- **Financial**: Proving payment flow for chargebacks, refunds

### Key Principle:

**Log everything that crosses a trust boundary**

- Data coming FROM SAPv2
- Data going TO gateways
- Data coming FROM gateways
- All decryption/verification attempts

---

## 2. What to Log (Security Perspective)

### 2.1 Request Authentication & Authorization

```typescript
{
  logType: "AUTH_CHECK",
  timestamp: "2025-01-15T10:30:45.123Z",
  requestId: "req-uuid-123",
  sourceIp: "192.168.1.100",
  apiKey: "key-***-last4chars", // Masked
  endpoint: "/api/v1/payment/initiate",
  allowed: true,
  reason: "Valid API key"
}
```

**Why?**

- Detect unauthorized access attempts
- Track which SAPv2 instance made the call
- Identify IP-based attacks

---

### 2.2 Payment Initiation Requests

```typescript
{
  logType: "PAYMENT_INITIATION_REQUEST",
  timestamp: "2025-01-15T10:30:45.123Z",
  requestId: "req-uuid-123",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  paymentIndent: "INDENT-67890",
  amount: 5000,
  metadata: {
    roll: "2021BCS001",
    semester: "5",
    type: "institute"
    // Exclude sensitive data like email, phone in logs
  },
  sourceIp: "192.168.1.100"
}
```

**Why?**

- Prove we received the request
- Track which orders were initiated
- Correlate with gateway responses

---

### 2.3 Gateway Request (Before Encryption)

```typescript
{
  logType: "GATEWAY_REQUEST_PRE_ENCRYPTION",
  timestamp: "2025-01-15T10:30:45.500Z",
  requestId: "req-uuid-123",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  amount: 5000,
  gatewayEndpoint: "https://uco-gateway.com/pay",
  payloadFields: ["mid", "amount", "merchantTransactionId", "callbackUrl"], // List fields, not values
  encryptionMethod: "AES-256-CBC"
}
```

**Why?**

- Know what we sent to the gateway
- Debug encryption issues
- Verify correct data mapping

---

### 2.4 Gateway Request (After Encryption)

```typescript
{
  logType: "GATEWAY_REQUEST_ENCRYPTED",
  timestamp: "2025-01-15T10:30:45.600Z",
  requestId: "req-uuid-123",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  encryptedPayloadLength: 1024,
  encryptedPayloadHash: "sha256-hash-of-encrypted-data", // For integrity check
  sentToGateway: true
}
```

**Why?**

- Prove we encrypted the data
- Detect if payload was modified in transit
- Reproduce encryption if needed

---

### 2.5 Gateway Response

```typescript
{
  logType: "GATEWAY_RESPONSE",
  timestamp: "2025-01-15T10:30:46.100Z",
  requestId: "req-uuid-123",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  httpStatusCode: 200,
  responseTime: 500, // milliseconds
  redirectUrl: "https://uco-gateway.com/redirect?token=xyz",
  refno: "UCO-REF-789", // If available
  success: true
}
```

**Why?**

- Track gateway availability
- Monitor response times
- Prove we got a valid redirect URL

---

### 2.6 Callback Reception (Raw)

```typescript
{
  logType: "CALLBACK_RECEIVED",
  timestamp: "2025-01-15T10:35:45.123Z",
  requestId: "req-uuid-456",
  gateway: "UCO",
  sourceIp: "203.123.45.67", // Gateway IP
  encryptedPayload: "base64-encrypted-string", // FULL encrypted callback
  encryptedPayloadHash: "sha256-hash",
  payloadSize: 512
}
```

**Why?**

- **CRITICAL**: This is your proof of what the gateway sent
- Can replay/reprocess if decryption fails
- Detect tampering (hash mismatch)
- Required for disputes with gateway

---

### 2.7 Callback Decryption Attempt

```typescript
{
  logType: "CALLBACK_DECRYPTION_ATTEMPT",
  timestamp: "2025-01-15T10:35:45.200Z",
  requestId: "req-uuid-456",
  gateway: "UCO",
  encryptedPayloadHash: "sha256-hash",
  decryptionMethod: "AES-256-CBC",
  success: true,
  error: null
}
```

**Why?**

- Track decryption failures
- Detect key rotation issues
- Identify malformed callbacks

---

### 2.8 Callback Decrypted (Success)

```typescript
{
  logType: "CALLBACK_DECRYPTED",
  timestamp: "2025-01-15T10:35:45.300Z",
  requestId: "req-uuid-456",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  status: "SUCCESS",
  refno: "UCO-REF-789",
  amount: 5000,
  decryptedPayload: { /* FULL decrypted object */ }
}
```

**Why?**

- See what the gateway reported
- Compare with reverification result
- Detect discrepancies

---

### 2.9 Reverification Request

```typescript
{
  logType: "REVERIFICATION_REQUEST",
  timestamp: "2025-01-15T10:35:46.000Z",
  requestId: "req-uuid-789",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  refno: "UCO-REF-789",
  amount: 5000,
  reverificationEndpoint: "https://uco-gateway.com/requery"
}
```

**Why?**

- Prove we called reverification
- Track when verification was done
- Required for reconciliation

---

### 2.10 Reverification Response

```typescript
{
  logType: "REVERIFICATION_RESPONSE",
  timestamp: "2025-01-15T10:35:46.500Z",
  requestId: "req-uuid-789",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  refno: "UCO-REF-789",
  verifiedStatus: "SUCCESS",
  verifiedAmount: 5000,
  responseTime: 500,
  rawResponse: { /* FULL gateway response */ },
  mismatchWithCallback: false // Flag if callback said FAILED but requery says SUCCESS
}
```

**Why?**

- **SOURCE OF TRUTH** - This is the final status
- Detect callback vs reverification mismatches
- Required for financial reconciliation

---

### 2.11 Status Mismatch Alert

```typescript
{
  logType: "STATUS_MISMATCH_ALERT",
  timestamp: "2025-01-15T10:35:46.600Z",
  requestId: "req-uuid-789",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  callbackStatus: "FAILED",
  reverificationStatus: "SUCCESS",
  severity: "CRITICAL",
  action: "REVERIFICATION_TRUSTED"
}
```

**Why?**

- **FRAUD DETECTION** - Gateway may send fake FAILED callbacks
- **RELIABILITY** - Callback may fail but payment succeeded
- Alert operations team

---

### 2.12 Encryption/Decryption Errors

```typescript
{
  logType: "CRYPTO_ERROR",
  timestamp: "2025-01-15T10:35:45.400Z",
  requestId: "req-uuid-456",
  gateway: "UCO",
  operation: "DECRYPT",
  errorType: "INVALID_PADDING",
  errorMessage: "Decryption failed: padding error",
  encryptedPayloadHash: "sha256-hash",
  retryable: false
}
```

**Why?**

- Detect key rotation issues
- Identify malformed gateway responses
- Track gateway API changes

---

### 2.13 Gateway Timeout/Failure

```typescript
{
  logType: "GATEWAY_ERROR",
  timestamp: "2025-01-15T10:30:50.000Z",
  requestId: "req-uuid-123",
  gateway: "UCO",
  merchantOrderNo: "SAPV2-ORD-12345",
  operation: "PAYMENT_INITIATION",
  errorType: "TIMEOUT",
  errorMessage: "Gateway did not respond within 30s",
  retryAttempt: 1,
  maxRetries: 3
}
```

**Why?**

- Track gateway uptime
- Detect network issues
- Plan fallback strategies

---

## 3. What to Log (Operations Perspective)

### 3.1 Performance Metrics

```typescript
{
  logType: "PERFORMANCE_METRIC",
  timestamp: "2025-01-15T10:35:46.600Z",
  requestId: "req-uuid-123",
  operation: "PAYMENT_INITIATION",
  gateway: "UCO",
  totalTime: 1200, // milliseconds
  breakdown: {
    validation: 50,
    encryption: 100,
    gatewayRequest: 500,
    gatewayResponse: 500,
    processing: 50
  }
}
```

**Why?**

- Identify slow gateways
- Optimize bottlenecks
- SLA monitoring

---

### 3.2 Health Check Results

```typescript
{
  logType: "HEALTH_CHECK",
  timestamp: "2025-01-15T10:00:00.000Z",
  gateway: "UCO",
  configValid: true,
  keysLoaded: true,
  errors: [],
  lastSuccessfulTransaction: "2025-01-15T09:55:00.000Z"
}
```

**Why?**

- Proactive monitoring
- Detect configuration issues
- Alert before failures

---

### 3.3 Rate Limiting

```typescript
{
  logType: "RATE_LIMIT_CHECK",
  timestamp: "2025-01-15T10:35:46.600Z",
  sourceIp: "192.168.1.100",
  endpoint: "/api/v1/payment/initiate",
  requestCount: 95,
  limit: 100,
  windowStart: "2025-01-15T10:35:00.000Z",
  allowed: true
}
```

**Why?**

- Detect abuse
- Track API usage patterns
- Plan capacity

---

## 4. What NOT to Log (Security Risk)

### ❌ NEVER Log These:

1. **Full Credit Card Numbers** (PCI-DSS violation)
2. **CVV/CVC codes**
3. **Encryption Keys** (UCO_EPAY_KEY, SBI_ARRAY_KEY, etc.)
4. **Full API Keys** (mask: `key-***-1234`)
5. **Customer Passwords** (if any)
6. **OTP codes**
7. **Full Bank Account Numbers** (mask: `****-****-1234`)
8. **Personal Identification Numbers** (Aadhaar, PAN - mask them)

### ⚠️ Mask These:

1. **Email**: `student@example.com` → `s*****t@e****e.com`
2. **Phone**: `9876543210` → `98****3210`
3. **API Keys**: `secret-key-12345` → `sec***-12345`

---

## 5. Log Levels

### TRACE (Most Verbose)

- Every function entry/exit
- Variable values during processing
- **Use**: Development only

### DEBUG

- Detailed flow through the system
- Encryption parameters (not keys)
- **Use**: Development + Staging

### INFO (Default)

- All successful operations
- Payment initiation, callback received, verification success
- **Use**: Production

### WARN

- Recoverable errors
- Status mismatches (callback vs reverification)
- Gateway slow responses
- **Use**: Production

### ERROR

- Decryption failures
- Gateway API errors
- Invalid signatures
- **Use**: Production - Alert operations

### FATAL

- Service crash
- Database connection loss (if we add later)
- Critical security violations
- **Use**: Production - Alert immediately

---

## 6. Log Structure (Standard Format)

```typescript
interface LogEntry {
  // Standard Fields (Every Log)
  timestamp: string; // ISO 8601
  logType: string; // PAYMENT_INITIATION_REQUEST, CALLBACK_RECEIVED, etc.
  requestId: string; // Trace entire request
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

  // Context Fields
  gateway?: string; // UCO, SBI, CANARA, CONSOLE
  merchantOrderNo?: string; // Primary correlation key
  paymentIndent?: string; // SAPv2's idempotency key
  refno?: string; // Gateway transaction ID

  // Source Tracking
  sourceIp?: string; // Where did the request come from
  userAgent?: string; // For web requests

  // Operation Details
  operation?: string; // INITIATE, CALLBACK, VERIFY
  success: boolean; // Did it succeed?
  errorCode?: string; // Standard error code
  errorMessage?: string; // Human-readable error

  // Performance
  responseTime?: number; // Milliseconds

  // Data (sanitized)
  data?: any; // Operation-specific data (NEVER log secrets)
}
```

---

## 7. Log Rotation & Retention

### Development

- **Retention**: 7 days
- **Rotation**: Daily
- **Location**: `./logs/credo-dev-YYYY-MM-DD.log`

### Staging

- **Retention**: 30 days
- **Rotation**: Daily
- **Location**: Cloud storage (S3, GCS)

### Production

- **Retention**: 90 days (or per compliance requirements)
- **Rotation**: Daily
- **Location**:
  - Hot storage: 7 days (fast access)
  - Cold storage: 83 days (archive)
- **Backup**: Replicated to 3 regions

---

## 8. Security Event Monitoring (SIEM Integration)

### Critical Events to Alert On:

1. **Multiple Decryption Failures**
   - Threshold: 5 failures in 1 minute
   - Action: Alert + Block IP

2. **Status Mismatch**
   - Threshold: 1 occurrence
   - Action: Alert operations + Manual review

3. **Unauthorized Access Attempts**
   - Threshold: 3 failed auth in 1 minute
   - Action: Alert + Block IP

4. **Gateway Timeout Spike**
   - Threshold: 10 timeouts in 5 minutes
   - Action: Alert + Switch to backup gateway (if available)

5. **Unusual Amount Pattern**
   - Example: 100 payments of exact same amount in 1 hour
   - Action: Alert fraud team

---

## 9. Audit Trail Use Cases

### Use Case 1: Dispute Resolution

**Scenario**: Student says payment succeeded but SAPv2 shows failed

**Audit Trail**:

1. Find `merchantOrderNo` in logs
2. Check `PAYMENT_INITIATION_REQUEST` - Was amount correct?
3. Check `CALLBACK_RECEIVED` - Did callback arrive?
4. Check `CALLBACK_DECRYPTED` - What did callback say?
5. Check `REVERIFICATION_RESPONSE` - What is the verified status?
6. Check `STATUS_MISMATCH_ALERT` - Any discrepancies?

**Resolution**: Reverification response is source of truth

---

### Use Case 2: Gateway Claims Payment Failed

**Scenario**: Gateway claims we never sent request

**Audit Trail**:

1. Find `merchantOrderNo`
2. Show `GATEWAY_REQUEST_ENCRYPTED` log with timestamp
3. Show `encryptedPayloadHash` - Prove data integrity
4. Show gateway's HTTP 200 response

**Resolution**: We have proof of request + acknowledgment

---

### Use Case 3: Security Breach Investigation

**Scenario**: Suspicious payment activity detected

**Audit Trail**:

1. Filter logs by `sourceIp`
2. Check `AUTH_CHECK` logs - Which API key was used?
3. Check `PAYMENT_INITIATION_REQUEST` - Pattern of requests?
4. Check timestamps - Are requests automated (too fast)?

**Resolution**: Identify compromised API key, rotate it

---

## 10. Logging Implementation (Winston)

```typescript
// src/utils/logger.util.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'credo-service' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

export default logger;
```

---

## Summary

### Log at These Boundaries:

1. ✅ **Request Entry** - What came from SAPv2
2. ✅ **Gateway Request** - What we sent to gateway (before/after encryption)
3. ✅ **Gateway Response** - What gateway sent back
4. ✅ **Callback Entry** - Raw encrypted callback from gateway
5. ✅ **Callback Decrypted** - What callback actually said
6. ✅ **Reverification Request/Response** - Source of truth
7. ✅ **Final Response** - What we sent back to SAPv2
8. ✅ **All Errors** - Every failure point

### Never Log:

- ❌ Encryption keys
- ❌ Full credit card numbers
- ❌ Sensitive personal data (mask it)

### Alert On:

- 🚨 Status mismatches
- 🚨 Decryption failures
- 🚨 Unauthorized access
- 🚨 Gateway downtime

This audit trail ensures you can:

- **Prove** what happened
- **Debug** failures
- **Detect** fraud
- **Resolve** disputes
- **Comply** with regulations
