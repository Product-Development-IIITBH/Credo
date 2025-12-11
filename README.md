# Software Requirements Document (SRD)
## Credo - Academic Payment Microservice

**Package:** `@iiitbh/credo`  
**Version:** 1.0.0  
**Last Updated:** December 2024

---

## 5. Technical Architecture

### 5.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER (Express)                      │
│  Controllers → Middleware → Validators → Routes             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   SERVICE LAYER                              │
│  PaymentService | CallbackService | VerificationService     │
│  NotificationService | SessionService                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               GATEWAY LAYER (Strategy Pattern)               │
│  UCOGateway | SBIGateway | CanaraGateway | ConsoleGateway  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  DATA ACCESS LAYER                           │
│  Repositories → Sequelize Models → PostgreSQL               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│  Redis (Sessions) | RabbitMQ (Events) | External APIs       │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Component Interaction

```
┌─────────┐
│   SAP   │
└────┬────┘
     │ 1. POST /payments/initiate
     ▼
┌─────────────────┐
│ PaymentController│
└────┬────────────┘
     │ 2. Validate request
     ▼
┌─────────────────┐
│ PaymentService  │
└────┬────────────┘
     │ 3. Create payment
     ▼
┌─────────────────┐      ┌──────────┐
│ PaymentRepo     │─────→│PostgreSQL│
└────┬────────────┘      └──────────┘
     │ 4. Create session
     ▼
┌─────────────────┐      ┌──────────┐
│ SessionService  │─────→│  Redis   │
└────┬────────────┘      └──────────┘
     │ 5. Call gateway
     ▼
┌─────────────────┐      ┌──────────┐
│ UCOGateway      │─────→│UCO Bank  │
└────┬────────────┘      └────┬─────┘
     │ 6. Return redirect      │
     ▼                         │
┌─────────────────┐           │
│  SAP (redirect) │           │
└─────────────────┘           │
                              │
                              │ 7. Student pays
                              │
                              ▼
                    ┌──────────────────┐
                    │ POST /callbacks/ │
                    │ uco              │
                    └────┬─────────────┘
                         │ 8. Decrypt callback
                         ▼
                    ┌──────────────────┐
                    │ CallbackService  │
                    └────┬─────────────┘
                         │ 9. Update payment
                         ▼
                    ┌──────────────────┐
                    │ PaymentRepo      │
                    └────┬─────────────┘
                         │ 10. Publish event
                         ▼
                    ┌──────────────────┐
                    │    RabbitMQ      │
                    └────┬─────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         ┌────────┐            ┌───────┐
         │  SAP   │            │ Raven │
         │(Update)│            │(Email)│
         └────────┘            └───────┘
```

---

## 6. Data Models

### 6.1 Database Schema (PostgreSQL)

#### 6.1.1 Payments Table

**Table Name:** `credo_payments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique payment identifier |
| `session_id` | VARCHAR(255) | NOT NULL | Redis session reference |
| `student_id` | VARCHAR(50) | NOT NULL | Roll number or application ID |
| `user_id` | VARCHAR(50) | NOT NULL | User who initiated payment |
| `amount` | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Payment amount in INR |
| `gateway` | VARCHAR(20) | NOT NULL | UCO/SBI/CANARA/CONSOLE |
| `payment_type` | VARCHAR(20) | NOT NULL | Institute/Hostel/Mess |
| `semester` | VARCHAR(20) | NOT NULL | Spring/Autumn |
| `session` | VARCHAR(20) | NOT NULL | Academic session (2025-26) |
| `status` | VARCHAR(20) | NOT NULL | INITIATED/PENDING/SUCCESS/FAILED/TIMEOUT |
| `merchant_order_no` | VARCHAR(100) | UNIQUE, NOT NULL | Order ID for gateway |
| `gateway_transaction_id` | VARCHAR(255) | NULL | Gateway's transaction ID |
| `error_message` | TEXT | NULL | Error details if failed |
| `metadata` | JSONB | NULL | Additional data |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |
| `completed_at` | TIMESTAMP | NULL | Completion timestamp |

**Indexes:**
```sql
CREATE INDEX idx_payments_student_id ON credo_payments(student_id);
CREATE INDEX idx_payments_session ON credo_payments(session);
CREATE INDEX idx_payments_semester ON credo_payments(semester);
CREATE INDEX idx_payments_status ON credo_payments(status);
CREATE INDEX idx_payments_created_at ON credo_payments(created_at);
CREATE INDEX idx_payments_merchant_order ON credo_payments(merchant_order_no);
CREATE INDEX idx_payments_gateway_txn ON credo_payments(gateway_transaction_id);
CREATE INDEX idx_payments_composite ON credo_payments(student_id, semester, session, payment_type);
```

---

#### 6.1.2 Transactions Table (Audit Log)

**Table Name:** `credo_transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique transaction log ID |
| `payment_id` | UUID | FOREIGN KEY, NOT NULL | References credo_payments(id) |
| `event` | VARCHAR(50) | NOT NULL | Event type |
| `request` | JSONB | NULL | Request payload |
| `response` | JSONB | NULL | Response payload |
| `error` | TEXT | NULL | Error message if any |
| `timestamp` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Event timestamp |

