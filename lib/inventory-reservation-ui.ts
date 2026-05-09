export function getInventoryReservationStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pending Approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELED":
      return "Canceled";
    case "COMPLETED":
      return "Returned";
    default:
      return status;
  }
}

export function getInventoryReservationStatusVariant(status: string) {
  switch (status) {
    case "PENDING":
      return "pending" as const;
    case "APPROVED":
      return "approved" as const;
    case "REJECTED":
      return "rejected" as const;
    case "CANCELED":
      return "canceled" as const;
    case "COMPLETED":
      return "completed" as const;
    default:
      return "active" as const;
  }
}
