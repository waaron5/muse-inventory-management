"use client";

import { Unplug } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { Confirm } from "@/components/confirm";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import type { AiConnectionShown } from "@/server/loaders";
import { disconnectAiConnection } from "./actions";

/** One of your own AI Connections' "⋯": Disconnect, which its app feels on its next call. */
export function AiConnectionMenu({ connection }: { connection: Pick<AiConnectionShown, "clientId" | "appName"> }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <MoreTrigger label={`More for ${connection.appName}`} />
        <MenuContent align="end">
          <MenuItem onSelect={() => setAsking(true)}><Unplug {...menuIcon} />Disconnect</MenuItem>
        </MenuContent>
      </DropdownMenu.Root>

      <Sheet open={asking} onOpenChange={setAsking} title={`Disconnect ${connection.appName}?`}>
        <Confirm action={disconnectAiConnection} fields={{ clientId: connection.clientId }} onDone={() => setAsking(false)}
          explain="It stops working in Muse Inventory at once. To use it again, connect it again from the app."
          button={{ icon: Unplug, label: "Disconnect" }} />
      </Sheet>
    </>
  );
}
