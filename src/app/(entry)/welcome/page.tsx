import type { Metadata } from "next";
import { EntryCard } from "@/components/entry";
import { NameForm } from "@/components/name-form";

export const metadata: Metadata = { title: "Your name" };

// Asked once, at first sign-in; the proxy sends anyone without a name here.
export default function WelcomePage() {
  return (
    <EntryCard>
      <h1 className="font-heading text-[24px] leading-[32px] font-semibold tracking-[-0.01em]">What&rsquo;s your name?</h1>
      <p className="mt-1 mb-5 text-subtle">It shows beside every change you make.</p>
      <NameForm />
    </EntryCard>
  );
}
