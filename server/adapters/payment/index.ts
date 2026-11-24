import { MockPaymentAdapter } from "./mock";
import type { PaymentAdapter } from "./types";

export * from "./types";

type Factory = () => PaymentAdapter;

const registry = new Map<string, Factory>([["mock", () => new MockPaymentAdapter({ gatewayPath: "/checkout/mock-pay" })]]);

/**
 * Register a gateway, e.g. in Phase 2+:
 *   registerPaymentProvider("stripe", () => new StripeAdapter(...))
 *   registerPaymentProvider("zarinpal", () => new ZarinpalAdapter(...))
 * The active provider is chosen by `store_settings.payment_provider`.
 */
export function registerPaymentProvider(id: string, factory: Factory) {
  registry.set(id, factory);
}

export function paymentProviders() {
  return [...registry.keys()];
}

export function getPaymentAdapter(id: string): PaymentAdapter {
  const factory = registry.get(id);
  if (!factory) throw new Error(`Payment provider "${id}" is not registered (available: ${paymentProviders().join(", ")})`);
  return factory();
}
