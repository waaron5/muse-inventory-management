"use client";

import { Check, ImagePlus, Plus, Trash2, ZoomIn } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FormActions, MainButton, SecondaryButton } from "@/components/button";
import { FormError, inlineFailure, Select, TextArea } from "@/components/form";
import { Sheet } from "@/components/sheet";
import { ItemThumb, Photo } from "@/components/thumb";
import { formatDays, formatMoment } from "@/lib/format";
import { photoAccept, uploadFailureMessage, uploadPhoto } from "@/lib/upload-photo";
import { addPastUsePhoto, deletePastUsePhoto, setItemPhoto } from "./actions";

type WentTo = { id: string; name: string; startsOn: string | null; endsOn: string | null };
type PastUse = {
  id: string;
  photo: string;
  note: string | null;
  event: { id: string; name: string } | null;
  eventDeleted?: boolean;
  by: { id: string; name: string };
  addedAt: Date;
};
type Saved = { error?: string } | void;

/**
 * Uploads a picked photo, then hands its key to `save`; whatever refuses it,
 * the upload or the save, is shown as `error`.
 */
function usePhotoUpload() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const upload = (file: File, save: (photo: string) => Promise<Saved>, onSaved?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      try {
        const saved = await save(await uploadPhoto(file));
        if (saved?.error) setError(saved.error);
        else onSaved?.();
      } catch (e) {
        setError(uploadFailureMessage(e));
      }
    });
  return { error, setError, pending, upload };
}

/**
 * The Item Photo at the head of an item's page or its row in a list, opened
 * full size when tapped. On a row it sits above the row's link.
 */
