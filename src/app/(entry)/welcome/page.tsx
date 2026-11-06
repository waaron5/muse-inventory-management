import type { Metadata } from "next";
import { EntryCard, EntryHeading } from "@/components/entry";
import { NameForm } from "@/components/name-form";

export const metadata: Metadata = { title: "Your name" };

// Asked once, at first sign-in; the proxy sends anyone without a name here.
export default function WelcomePage() {
  return (
    <EntryCard>
      <EntryHeading>What&rsquo;s your name?</EntryHeading>
      <p className="mt-1 mb-5 text-subtle">It shows beside every change you make.</p>
      <NameForm />
    </EntryCard>
  );
}
