type Column = { name: string; type: string; key?: "PK" | "FK" | "FK U" };
type Table = { name: string; columns: Column[]; links: string };

// Mirrors src/server/db/schema.ts. Kept as data so the page stays a plain server component.
const tables: Table[] = [
  {
    name: "event",
    links: "Has many locations, shifts and audit_log rows",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "name", type: "varchar" },
      { name: "venue", type: "varchar" },
      { name: "starts_on", type: "date" },
      { name: "timezone", type: "varchar" },
    ],
  },
  {
    name: "location",
    links: "Belongs to an event, hosts many shifts",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "event_id", type: "int", key: "FK" },
      { name: "name", type: "varchar" },
      { name: "sort_order", type: "int" },
    ],
  },
  {
    name: "shift",
    links: "Belongs to an event, a location and a role",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "event_id", type: "int", key: "FK" },
      { name: "location_id", type: "int", key: "FK" },
      { name: "role_id", type: "int", key: "FK" },
      { name: "starts_at", type: "datetime" },
      { name: "ends_at", type: "datetime" },
      { name: "slots", type: "int" },
      { name: "version", type: "int" },
    ],
  },
  {
    name: "assignment",
    links: "One person on one shift, unique per pair",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "shift_id", type: "int", key: "FK U" },
      { name: "staff_id", type: "int", key: "FK U" },
      { name: "override_reason", type: "varchar" },
      { name: "created_by", type: "varchar" },
      { name: "created_at", type: "datetime(3)" },
    ],
  },
  {
    name: "staff",
    links: "Has a primary role and many licences",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "name", type: "varchar" },
      { name: "role_id", type: "int", key: "FK" },
      { name: "weekly_hour_limit", type: "int" },
    ],
  },
  {
    name: "licence",
    links: "SIA licences, checked against the shift date",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "staff_id", type: "int", key: "FK" },
      { name: "kind", type: "varchar" },
      { name: "expires_on", type: "date" },
    ],
  },
  {
    name: "role",
    links: "Steward, bar staff, security, car park, supervisor",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "name", type: "varchar" },
      { name: "requires_sia", type: "bool" },
    ],
  },
  {
    name: "shift_request",
    links: "A worker asking for an open place, unique per pair",
    columns: [
      { name: "id", type: "int", key: "PK" },
      { name: "shift_id", type: "int", key: "FK U" },
      { name: "staff_id", type: "int", key: "FK U" },
      { name: "status", type: "enum" },
    ],
  },
  {
    name: "audit_log",
    links: "Every assign, remove, edit and override, with who did it",
    columns: [
      { name: "id", type: "bigint", key: "PK" },
      { name: "event_id", type: "int", key: "FK" },
      { name: "actor", type: "varchar" },
      { name: "action", type: "varchar" },
      { name: "payload", type: "json" },
    ],
  },
];

export function DataModel() {
  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((t) => (
        <figure key={t.name} className="rounded-4 border border-strong/40">
          <figcaption className="px-4 pb-2 pt-3">
            <p className="text-14 font-semibold text-ink">{t.name}</p>
            <p className="text-12 text-muted">{t.links}</p>
          </figcaption>
          <table className="w-full text-14">
            <caption className="sr-only">Columns of {t.name}</caption>
            <tbody>
              {t.columns.map((c) => (
                <tr key={c.name} className="border-t border-hairline">
                  <th scope="row" className={`px-4 py-1.5 text-left ${c.key === "PK" ? "font-medium" : "font-normal"} text-ink`}>
                    {c.name}
                  </th>
                  <td className="py-1.5 text-right text-12 font-medium text-accent">{c.key ?? ""}</td>
                  <td className="px-4 py-1.5 text-right text-12 text-muted">{c.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      ))}
    </div>
  );
}
