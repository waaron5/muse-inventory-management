"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { deactivateUser, resendUserInvite } from "@/app/(app)/settings/user-actions";

export function UserRowActions({
  user,
  currentUserId,
}: {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name: string;
    passwordSetAt?: Date | string | null;
  };
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (user.id === currentUserId) return null;

  const displayName =
    user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name;

  async function handleRemove() {
    if (!confirm(`Remove ${displayName}? They will no longer be able to log in.`)) return;

    setLoading(true);
    const result = await deactivateUser(user.id);
    setLoading(false);

    if ("error" in result) {
      toast(result.error, "error");
    } else {
      toast(`${displayName} has been removed`);
      router.refresh();
    }
  }

  async function handleResendInvite() {
    setLoading(true);
    const result = await resendUserInvite(user.id);
    setLoading(false);

    if ("error" in result) {
      toast(result.error, "error");
    } else {
      toast(`Invite resent to ${user.email}`);
      router.refresh();
    }
  }

  const actions = [];
  if (!user.passwordSetAt) {
    actions.push({
      label: loading ? "Sending..." : "Resend Invite",
      onClick: handleResendInvite,
      disabled: loading,
    });
  }
  actions.push({
    label: loading ? "Removing..." : "Remove",
    onClick: handleRemove,
    variant: "danger" as const,
    disabled: loading,
  });

  return (
    <RowActionsMenu
      triggerLabel={`Actions for ${displayName}`}
      disabled={loading}
      actions={actions}
    />
  );
}
