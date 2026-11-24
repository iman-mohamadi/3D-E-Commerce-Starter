export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  /** Integer minor units. */
  amount: number;
  currency: string;
  customerEmail: string;
  /** Absolute URL the provider should send the customer back to. */
  returnUrl: string;
}

export type PaymentStatus = "paid" | "pending" | "failed";

export interface CreatePaymentResult {
  /** Provider-side id; stored in orders.payment_reference. */
  reference: string;
  /** If set, send the customer there (Stripe Checkout, Zarinpal gateway, mock page). */
  redirectUrl?: string;
  /** Some providers confirm instantly (mock auto-approve). */
  status: PaymentStatus;
}

export interface VerifyPaymentInput {
  reference: string;
  /** Query/body params the provider appended to the return URL or webhook. */
  params: Record<string, string>;
  /** Expected amount, so adapters can reject tampered callbacks. */
  expectedAmount: number;
}

export interface VerifyPaymentResult {
  status: PaymentStatus;
  /** Provider transaction id / receipt number. */
  transactionId?: string;
  raw?: unknown;
}

export interface RefundInput {
  reference: string;
  amount: number;
}

export interface PaymentAdapter {
  readonly id: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  refund?(input: RefundInput): Promise<{ ok: boolean; reference?: string }>;
}
