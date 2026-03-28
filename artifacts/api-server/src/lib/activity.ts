import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";

export interface ActivityParams {
  studioId:   string;
  userId:     string;
  userName:   string;
  userRole:   string;
  action:     string;
  entityType?: string;
  entityId?:   string;
  entityName?: string;
}

const ACTION_LABELS: Record<string, string> = {
  client_created:    "Added a new client",
  client_deleted:    "Deleted a client",
  client_updated:    "Updated client details",
  staff_created:     "Added a new staff member",
  staff_deleted:     "Removed a staff member",
  invoice_created:   "Created an invoice",
  payment_recorded:  "Recorded a payment",
  photos_uploaded:   "Uploaded photos",
  photo_deleted:     "Deleted a photo",
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export async function logActivity(params: ActivityParams): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      studioId:   params.studioId,
      userId:     params.userId,
      userName:   params.userName,
      userRole:   params.userRole,
      action:     params.action,
      entityType: params.entityType ?? null,
      entityId:   params.entityId   ?? null,
      entityName: params.entityName ?? null,
    });
  } catch (err) {
    console.error("[activity] Failed to write activity log:", err);
  }
}
