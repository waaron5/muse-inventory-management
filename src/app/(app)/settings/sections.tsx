import { Avatar } from "@/components/avatar";
import { AvatarColourSetting } from "@/components/avatar-colour-setting";
import { Badge } from "@/components/badge";
import { NameSetting } from "@/components/name-form";
import { PageColumn } from "@/components/page-column";
import { Row } from "@/components/row-list";
import { aiConnectionsOn } from "@/lib/ai-connections";
import { formatOn } from "@/lib/format";
import { appURL, currentSession } from "@/server/auth";
import { mcpResource } from "@/server/auth/create-auth";
import { loaders } from "@/server/loaders";
import { connection } from "next/server";
import { Invite } from "../users/invite";
import { PersonMenu } from "../users/person-menu";
import { AddClientButton, ClientMenu } from "../clients/client-menu";
import { AddLocationButton, LocationMenu } from "../locations/location-menu";
import { AddCategoryButton, CategoryMenu } from "../categories/category-menu";
import { AiConnectionMenu } from "./ai-connection-menu";
import { CardHeader, SettingsList } from "./settings-list";

/** Where Muse people read how to connect their AI app: the public copy of `docs/ai-connections.md`. */
const SETUP_NOTE = "https://github.com/waaron5/muse-inventory-management/blob/main/docs/ai-connections.md";

export async function SettingsCards() {
  await connection();
  const [session, { people }, { clients }, { locations }, { categories }] = await Promise.all([
    currentSession(), loaders.users(), loaders.clients(), loaders.locations(), loaders.categories(),
  ]);
  const isAdmin = session?.user.role === "admin";
  const withAiConnections = aiConnectionsOn();
  const [profileColour, aiConnections] = session
    ? await Promise.all([loaders.profileColour(session.user.id), withAiConnections ? loaders.aiConnections(session.user.id) : undefined])
    : [];
  const inUse = clients.filter((c) => !c.archived);
  return (
    <div className="flex flex-col gap-6">
      <PageColumn id="my-profile">
        <section aria-labelledby="profile-heading">
          <CardHeader id="profile-heading" title="My profile" />
          <div className="flex flex-col gap-6">
            <NameSetting name={session?.user.name ?? ""} />
            {profileColour && (
              <AvatarColourSetting
                key={profileColour.choice ?? "automatic"}
                name={session?.user.name ?? ""}
                {...profileColour}
              />
            )}
          </div>
        </section>
      </PageColumn>
      <PageColumn id="users">
        <SettingsList id="users-heading" title="Users" action={isAdmin && <Invite />} rows={people.map((person) => {
          const shown = person.name || person.email;
          const role = person.role === "admin" ? "Admin" : "User";
          return { key: person.id, text: shown, row: <Row lead={<Avatar name={shown} colour={person.avatarColour} />}
            name={<>{shown}{person.id === session?.user.id && <span className="font-normal text-subtle"> · You</span>}</>}
            detail={person.name ? `${role} · ${person.email}` : role} dimmed={!person.active}>
            {!person.active && <Badge tone="plain">Deactivated</Badge>}
            {isAdmin && person.id !== session?.user.id && <PersonMenu person={{ ...person, shown }} />}
          </Row> };
        })} />
      </PageColumn>
      <PageColumn id="clients">
        <SettingsList id="clients-heading" title="Clients" action={<AddClientButton />} search="Search Clients"
          rows={clients.map((client) => ({ key: client.id, text: client.name, row: <Row name={client.name}
            href={`/events?client=${client.id}`} lead={<span aria-hidden className={`client-${client.colour} size-3 shrink-0 rounded-full bg-(--client-accent)`} />}
            detail={client.events === 1 ? "1 Event" : `${client.events} Events`} dimmed={client.archived}>
            {client.archived && <Badge tone="plain">Archived</Badge>}
            <ClientMenu client={client} isAdmin={isAdmin} others={inUse.filter((c) => c.id !== client.id)} />
          </Row> }))} />
      </PageColumn>
      <PageColumn id="locations">
        <SettingsList id="locations-heading" title="Locations" action={<AddLocationButton />}
          rows={locations.map((location) => ({ key: location.id, text: location.name, row: <Row name={location.name}
            href={`/inventory?location=${location.id}`} detail={location.holds === 0 ? "Holds nothing" : `Holds ${location.holds}`}>
            {isAdmin && <LocationMenu location={location} />}
          </Row> }))} />
      </PageColumn>
      <PageColumn id="categories">
        <SettingsList id="categories-heading" title="Categories" action={<AddCategoryButton />}
          rows={categories.map((category) => ({ key: category.id, text: category.name, row: <Row name={category.name}
            href={`/inventory?category=${category.id}`} detail={category.items === 1 ? "1 Inventory Item" : `${category.items} Inventory Items`}>
            {isAdmin && <CategoryMenu category={category} />}
          </Row> }))} />
      </PageColumn>
      {withAiConnections && <PageColumn id="ai-connections">
        <SettingsList id="ai-connections-heading" title="AI Connections"
          empty={<p className="text-subtle">
            To work in Muse Inventory from Claude, ChatGPT or Grok, add a custom connector in it with the
            address <span className="select-all font-medium text-ink">{mcpResource(appURL)}</span>.{" "}
            <a href={SETUP_NOTE} target="_blank" rel="noreferrer" className="text-cyan-ink underline">How to connect</a>
          </p>}
          rows={(aiConnections?.connections ?? []).map((connection) => ({ key: connection.clientId, text: connection.appName,
            row: <Row name={connection.appName}
              detail={`Connected ${formatOn(connection.connectedAt)} · Last used ${formatOn(connection.lastUsedAt)}`}>
              <AiConnectionMenu connection={connection} />
            </Row> }))} />
      </PageColumn>}
    </div>
  );
}