**Event Types:**
- `payment_initiated`
- `gateway_called`
- `callback_received`
- `verification_completed`
- `payment_completed`
- `payment_failed`
- `status_updated`

**Indexes:**
```sql
CREATE INDEX idx_transactions_payment_id ON credo_transactions(payment_id);
CREATE INDEX idx_transactions_event ON credo_transactions(event);
CREATE INDEX idx_transactions_timestamp ON credo_transactions(timestamp);
```

---

#### 6.1.3 Payment Sessions Table (Redis Backup)

**Table Name:** `credo_sessions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(255) | PRIMARY KEY | Session ID |
| `payment_id` | UUID | FOREIGN KEY, NOT NULL | References credo_payments(id) |
| `data` | JSONB | NOT NULL | Session data |
| `expires_at` | TIMESTAMP | NOT NULL | Expiration time |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
```sql
CREATE INDEX idx_sessions_payment_id ON credo_sessions(payment_id);
CREATE INDEX idx_sessions_expires_at ON credo_sessions(expires_at);
```

---

### 6.2 Sequelize Models

#### 6.2.1 Payment Model

```typescript
// src/database/models/Payment.model.ts

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface PaymentAttributes {
  id: string;
  sessionId: string;
  studentId: string;
  userId: string;
  amount: number;
  gateway: 'UCO' | 'SBI' | 'CANARA' | 'CONSOLE';
  paymentType: 'Institute' | 'Hostel' | 'Mess';
  semester: 'Spring' | 'Autumn';
  session: string; // e.g., "2025-26"
  status: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR';
  merchantOrderNo: string;
  gatewayTransactionId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

interface PaymentCreationAttributes 
  extends Optional<PaymentAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> 
  implements PaymentAttributes {
  
  public id!: string;
  public sessionId!: string;
  public studentId!: string;
  public userId!: string;
  public amount!: number;
  public gateway!: 'UCO' | 'SBI' | 'CANARA' | 'CONSOLE';
  public paymentType!: 'Institute' | 'Hostel' | 'Mess';
  public semester!: 'Spring' | 'Autumn';
  public session!: string;
  public status!: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR';
  public merchantOrderNo!: string;
  public gatewayTransactionId?: string;
  public errorMessage?: string;
  public metadata?: Record<string, any>;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly completedAt?: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'session_id',
    },
    studentId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'student_id',
    },
    userId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'user_id',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    gateway: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['UCO', 'SBI', 'CANARA', 'CONSOLE']],
      },
    },
    paymentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'payment_type',
      validate: {
        isIn: [['Institute', 'Hostel', 'Mess']],
      },
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['Spring', 'Autumn']],
      },
    },
    session: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: /^\d{4}-\d{2}$/,  // Format: 2025-26
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'INITIATED',
      validate: {
        isIn: [['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'ERROR']],
      },
    },
    merchantOrderNo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'merchant_order_no',
    },
    gatewayTransactionId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'gateway_transaction_id',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
  },
  {
    sequelize,
    tableName: 'credo_payments',
    timestamps: true,
    underscored: true,
  }
);

export default Payment;
```

---

#### 6.2.2 Transaction Model

```typescript
// src/database/models/Transaction.model.ts

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import Payment from './Payment.model';

interface TransactionAttributes {
  id: string;
  paymentId: string;
  event: string;
  request?: Record<string, any>;
  response?: Record<string, any>;
  error?: string;
  timestamp?: Date;
}

interface TransactionCreationAttributes 
  extends Optional<TransactionAttributes, 'id' | 'timestamp'> {}

