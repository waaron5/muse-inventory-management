import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAction } from "@/components/admin-action";
import { ListHeader } from "@/components/page-header";
import { ListPage } from "@/components/list-page";
import { CatalogList, ListSkeleton } from "../_catalog/catalog-list";

export const metadata: Metadata = { title: "Gifts" };

export default function GiftsPage({ searchParams }: PageProps<"/gifts">) {
  return (
    <ListPage>
      <ListHeader
        title="Gifts"
        settings={{ href: "/settings#locations", label: "Location settings" }}
        action={
          <Suspense fallback={<div className="h-11 w-32" />}>
            <AdminAction href="/gifts/new" icon={Plus}>
              Add Gift
            </AdminAction>
          </Suspense>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <CatalogList kind="gift" searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
