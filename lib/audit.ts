import { prisma } from "./db";
import { AuditEntityType, AuditActionType } from "@prisma/client";

export async function logAudit({
  entityType,
  entityId,
  actionType,
  performedById,
  summary,
  metadata,
}: {
  entityType: AuditEntityType;
  entityId: string;
  actionType: AuditActionType;
  performedById: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        actionType,
        performedById,
        summary,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    // Audit failures should not crash main flows — log and continue
    console.error("[audit] Failed to write audit log:", err);
  }
}
