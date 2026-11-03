import type { Metadata } from "next";
import { isDemo } from "@/lib/demo";
import { mailGoesToOutbox } from "@/server/mail";
import { DemoSignInForm, SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="sr-only">Sign in</h1>
      {isDemo() ? <DemoSignInForm /> : <SignInForm toOutbox={mailGoesToOutbox()} />}
    </>
  );
}
