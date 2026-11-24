import { randomUUID } from "node:crypto";
import type { CreatePaymentInput, CreatePaymentResult, PaymentAdapter, VerifyPaymentInput, VerifyPaymentResult } from "./types";

/**
 * Built-in gateway for development and demos. No money moves.
 *  - default: redirects to a hosted-style test page (/checkout/mock-pay) where you approve or fail the payment,
 *    then back to `returnUrl?mock_status=paid|failed`, which is the redirect/return/verify shape of a real gateway.
 *  - `autoApprove`: marks the payment paid immediately (useful for tests and seeding).
 * Real providers verify server-to-server; the mock trusts `mock_status` but still requires the unguessable reference.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly id = "mock";
  constructor(private readonly opts: { autoApprove?: boolean; gatewayPath?: string } = {}) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const reference = `mock_${randomUUID()}`;
    if (this.opts.autoApprove) return { reference, status: "paid" };
    const gateway = new URL(this.opts.gatewayPath ?? "/checkout/mock-pay", input.returnUrl);
    gateway.searchParams.set("reference", reference);
    gateway.searchParams.set("order", input.orderNumber);
    gateway.searchParams.set("amount", String(input.amount));
    gateway.searchParams.set("currency", input.currency);
    gateway.searchParams.set("return", input.returnUrl);
    return { reference, status: "pending", redirectUrl: gateway.toString() };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.reference.startsWith("mock_")) return { status: "failed" };
    if (input.params.mock_status === "paid") return { status: "paid", transactionId: input.reference.replace("mock_", "txn_") };
    if (input.params.mock_status === "failed") return { status: "failed" };
    return { status: "pending" };
  }

  async refund() {
    return { ok: true, reference: `mock_refund_${randomUUID()}` };
  }
}
