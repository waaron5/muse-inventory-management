import { TableSkeleton } from "@/components/TableSkeleton";

export default function GiftingLoading() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            width: 110,
            height: 32,
            background: "#e5e7eb",
            borderRadius: 6,
            marginBottom: 8,
          }}
        />
        <div style={{ width: 340, height: 14, background: "#e5e7eb", borderRadius: 6 }} />
      </div>
      <TableSkeleton columns={6} rows={8} />
    </>
  );
}
