export interface CanaraPaymentRequest {
  mercid: string;
  orderid: string;
  amount: string;
  order_date: string;
  currency: string;
  ru: string; // Return URL
  additional_info: {
    additional_info1: string; // name
    additional_info2: string; // email
    additional_info3: string; // userId
    additional_info4: string; // contact
    additional_info5: string; // session
    additional_info6: string; // term
    additional_info7: string; // semester (as string)
    additional_info8: string; // type
    additional_info9: string; // roll (optional)
  };
  itemcode: string;
  device: {
    init_channel: string;
    ip: string;
    accept_header: string;
    user_agent: string;
  };
}

export interface CanaraPaymentResponse {
  bdorderid: string;
  mercid: string;
  links: Array<{
    rel: string;
    href: string;
    method: string;
    headers?: {
      authorization: string;
    };
  }>;
}

export interface CanaraVerificationRequest {
  mercid: string;
  orderid: string;
}

export interface CanaraVerificationResponse {
  orderid: string;
  transactionid: string;
  amount: string;
  auth_status: string; // '0300' = SUCCESS
  transaction_error_type?: string;
  additional_info: {
    additional_info1: string;
    additional_info2: string;
    additional_info3: string;
    additional_info4: string;
    additional_info5: string;
    additional_info6: string;
    additional_info7: string;
    additional_info8: string;
    additional_info9: string;
  };
}