class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes> 
  implements TransactionAttributes {
  
  public id!: string;
  public paymentId!: string;
  public event!: string;
  public request?: Record<string, any>;
  public response?: Record<string, any>;
  public error?: string;
  public readonly timestamp!: Date;
}

Transaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payment_id',
      references: {
        model: 'credo_payments',
        key: 'id',
      },
    },
    event: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    request: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    response: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'credo_transactions',
    timestamps: false,
  }
);

// Associations
Payment.hasMany(Transaction, {
  foreignKey: 'paymentId',
  as: 'transactions',
});

Transaction.belongsTo(Payment, {
  foreignKey: 'paymentId',
  as: 'payment',
});

export default Transaction;
```

---

### 6.3 Redis Data Structures

#### 6.3.1 Session Storage

**Key Pattern:** `credo:session:{sessionId}`  
**Type:** Hash  
**TTL:** 1800 seconds (30 minutes)

**Fields:**
```json
{
  "paymentId": "uuid",
  "studentId": "2001011",
  "amount": "50000",
  "gateway": "UCO",
  "createdAt": "2024-01-01T10:00:00Z"
}
```

**Commands:**
```redis
HSET credo:session:sess_xyz paymentId pay_abc
EXPIRE credo:session:sess_xyz 1800
HGETALL credo:session:sess_xyz
```

---

#### 6.3.2 Rate Limiting

**Key Pattern:** `credo:ratelimit:{studentId}:{type}`  
**Type:** String (counter)  
**TTL:** 3600 seconds (1 hour)

**Logic:**
- Max 5 payment initiations per student per hour
- Max 10 status queries per minute per IP

```redis
INCR credo:ratelimit:2001011:initiate
EXPIRE credo:ratelimit:2001011:initiate 3600
GET credo:ratelimit:2001011:initiate
```

---

#### 6.3.3 Idempotency Keys

**Key Pattern:** `credo:idempotency:{merchantOrderNo}`  
**Type:** String (payment status)  
**TTL:** 86400 seconds (24 hours)

**Purpose:** Prevent duplicate callback processing

```redis
SET credo:idempotency:ORD_123 "SUCCESS" EX 86400
GET credo:idempotency:ORD_123
```

---

### 6.4 RabbitMQ Message Structure

#### 6.4.1 Exchange Configuration

**Exchange Name:** `credo.events`  
**Exchange Type:** `topic`  
**Durability:** Durable

**Routing Keys:**
- `payment.initiated`
- `payment.success`
- `payment.failed`
- `payment.timeout`
- `payment.verified`

---

#### 6.4.2 Queue Configuration

**Queues:**
1. `credo.sap.queue` - Consumed by SAP
2. `credo.raven.queue` - Consumed by Raven
3. `credo.analytics.queue` - Consumed by Analytics service

**Bindings:**
```
credo.sap.queue → payment.* (all events)
credo.raven.queue → payment.success, payment.failed
credo.analytics.queue → payment.* (all events)
```

---

#### 6.4.3 Message Format

```json
{
  "eventId": "evt_xyz789",
  "eventType": "payment.success",
  "timestamp": "2024-01-01T10:05:00Z",
  "version": "1.0",
  "payload": {
    "paymentId": "pay_abc123",
    "studentId": "2001011",
    "userId": "admin_001",
    "amount": 50000,
    "gateway": "UCO",
    "gatewayTransactionId": "UCO_TXN_456",
    "paymentType": "Institute",
    "semester": "Spring",
    "session": "2025-26",
    "studentDetails": {
      "name": "John Doe",
      "email": "john@example.com",
      "contact": "9876543210"
    },
    "metadata": {
      "course": "B.TECH",
      "branch": "CSE",
      "batch": "2020"
    }
  }
}
```

---

## 7. API Specifications

### 7.1 Base Configuration

**Base URL:** `https://api.credo.iiitbh.ac.in/v1`  
**Protocol:** HTTPS  
**Content-Type:** `application/json`  
**Authentication:** JWT Bearer Token

---

### 7.2 Authentication

All API requests (except health checks and callbacks) require JWT authentication.

**Header:**
```
Authorization: Bearer <jwt_token>
```

**JWT Payload:**
```json
{
  "sub": "user_id",
  "role": "admin|student|staff",
  "iat": 1234567890,
  "exp": 1234654290
}
```

---

### 7.3 Core Endpoints

