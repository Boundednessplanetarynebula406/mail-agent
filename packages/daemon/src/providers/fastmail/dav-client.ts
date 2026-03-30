import { XMLParser } from "fast-xml-parser";

type DavCredentials = {
  username: string;
  password: string;
};

type DavResponse = {
  href: string;
  props: Record<string, unknown>;
};

type FastmailDavKind = "caldav" | "carddav";

export type FastmailDavHomes = {
  principalUrl: string;
  calendarHomeSetUrl: string;
  addressBookHomeSetUrl: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function encodeBasicAuth(credentials: DavCredentials): string {
  return Buffer.from(`${credentials.username}:${credentials.password}`, "utf8").toString("base64");
}

function firstHref(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const href = firstHref(item);
      if (href) {
        return href;
      }
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.href === "string") {
      return record.href;
    }
  }

  return undefined;
}

export class FastmailDavClient {
  private discovery?: FastmailDavHomes;

  constructor(
    private readonly baseUrl: string,
    private readonly credentials: DavCredentials
  ) {}

  private async rawRequest(url: string, options: RequestInit): Promise<Response> {
    return await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${encodeBasicAuth(this.credentials)}`,
        ...options.headers
      }
    });
  }

  private async request(url: string, options: RequestInit): Promise<string> {
    const response = await this.rawRequest(url, options);

    if (!response.ok) {
      throw new Error(`DAV request failed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  async propfind(pathname: string, body: string, depth = "1"): Promise<DavResponse[]> {
    const xml = await this.request(new URL(pathname, this.baseUrl).toString(), {
      method: "PROPFIND",
      headers: {
        Depth: depth,
        "Content-Type": "application/xml; charset=utf-8"
      },
      body
    });

    return parseMultiStatus(xml);
  }

  async report(pathname: string, body: string, depth = "1"): Promise<DavResponse[]> {
    const xml = await this.request(new URL(pathname, this.baseUrl).toString(), {
      method: "REPORT",
      headers: {
        Depth: depth,
        "Content-Type": "application/xml; charset=utf-8"
      },
      body
    });

    return parseMultiStatus(xml);
  }

  async discoverHomes(kind: FastmailDavKind): Promise<FastmailDavHomes> {
    if (this.discovery) {
      return this.discovery;
    }

    const baseCollectionPath = await this.resolveWellKnownCollectionPath(kind);
    const principalResponses = await this.propfind(
      baseCollectionPath,
      `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`,
      "0"
    );
    const principalUrl = firstHref(principalResponses[0]?.props["current-user-principal"]);

    if (!principalUrl) {
      throw new Error(`DAV discovery did not return current-user-principal for ${kind}.`);
    }

    const homeResponses = await this.propfind(
      principalUrl,
      `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <c:calendar-home-set />
    <card:addressbook-home-set />
  </d:prop>
</d:propfind>`,
      "0"
    );
    const props = homeResponses[0]?.props ?? {};
    const calendarHomeSetUrl = firstHref(props["calendar-home-set"]);
    const addressBookHomeSetUrl = firstHref(props["addressbook-home-set"]);

    if (!calendarHomeSetUrl || !addressBookHomeSetUrl) {
      throw new Error(`DAV discovery did not return both home sets for ${kind}.`);
    }

    this.discovery = {
      principalUrl,
      calendarHomeSetUrl,
      addressBookHomeSetUrl
    };
    return this.discovery;
  }

  private async resolveWellKnownCollectionPath(kind: FastmailDavKind): Promise<string> {
    const wellKnownPath = kind === "caldav" ? "/.well-known/caldav" : "/.well-known/carddav";
    const response = await this.rawRequest(new URL(wellKnownPath, this.baseUrl).toString(), {
      method: "GET",
      redirect: "manual"
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`DAV discovery redirect for ${kind} did not include a Location header.`);
      }
      return new URL(location, this.baseUrl).pathname;
    }

    if (response.ok) {
      return new URL(response.url).pathname;
    }

    throw new Error(`DAV well-known discovery failed for ${kind}: ${response.status} ${response.statusText}`);
  }
}

function parseMultiStatus(xml: string): DavResponse[] {
  const parsed = parser.parse(xml) as { multistatus?: { response?: unknown } };
  const responses = asArray(parsed.multistatus?.response);

  return responses.flatMap((response) => {
    if (!response || typeof response !== "object") {
      return [];
    }

    const href = (response as Record<string, unknown>).href;
    const propstats = asArray((response as Record<string, unknown>).propstat);
    const props = Object.assign({}, ...propstats.map((propstat) => {
      if (!propstat || typeof propstat !== "object") {
        return {};
      }
      return ((propstat as Record<string, unknown>).prop ?? {}) as Record<string, unknown>;
    }));

    if (typeof href !== "string") {
      return [];
    }

    return [{ href, props }];
  });
}
