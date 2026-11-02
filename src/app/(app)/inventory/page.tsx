import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAction } from "@/components/admin-action";
import { ListHeader } from "@/components/page-header";
import { ListPage } from "@/components/list-page";
import { CatalogList, ListSkeleton } from "../_catalog/catalog-list";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <ListPage>
      <ListHeader
        title="Inventory"
        settings={{ href: "/settings#locations", label: "Location & category settings" }}
        action={
          <Suspense fallback={<div className="h-11 w-32" />}>
            <AdminAction href="/inventory/new" icon={Plus}>
              Add Item
            </AdminAction>
          </Suspense>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <CatalogList kind="inventory" searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
