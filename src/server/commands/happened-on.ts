import { z } from "zod";
import { todayInMuse } from "@/lib/time-zone";

// The day a Stock change happened: today unless it's recorded after the fact,
// and never a day still to come (ADR 0005).
export const happenedOn = z
  .iso.date("Enter the day it happened.")
  .refine((day) => day <= todayInMuse(), { message: "The day it happened can't be after today." })
  .optional();
