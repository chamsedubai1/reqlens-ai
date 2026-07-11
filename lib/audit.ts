import "server-only";
import { getDb } from "@/lib/db/client";
import { createAuditLog } from "@/lib/db/queries";

// Best-effort audit logging. Never throws — a failure to write an audit row must
// not break the primary action that triggered it.
export async function audit(
  tenantId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await createAuditLog(getDb(), tenantId, { userId, action, entityType, entityId, metadata });
  } catch {
    // swallow — auditing is best-effort
  }
}
