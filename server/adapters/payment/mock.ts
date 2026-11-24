import { randomUUID } from "node:crypto";
import type { CreatePaymentInput, CreatePaymentResult, PaymentAdapter, VerifyPaymentInput, VerifyPaymentResult } from "./types";

/**
 * Built-in gateway for development and demos. No money moves.
 * - `autoApprove` (default): payment is marked paid immediately.
 * - otherwise: redirects to `returnUrl` with `?mock_status=paid|failed` so the checkout flow
 *   (redirect -> return -> verify) can be exercised end to end.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly id = "mock";
  constructor(private readonly opts: { autoApprove?: boolean } = { autoApprove: true }) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const reference = `mock_${randomUUID()}`;
    if (this.opts.autoApprove) return { reference, status: "paid" };
    const url = new URL(input.returnUrl);
    url.searchParams.set("reference", reference);
    url.searchParams.set("mock_status", "paid");
    return { reference, status: "pending", redirectUrl: url.toString() };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.reference.startsWith("mock_")) return { status: "failed" };
    const status = input.params.mock_status === "failed" ? "failed" : "paid";
    return { status, transactionId: input.reference.replace("mock_", "txn_") };
  }

  async refund() {
    return { ok: true, reference: `mock_refund_${randomUUID()}` };
  }
}
