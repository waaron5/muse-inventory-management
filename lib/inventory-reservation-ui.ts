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
