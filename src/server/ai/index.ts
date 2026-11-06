import "server-only";
import { headers } from "next/headers";
import { db } from "@/db";
import { aiConnectionsOn } from "@/lib/ai-connections";
import { appURL, auth } from "../auth";
import { inviteMailerFromEnv } from "../mail";
import { answerConnectRequest, continueAfterSignIn, readConnectRequest } from "./connect";
import { aiEndpoints } from "./endpoints";

/** AI Connections' HTTP side (ADR 0017), bound to the app's database and auth. */
export const ai = aiEndpoints({ db, auth, enabled: () => aiConnectionsOn(), sendInvite: inviteMailerFromEnv(appURL) });

/** Where sign-in goes next when it was reached while connecting an AI app; null otherwise. */
export async function continueConnecting(search: string) {
  if (!search || !aiConnectionsOn()) return null;
  return continueAfterSignIn(auth, search);
}

/** The Allow screen's request, for the signed-in person; null when it can't be trusted. */
export async function readConnecting(params: URLSearchParams) {
  return readConnectRequest(auth, params, await headers());
}

/** Allow or Cancel, as the signed-in person: the app's address to return to. */
export async function answerConnecting(search: string, accept: boolean) {
  return answerConnectRequest(auth, await headers(), search, accept);
}
