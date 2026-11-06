"use server";

import { APIError } from "better-auth/api";
import { aiConnectionsOn } from "@/lib/ai-connections";
import { answerConnecting } from "@/server/ai";

export type AllowState = { error?: string; returnTo?: string };

/** Allow or Cancel on the Allow screen: where the browser goes back to the AI app. */
export async function answerAllow(_state: AllowState, form: FormData): Promise<AllowState> {
  if (!aiConnectionsOn()) return { error: "AI Connections are off." };
  try {
    return { returnTo: await answerConnecting(String(form.get("request") ?? ""), form.get("intent") === "allow") };
  } catch (error) {
    if (error instanceof APIError) return { error: "This request has expired. Go back to your AI app and connect again." };
    throw error;
  }
}
