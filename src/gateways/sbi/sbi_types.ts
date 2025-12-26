export interface SBIPaymentRequest {
  merchantId: string;
  operatingMode: string;
  merchantCountry: string;
  merchantCurrency: string;
  totalDueAmount: string;
  otherDetails: string; // JSON string
  successUrl: string;
  failureUrl: string;
  aggregatorId: string;
  merchantOrderNo: string;
  merchantCustomerId: string;
  paymode: string;
  accessMedium: string;
  transactionSource: string;
}

export interface SBIDoubleVerificationRequest {
  queryRequest: string; // |merchantId|merchantOrderNo|amount
  aggregatorId: string;
  merchantId: string;
}

export interface SBIDoubleVerificationResponse {
  // Response format: status|refno|status|...other fields
  // Split by | and parse
  raw: string;
  parsed: {
    refno: string;
    status: string;
    merchantOrderNo: string;
    amount: string;
    otherDetails: string;
  };
}