#### 7.3.1 Initiate Payment

**Endpoint:** `POST /payments/initiate`  
**Authentication:** Required  
**Rate Limit:** 5 requests/hour per student

**Request Body:**
```json
{
  "studentId": "2001011",
  "userId": "admin_001",
  "amount": 50000,
  "gateway": "UCO",
  "paymentType": "Institute",
  "semester": "Spring",
  "session": "2025-26",
  "studentDetails": {
    "name": "John Doe",
    "email": "john@example.com",
    "contact": "9876543210"
  },
  "metadata": {
    "course": "B.TECH",
    "branch": "CSE",
    "batch": "2020"
  }
}
```

**Validation Rules:**
- `amount`: Positive number, max 1000000
- `gateway`: Must be one of UCO, SBI, CANARA, CONSOLE
- `paymentType`: Must be one of Institute, Hostel, Mess
- `semester`: Must be Spring or Autumn
- `session`: Format YYYY-YY (e.g., 2025-26)
- `studentId`: Required, alphanumeric
- `userId`: Required, alphanumeric
- `email`: Valid email format
- `contact`: 10 digits

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_abc123xyz",
    "sessionId": "sess_xyz789abc",
    "redirectUrl": "https://epg.ucobank.com/pay?token=...",
    "expiresAt": "2024-01-01T10:30:00Z",
    "merchantOrderNo": "ORD_1704110400123"
  }
}
```

**Error Responses:**

*400 Bad Request:*
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be positive"
      }
    ]
  }
}
```

*429 Too Many Requests:*
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many payment initiations. Try again later.",
    "retryAfter": 3600
  }
}
```

*500 Internal Server Error:*
```json
{
  "success": false,
  "error": {
    "code": "GATEWAY_ERROR",
    "message": "Failed to initiate payment with gateway",
    "details": "Gateway timeout"
  }
}
```

---

#### 7.3.2 Get Payment Status

**Endpoint:** `GET /payments/:paymentId`  
**Authentication:** Required  
**Rate Limit:** 60 requests/minute

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_abc123xyz",
    "studentId": "2001011",
    "userId": "admin_001",
    "amount": 50000,
    "gateway": "UCO",
    "paymentType": "Institute",
    "semester": "Spring",
    "session": "2025-26",
    "status": "SUCCESS",
    "merchantOrderNo": "ORD_1704110400123",
    "gatewayTransactionId": "UCO_TXN_456789",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:05:00Z",
    "completedAt": "2024-01-01T10:05:00Z",
    "metadata": {
      "course": "B.TECH",
      "branch": "CSE"
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment not found with given ID"
  }
}
```

---

#### 7.3.3 Get Student Payments

**Endpoint:** `GET /payments/student/:studentId`  
**Authentication:** Required  
**Query Parameters:**
- `session`: Filter by session (e.g., 2025-26)
- `semester`: Filter by semester (Spring/Autumn)
- `paymentType`: Filter by type (Institute/Hostel/Mess)
- `status`: Filter by status
- `limit`: Max results (default: 10, max: 100)
- `offset`: Pagination offset (default: 0)

**Example:** `GET /payments/student/2001011?session=2025-26&semester=Spring&limit=20`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "studentId": "2001011",
    "payments": [
      {
        "paymentId": "pay_abc123",
        "amount": 50000,
        "paymentType": "Institute",
        "semester": "Spring",
        "session": "2025-26",
        "status": "SUCCESS",
        "gateway": "UCO",
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

#### 7.3.4 Verify Payment

**Endpoint:** `POST /payments/:paymentId/verify`  
**Authentication:** Required (Admin only)  
**Rate Limit:** 10 requests/minute

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_abc123",
    "previousStatus": "PENDING",
    "currentStatus": "SUCCESS",
    "gatewayTransactionId": "UCO_TXN_456",
    "verifiedAt": "2024-01-01T10:10:00Z",
    "statusChanged": true
  }
}
```

---

#### 7.3.5 Gateway Callbacks

**UCO Callback:**  
`POST /callbacks/uco`  
**Authentication:** None (validated by signature)

**Request Body:**
```json
{
  "response": "<encrypted_callback_data>"
}
```

**Success Response (302 Redirect):**
Redirects to: `https://portal.iiitbh.ac.in/payment-success?paymentId=pay_abc123`

---

**SBI Success Callback:**  
`POST /callbacks/sbi/success`

