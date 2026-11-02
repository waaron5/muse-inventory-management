import { notFound } from "next/navigation";
import { connection } from "next/server";
import { priceInput } from "@/lib/format";
import { currentSession } from "@/server/auth";
import { BackLink, PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { safeBack } from "@/lib/back-to";
import { loaders } from "@/server/loaders";
import { createGift, createInventoryItem, editGift, editInventoryItem } from "./actions";
import { ItemForm } from "./item-form";
import { catalogs, type Kind } from "./kind";
import { ItemPhotoPicker } from "./photos";

/** Adding an Inventory Item or Gift, with its Location and Starting Stock. */
export async function NewCatalogItem({ kind }: { kind: Kind }) {
  await connection();
  const { path, noun } = catalogs[kind];
  const [session, { locations }, categoriesScreen] = await Promise.all([
    currentSession(), loaders.locations(), kind === "inventory" ? loaders.categories() : null,
  ]);
  if (session?.user.role !== "admin") {
    return <p className="text-subtle">Only an Admin can add {noun}s. Ask an Admin.</p>;
  }
  return (
    <ItemForm
      kind={kind}
      action={kind === "gift" ? createGift : createInventoryItem}
      locations={locations}
      categories={categoriesScreen?.categories}
      cancelHref={path}
    />
  );
}

/** An Admin keeping an Inventory Item's or Gift's details right. */
export async function EditCatalogItem({
  kind,
  title,
  params,
  searchParams,
}: {
  kind: Kind;
  title: string;
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  await connection();
  const { path, noun } = catalogs[kind];
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Opened from a row's "⋯", saving and cancelling go back to that list.
  const back = safeBack(typeof query.back === "string" ? query.back : undefined);
  const [session, screen] = await Promise.all([
    currentSession(),
    (kind === "gift" ? loaders.gift : loaders.item)(id),
  ]);
  if (!screen) notFound();
  const { item } = screen;
  const header = <TopRow back={<BackLink href={`${path}/${item.id}`}>{item.name}</BackLink>} />;
  if (session?.user.role !== "admin") {
    return (
      <>
        {header}
        <PageColumn width="form">
          <PageHeader title={title} />
          <p className="text-subtle">Only an Admin can edit {noun}s. Ask an Admin.</p>
        </PageColumn>
      </>
    );
  }
  return (
    <>
      {header}
      <PageColumn width="form">
        <PageHeader title={title} />
        <div className="flex flex-col gap-5">
          <ItemPhotoPicker itemId={item.id} photo={item.photo} />
          <ItemForm
            kind={kind}
            action={kind === "gift" ? editGift : editInventoryItem}
            item={{
              id: item.id,
              name: item.name,
              sku: item.sku ?? "",
              unitPrice: priceInput(item.unitPriceCents),
              description: item.description ?? "",
              categoryId: item.categoryId ?? "",
            }}
            locations={screen.locations}
            categories={screen.categories}
            stock={{ location: screen.location, count: screen.count }}
            cancelHref={back ?? `${path}/${item.id}`}
            back={back}
          />
        </div>
      </PageColumn>
    </>
  );
}
