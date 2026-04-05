export function getGiftReservationStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pending Approval";
    case "APPROVED":
      return "Approved";
    case "COMPLETED":
      return "Consumed";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

export function getGiftReservationStatusVariant(status: string) {
  switch (status) {
    case "PENDING":
      return "pending" as const;
    case "APPROVED":
      return "approved" as const;
    case "REJECTED":
      return "rejected" as const;
    case "COMPLETED":
      return "consumed" as const;
    default:
      return "active" as const;
  }
}
