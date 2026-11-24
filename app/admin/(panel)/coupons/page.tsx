import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { coupons } from "@/db/schema";
import { PageHeader } from "@/admin/components/ui";
import { CouponsManager } from "@/admin/components/CouponsManager";

export default async function CouponsPage() {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  return (
    <>
      <PageHeader title="Coupons" subtitle="Percentage or fixed-amount codes." />
      <CouponsManager
        coupons={rows.map((c) => ({ id: c.id, code: c.code, type: c.type, value: c.value, minSubtotal: c.minSubtotal, maxUses: c.maxUses, usedCount: c.usedCount, startsAt: c.startsAt?.toISOString() ?? null, expiresAt: c.expiresAt?.toISOString() ?? null, isActive: c.isActive }))}
      />
    </>
  );
}