**Request Body:**
```json
{
  "encData": "<encrypted_response>"
}
```

---

**SBI Failure Callback:**  
`POST /callbacks/sbi/failure`

**Request Body:**
```json
{
  "encData": "<encrypted_response>"
}
```

---

**Canara Callback:**  
`POST /callbacks/canara`

**Request Body:**
```json
{
  "transaction_response": "<jws_signed_response>"
}
```

---

### 7.4 Admin Endpoints

#### 7.4.1 Bulk Verify

**Endpoint:** `POST /admin/payments/verify-bulk`  
**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "paymentIds": [
    "pay_abc123",
    "pay_xyz789",
    "pay_def456"
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "verified": 3,
    "updated": 1,
    "failed": 0,
    "results": [
      {
        "paymentId": "pay_abc123",
        "status": "SUCCESS",
        "statusChanged": false
      },
      {
        "paymentId": "pay_xyz789",
        "status": "SUCCESS",
        "statusChanged": true,
        "previousStatus": "PENDING"
      },
      {
        "paymentId": "pay_def456",
        "status": "FAILED",
        "statusChanged": false
      }
    ]
  }
}
```

---

#### 7.4.2 Daily Report

**Endpoint:** `GET /admin/reports/daily`  
**Authentication:** Required (Admin only)  
**Query Parameters:**
- `date`: Report date (YYYY-MM-DD, default: yesterday)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-01",
    "summary": {
      "totalPayments": 150,
      "successCount": 140,
      "failedCount": 8,
      "pendingCount": 2,
      "totalAmount": 7500000,
      "successRate": 93.33
    },
    "byGateway": {
      "UCO": { "count": 80, "amount": 4000000, "successRate": 95 },
      "SBI": { "count": 50, "amount": 2500000, "successRate": 92 },
      "CANARA": { "count": 20, "amount": 1000000, "successRate": 90 }
    },
    "byPaymentType": {
      "Institute": { "count": 100, "amount": 5000000 },
      "Hostel": { "count": 30, "amount": 1500000 },
      "Mess": { "count": 20, "amount": 1000000 }
    },
    "bySemester": {
      "Spring": { "count": 90, "amount": 4500000 },
      "Autumn": { "count": 60, "amount": 3000000 }
    }
  }
}
```

---

### 7.5 Health Check Endpoints

#### 7.5.1 Basic Health

**Endpoint:** `GET /health`  
**Authentication:** None

**Success Response (200):**
```json
{
  "status": "healthy",
  "service": "credo",
  "version": "1.0.0",
  "uptime": 123456,
  "timestamp": "2024-01-01T10:00:00Z"
}
```

---

#### 7.5.2 Detailed Health

**Endpoint:** `GET /health/detailed`  
**Authentication:** Required (Admin only)

**Success Response (200):**
```json
{
  "status": "healthy",
  "service": "credo",
  "version": "1.0.0",
  "uptime": 123456,
  "timestamp": "2024-01-01T10:00:00Z",
  "dependencies": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "connections": {
        "active": 3,
        "idle": 7,
        "total": 10
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "memory": {
        "used": "50MB",
        "peak": "75MB"
      }
    },
    "rabbitmq": {
      "status": "healthy",
      "responseTime": 8,
      "queues": {
        "sap": { "messages": 0, "consumers": 1 },
        "raven": { "messages": 2, "consumers": 1 }
      }
    },
    "gateways": {
      "uco": { "status": "healthy", "enabled": true },
      "sbi": { "status": "healthy", "enabled": true },
      "canara": { "status": "healthy", "enabled": true }
    },
    "externalServices": {
      "sap": { "status": "healthy", "responseTime": 50 },
      "raven": { "status": "healthy", "responseTime": 30 }
    }
  }
}
```

---

## 8. Integration Requirements

### 8.1 SAP Integration

**Integration Type:** Bidirectional  
**Protocol:** HTTPS/REST

**Outgoing (Credo → SAP):**

**Webhook Endpoint:** `POST https://portal.iiitbh.ac.in/webhooks/payment-status`

**Payload:**
```json
{
  "paymentId": "pay_abc123",
  "studentId": "2001011",
  "userId": "admin_001",
  "status": "SUCCESS",
  "amount": 50000,
  "gateway": "UCO",
  "gatewayTransactionId": "UCO_TXN_456",
  "paymentType": "Institute",
  "semester": "Spring",
  "session": "2025-26",
  "completedAt": "2024-01-01T10:05:00Z"
}
```

