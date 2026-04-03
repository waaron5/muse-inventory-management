import { TableSkeleton } from "@/components/TableSkeleton";

export default function InventoryLoading() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 140, height: 32, background: "#e5e7eb", borderRadius: 6, marginBottom: 8 }} />
        <div style={{ width: 320, height: 14, background: "#e5e7eb", borderRadius: 6 }} />
      </div>
      <TableSkeleton columns={8} rows={8} />
    </>
  );
}
