"use client";

import * as Sentry from "@sentry/nextjs";
import { Send, Upload } from "lucide-react";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { reportBug } from "@/app/(app)/_bug-report/actions";
import { couldNotSend, screenshotLimit, screenshotRefused } from "@/lib/bug-report";
import { lastError, type PageError } from "@/lib/last-error";
import { photoEdge } from "@/lib/photos";
import { jpegOf, photoAccept, uploadFailureMessage } from "@/lib/upload-photo";
import type { BugReportState } from "@/server/bug-report";
import { buttonClass, FormActions, MainButton, SecondaryButton } from "./button";
import { FormError, TextArea } from "./form";
import { Sheet } from "./sheet";

/**
 * Report a bug: what happened, and an optional screenshot, emailed to the
 * maintainer. `error` is the one met on the error page (Report this);
 * otherwise the last error on the page goes with it, if any.
 */
export function BugReportSheet({
  open,
  onOpenChange,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: PageError;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Report a bug">
      <BugReportForm error={error} />
    </Sheet>
  );
}

// Held in state, not left to the form, so a failed send keeps the text and screenshot.
function BugReportForm({ error }: { error?: PageError }) {
  const [what, setWhat] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [state, setState] = useState<BugReportState>({});
  const [pending, startTransition] = useTransition();
  const picker = useRef<HTMLInputElement>(null);

  if (state.sent) {
    return <p role="status">Sent, thanks.</p>;
  }

  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const form = new FormData();
      form.set("what", what);
      form.set("page", window.location.href);
      const met = error ?? lastError();
      if (met) {
        form.set("lastError", met.message);
        if (met.trackerId) form.set("trackerId", met.trackerId);
      }
      try {
        if (screenshot) form.set("screenshot", await jpegOf(screenshot, photoEdge.full), "screenshot.jpg");
        setState(await reportBug(form));
      } catch (failure) {
        // A file that can't be opened is the person's to fix; any other failure is reported.
        const message = uploadFailureMessage(failure, couldNotSend);
        if (message === couldNotSend) Sentry.captureException(failure);
        setState({ error: message });
      }
    });
  }

  function pick(file: File | undefined) {
    if (!file) return;
    if (file.size >= screenshotLimit) {
      setState({ error: screenshotRefused });
      return;
    }
    setState({});
    setScreenshot(file);
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-5">
      <TextArea label="What happened?" value={what} onChange={(e) => setWhat(e.target.value)} autoFocus required />
      <div className="flex flex-col gap-1.5">
        {screenshot ? (
          <div className="flex min-h-11 items-center gap-3">
            <span className="min-w-0 flex-1 truncate">{screenshot.name}</span>
            <button type="button" onClick={() => setScreenshot(null)} className={buttonClass("plain", "-mr-2 px-3")}>
              Remove
            </button>
          </div>
        ) : (
          <SecondaryButton type="button" onClick={() => picker.current?.click()} className="self-start">
            <Upload size={18} aria-hidden /> Upload screenshot
          </SecondaryButton>
        )}
        <input
          ref={picker}
          type="file"
          accept={photoAccept}
          hidden
          aria-label="Screenshot"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <FormError message={state.error} />
      <FormActions>
        <MainButton icon={Send} disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </MainButton>
      </FormActions>
    </form>
  );
}
