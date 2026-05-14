"use client";

interface DetailHeaderActionsProps {
  title: string;
  isEditing: boolean;
  formId: string;
  loading?: boolean;
  deleting?: boolean;
  hideDeleteWhenEditing?: boolean;
  deleteLabel?: string;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function DetailHeaderActions({
  title,
  isEditing,
  formId,
  loading = false,
  deleting = false,
  hideDeleteWhenEditing = false,
  deleteLabel = "Delete",
  onEdit,
  onCancel,
  onDelete,
}: DetailHeaderActionsProps) {
  return (
    <div className="detail-topbar-actions">
      {isEditing ? (
        <>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-dark" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
          {!hideDeleteWhenEditing && (
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled
              aria-label={`${deleteLabel} ${title}`}
              title={`${deleteLabel} ${title}`}
            >
              <TrashIcon />
              {deleteLabel}
            </button>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onEdit}
            disabled={deleting}
            aria-label={`Edit ${title}`}
          >
            <EditIcon />
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`${deleteLabel} ${title}`}
            title={`${deleteLabel} ${title}`}
          >
            {deleting ? <span aria-hidden="true">...</span> : <TrashIcon />}
            {deleteLabel}
          </button>
        </>
      )}
    </div>
  );
}

export function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