**Retry Policy:**
- Max 3 retries
- Exponential backoff (1s, 2s, 4s)
- Store in dead letter queue if all retries fail

**Authentication:** JWT token in Authorization header

---

### 8.2 Raven Integration

**Integration Type:** Message Queue (RabbitMQ)

**Queue:** `credo.raven.queue`

**Message Format:**
```json
{
  "emailType": "payment_success",
  "to": "john@example.com",
  "templateData": {
    "studentName": "John Doe",
    "amount": "50,000",
    "paymentId": "pay_abc123",
    "transactionId": "UCO_TXN_456",
    "date": "01-Jan-2024 10:05 AM",
    "paymentType": "Institute Fee",
    "semester": "Spring",
    "session": "2025-26"
  }
}
```

**Email Templates:**
- `payment_success` - Successful payment confirmation
- `payment_failed` - Payment failure notification
- `payment_pending` - Payment reminder (for pending > 1 day)

---

### 8.3 Gateway Integration Details

#### 8.3.1 UCO Bank Gateway

**Type:** EPG Platform  
**Encryption:** AES-256-CBC  
**Documentation:** UCO EPG Integration Manual v3.0

**Endpoints:**
- Payment: `https://epg.ucobank.com/pg/payment`
- Requery: `https://epg.ucobank.com/pg/requery`

**Required Credentials:**
- Merchant ID
- Terminal ID
- Encryption Key
- Encryption IV

**Callback:** Encrypted POST to `/callbacks/uco`

---

#### 8.3.2 SBI ePay Gateway

**Type:** SBI ePay Platform  
**Encryption:** Custom encryption algorithm  
**Documentation:** SBI Merchant Integration Guide v2.5

**Endpoints:**
- Payment: `https://merchant.onlinesbi.com/merchant/merchantpay`
- Verification: `https://merchant.onlinesbi.com/merchant/verify`

**Required Credentials:**
- Merchant ID
- Aggregator ID
- Array Key (encryption)

**Callback:** Form POST to `/callbacks/sbi/success` or `/callbacks/sbi/failure`

---

#### 8.3.3 Canara Bank (BillDesk) Gateway

**Type:** BillDesk Platform  
**Encryption:** JWS (JSON Web Signature)  
**Documentation:** BillDesk Integration Manual v4.0

**Endpoints:**
- Payment: `https://pay.billdesk.com/payment`
- Verification: `https://pay.billdesk.com/verify`

**Required Credentials:**
- Merchant ID
- Client ID
- Secret Key (for JWS signing)

**Callback:** POST to `/callbacks/canara` with JWS response

---

## 9. Security Requirements

### 9.1 Authentication & Authorization

| Requirement | Implementation |
|-------------|----------------|
| **API Authentication** | JWT Bearer tokens |
| **Token Expiry** | 24 hours |
| **Token Refresh** | Handled by SAP |
| **Role-Based Access** | Admin, Staff, Student roles |
| **Gateway Callbacks** | Signature validation, no auth required |

### 9.2 Data Security

| Requirement | Implementation |
|-------------|----------------|
| **Data in Transit** | TLS 1.3 |
| **Data at Rest** | PostgreSQL encryption at rest |
| **Sensitive Data** | Never log gateway credentials |
| **PII Protection** | Encrypt email/contact in logs |
| **Password Storage** | N/A (no user passwords stored) |

### 9.3 Input Validation

- All inputs validated with Joi schemas
- SQL injection prevention (Sequelize parameterized queries)
- XSS prevention (output encoding)
- CSRF protection (CORS configuration)
- Rate limiting on all endpoints

### 9.4 Audit Logging

**Log All:**
- Payment initiations
- Status changes
- Gateway callbacks
- Verification attempts
- Failed operations
- Admin actions

