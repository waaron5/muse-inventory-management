import type { Metadata } from "next";
import { NameForm } from "@/components/name-form";

export const metadata: Metadata = { title: "Your name" };

// Asked once, at first sign-in; the proxy sends anyone without a name here.
export default function WelcomePage() {
  return (
    <>
      <h1 className="mb-2 font-heading text-[30px] leading-[38px] font-medium tracking-[-0.01em]">
        What&rsquo;s your name?
      </h1>
      <p className="mb-8 text-subtle">It shows on everything you load, return and change.</p>
      <NameForm />
    </>
  );
}