export function ItemPhoto({ photo, name, className }: { photo: string | null; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!photo) return <ItemThumb className={className ?? "size-12"} />;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open the photo of ${name}`}
        className="group/photo relative z-1 shrink-0 rounded-md"
      >
        <ItemThumb photo={photo} className={className ?? "size-12"} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-scrim opacity-0 group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100">
          <ZoomIn size={20} strokeWidth={2} className="text-on-main" aria-hidden />
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={name}>
        <FullPhoto photo={photo} alt={name} />
      </Sheet>
    </>
  );
}

/** An Admin setting or replacing an item's Item Photo, on its edit page. */
export function ItemPhotoPicker({ itemId, photo }: { itemId: string; photo: string | null }) {
  return <ItemPhotoField photo={photo} save={(chosen) => setItemPhoto({ itemId, photo: chosen })} />;
}

/**
 * A clickable photo tile, uploaded at once and handed to `save`.
 */
export function ItemPhotoField({ photo, save }: { photo: string | null; save: (photo: string) => Promise<Saved> }) {
  const input = useRef<HTMLInputElement>(null);
  const { error, pending, upload } = usePhotoUpload();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={photo ? "Replace photo" : "Choose photo"}
          onClick={() => input.current?.click()}
          disabled={pending}
          className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line hover:border-ink hover:bg-hover disabled:opacity-60"
        >
          {photo ? <Photo photo={photo} size="small" alt="" className="size-full" /> : <ImagePlus size={28} strokeWidth={1.5} aria-hidden className="text-subtle" />}
        </button>
        {pending && <span role="status" className="text-[14px] text-subtle">Uploading…</span>}
        <input
          ref={input}
          type="file"
          accept={photoAccept}
          hidden
          aria-label="Item Photo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file, save);
          }}
        />
      </div>
      <FormError message={error} />
    </div>
  );
}

/** Photos of an item as it was used, newest first; anyone adds one. */
export function PastUsePhotos({
  itemId,
  pastUses,
  wentTo,
  viewer,
}: {
  itemId: string;
  pastUses: PastUse[];
  wentTo: WentTo[];
  viewer: { id: string; isAdmin: boolean };
}) {
  const [adding, setAdding] = useState(false);
  // The photo opened, and whether its deletion is being confirmed.
  const [opened, setOpened] = useState<{ id: string; deleting: boolean } | null>(null);
  const shown = pastUses.find((p) => p.id === opened?.id);
  const sheet = (deleting: boolean) => ({
    open: Boolean(shown) && opened?.deleting === deleting,
    onOpenChange: (open: boolean) => !open && setOpened(null),
  });
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col items-start gap-3">
        <h2 className="font-heading text-[18px] leading-6 font-medium">Past-use Photos</h2>
        <MainButton icon={Plus} type="button" onClick={() => setAdding(true)}>Add photo</MainButton>
      </div>
      {pastUses.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {pastUses.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpened({ id: p.id, deleting: false })}
                className="flex w-full flex-col gap-1 rounded-md text-left"
              >
                <Photo photo={p.photo} size="small" alt={p.note ?? ""} loading="lazy" className="aspect-square w-full rounded-md" />
                {p.event && <span className="truncate text-[13px] text-subtle">{p.event.name}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={adding} onOpenChange={setAdding} title="Add a photo">
        <AddPhotoForm itemId={itemId} wentTo={wentTo} onDone={() => setAdding(false)} />
      </Sheet>
      <Sheet {...sheet(false)} title={shown?.event?.name ?? "Photo"}>
        {shown && (
          <OpenedPhoto
            pastUse={shown}
            mayDelete={viewer.isAdmin || shown.by.id === viewer.id}
            onDelete={() => setOpened({ id: shown.id, deleting: true })}
          />
        )}
      </Sheet>
      <Sheet {...sheet(true)} title="Delete this photo?">
        {shown && <ConfirmDelete pastUseId={shown.id} onDone={() => setOpened(null)} />}
      </Sheet>
    </section>
  );
}

function AddPhotoForm({ itemId, wentTo, onDone }: { itemId: string; wentTo: WentTo[]; onDone: () => void }) {
  // Uploaded as soon as it's chosen, as an Item Photo is.
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) => {
    if (!photo) return setError("Choose a photo.");
    startTransition(async () => {
      setError(undefined);
      try {
        const saved = await addPastUsePhoto({
          itemId,
          photo,
          eventId: String(form.get("eventId") ?? ""),
          note: String(form.get("note") ?? ""),
        });
        if (saved.error) setError(saved.error);
        else onDone();
      } catch (e) {
        setError(inlineFailure(e));
      }
    });
  };

  return (
    <form action={submit} className="flex flex-col gap-5">
      <ItemPhotoField photo={photo} save={async (uploaded) => setPhoto(uploaded)} />
      {/* Only the Events it went to; none when it hasn't been anywhere yet. */}
      {wentTo.length > 0 && (
        <Select label="Event (optional)" name="eventId" defaultValue="">
          <option value="">No Event</option>
          {wentTo.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {formatDays(e.startsOn, e.endsOn)}
            </option>
          ))}
        </Select>
      )}
      <TextArea label="Note (optional)" name="note" className="min-h-20" />
      <FormError message={error} />
      <FormActions>
        <MainButton icon={Check} disabled={pending}>
          Add photo
        </MainButton>
      </FormActions>
    </form>
  );
}

function OpenedPhoto({ pastUse, mayDelete, onDelete }: { pastUse: PastUse; mayDelete: boolean; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <FullPhoto photo={pastUse.photo} alt={pastUse.note ?? ""} />
      {pastUse.note && <p className="whitespace-pre-line">{pastUse.note}</p>}
      <p className="text-[14px] text-subtle">
        {pastUse.event && (
          <>
            At{" "}
            {pastUse.eventDeleted ? pastUse.event.name : <Link href={`/events/${pastUse.event.id}`} className="text-cyan-ink hover:underline">
              {pastUse.event.name}
            </Link>}
            {" · "}
          </>
        )}
        Added by {pastUse.by.name} · {formatMoment(pastUse.addedAt)}
      </p>
      <div className="flex flex-wrap gap-3">
        {mayDelete && (
          <SecondaryButton type="button" onClick={onDelete}>
            Delete photo
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

// Worded and laid out as the Event's own confirmations are.
function ConfirmDelete({ pastUseId, onDone }: { pastUseId: string; onDone: () => void }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const remove = () =>
    startTransition(async () => {
      try {
        const result = await deletePastUsePhoto(pastUseId);
        if (result.error) setError(result.error);
        else onDone();
      } catch (error) {
        setError(inlineFailure(error));
      }
    });
  return (
    <div className="flex flex-col gap-5">
      <p>The photo is gone for good. This can&apos;t be undone.</p>
      <FormError message={error} />
      <FormActions>
        <MainButton icon={Trash2} onClick={remove} disabled={pending}>
          Delete photo
        </MainButton>
      </FormActions>
    </div>
  );
}

function FullPhoto({ photo, alt }: { photo: string; alt: string }) {
  return <Photo photo={photo} size="full" alt={alt} className="max-h-[60dvh] w-full rounded-md object-contain" />;
}