**Log Format:**
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "level": "info",
  "service": "credo",
  "requestId": "req_abc123",
  "userId": "admin_001",
  "action": "payment_initiated",
  "paymentId": "pay_xyz789",
  "details": {
    "studentId": "2001011",
    "amount": 50000,
    "gateway": "UCO"
  }
}
```

---

## 10. Performance Requirements

### 10.1 Response Time Targets

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| Payment Initiation | < 1s | 2s |
| Status Query | < 100ms | 200ms |
| Callback Processing | < 2s | 3s |
| Verification | < 5s | 10s |
| Health Check | < 50ms | 100ms |

### 10.2 Throughput Requirements

| Metric | Target |
|--------|--------|
| **Concurrent Users** | 1,000 |
| **Payments/Hour** | 1,000 |
| **API Requests/Second** | 100 |
| **Database Connections** | 50 (pool) |
| **Redis Connections** | 20 (pool) |

### 10.3 Resource Limits

| Resource | Limit |
|----------|-------|
| **CPU** | 80% max utilization |
| **Memory** | 2GB max per instance |
| **Database Connections** | 50 per instance |
| **API Response Size** | 10MB max |
| **Request Timeout** | 30s |

---

## 11. Deployment Requirements

### 11.1 Environment Setup

**Required Environments:**
1. Development (`dev`)
2. Staging (`staging`)
3. Production (`prod`)

**Infrastructure:**
- Node.js 18+ runtime
- PostgreSQL 15+ database
- Redis 7+ cache
- RabbitMQ 3.12+ message broker
- HTTPS load balancer
- Container orchestration (Docker/Kubernetes)

### 11.2 Configuration Management

**Environment Variables:**
```bash
NODE_ENV=production
SERVICE_NAME=credo
PORT=3000

# Database
DB_HOST=postgres.credo.internal
DB_PORT=5432
DB_NAME=credo_db
DB_USER=credo_user
DB_PASSWORD=<secret>

# Redis
REDIS_HOST=redis.credo.internal
REDIS_PORT=6379
REDIS_PASSWORD=<secret>

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq.credo.internal:5672

# JWT
JWT_SECRET=<secret>

# Gateways
UCO_MID=<merchant_id>
UCO_TERMINAL_ID=<terminal_id>
UCO_EPAY_KEY=<key>
UCO_EPAY_IV=<iv>
# ... more gateway configs

# External Services
SAP_BASE_URL=https://portal.iiitbh.ac.in
SAP_WEBHOOK_URL=https://portal.iiitbh.ac.in/webhooks/payment-status
SAP_API_KEY=<secret>
```

### 11.3 Monitoring & Alerting

**Metrics to Monitor:**
- API response times (p50, p95, p99)
- Error rates
- Payment success rates
- Gateway-wise success rates
- Database connection pool utilization
- Redis memory usage
- RabbitMQ queue depths
- CPU and memory usage

**Alerts:**
- Payment success rate < 90%
- API error rate > 5%
- Response time p95 > 2s
- Database connection pool exhausted
- Redis memory > 80%
- RabbitMQ queue depth > 1000

---

## 12. Testing Requirements

### 12.1 Unit Tests

**Coverage Target:** > 80%

**Test Scope:**
- All service methods
- All repository methods
- All utility functions
- Gateway encryption/decryption
- Validation schemas

### 12.2 Integration Tests

**Test Scope:**
- API endpoints (all routes)
- Database operations
- Redis operations
- RabbitMQ publishing
- Gateway integrations (mocked)

### 12.3 End-to-End Tests

**Test Scenarios:**
1. Complete payment flow (initiate → callback → success)
2. Payment failure flow
3. Payment timeout scenario
4. Duplicate callback handling
5. Verification job execution
6. Reconciliation job execution

---

## 13. Documentation Requirements

**Required Documentation:**
1. API Documentation (OpenAPI/Swagger)
2. Architecture Documentation
3. Gateway Integration Guide
4. Deployment Guide
5. Troubleshooting Guide
6. Runbook for Operations

---

## Appendices

### Appendix A: Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request data |
| `PAYMENT_NOT_FOUND` | Payment ID not found |
| `GATEWAY_ERROR` | Gateway communication failed |
| `VERIFICATION_FAILED` | Payment verification failed |
| `DUPLICATE_PAYMENT` | Duplicate payment attempt |
| `SESSION_EXPIRED` | Payment session expired |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `UNAUTHORIZED` | Invalid or missing auth token |
| `FORBIDDEN` | Insufficient permissions |
| `INTERNAL_ERROR` | Internal server error |

### Appendix B: Payment Status Lifecycle

```
INITIATED → PENDING → SUCCESS
                   ↓
                 FAILED
                   ↓
                TIMEOUT
                   ↓
                 ERROR
```

---

**Document Version:** 1.0.0  
**Last Updated:** December 2024  
**Approved By:** [Pending]  
**Next Review Date:** [Pending]