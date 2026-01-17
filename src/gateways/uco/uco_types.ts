export interface UCOPaymentRequest {
  mid: string;
  amount: string;
  merchantTransactionId: string;
  transactionDate: string;
  terminalId: string;
  udf1: string; // contact
  udf2: string; // email
  udf3: string; // name
  udf4: string; // userId (or roll for backward compatibility)
  udf5: string; // JSON: { session, term, semester, type }
  udf6: string;
  udf7: string;
  udf8: string;
  udf9: string;
  udf10: string;
  ru: string; // return URL
  callbackUrl: string;
  currency: string;
  paymentMode: string;
  bankId: string;
  txnType: string;
  productType: string;
  txnNote: string;
  vpa: string;
}

export interface UCOPaymentResponse {
  status: string;
  response?: string; // Encrypted response
  paymentId?: string;
  message?: string;
}

export interface UCORequeryRequest {
  mid: string;
  paymentId: string;
  terminalId: string;
  vpa: string;
}

export interface UCORequeryResponse {
  paymentStatus: string; // SUCCESS, FAILED, PENDING
  merchantOrderNo: string;
  getepayTxnId: string;
  txnAmount: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string; // JSON string
  udf6: string;
  udf7: string;
  udf8: string;
  udf9: string;
  udf10: string;
  merchantTransactionId: string;
}
