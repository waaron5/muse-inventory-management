import { Box, Calendar, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { type PhotoSize, photoSrc } from "@/lib/photos";
import { cn } from "@/lib/utils";

// What leads every list row: the item's photo, or a bare icon for what kind of thing the row is.

function Thumb({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center", className)}>
      <Icon size={20} strokeWidth={1.75} className="text-subtle" />
    </span>
  );
}

/**
 * A stored photo. Photos are private, served only to signed-in people, so
 * they can't go through next/image's optimizer; each comes at two sizes instead.
 */
export function Photo({
  photo,
  size,
  alt,
  className,
  ...img
}: ComponentProps<"img"> & { photo: string; size: PhotoSize; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img src={photoSrc(photo, size)} alt={alt} decoding="async" className={cn("bg-fill object-cover", className)} {...img} />
  );
}

/** The Item Photo's place in a list or header; a box until it has one. */
export function ItemThumb({ photo, className }: { photo?: string | null; className?: string }) {
  if (!photo) return <Thumb icon={Box} className={className} />;
  return <Photo photo={photo} size="small" alt="" loading="lazy" className={cn("size-10 shrink-0 rounded-md", className)} />;
}

export function EventThumb({ className }: { className?: string }) {
  return <Thumb icon={Calendar} className={className} />;
}
