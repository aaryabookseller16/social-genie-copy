import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "cancelled"
  | "past_due";

export type StoredUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password_hash: string;
  membership: "free" | "vibee";
  subscription_status: SubscriptionStatus;
  pending_checkout_session_id?: string | null;
  pending_checkout_started_at?: number | null;
  saved_venue_ids: number[];
  vendor_id?: number | null;
  created_at: number;
};

export type StoredVendor = {
  id: number;
  user_id: number;
  venue_id?: number | null;
  business_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  address?: string;
  city_state_zip?: string;
  is_manual_entry: boolean;
  claim_status: "submitted" | "approved" | "rejected";
  selected_plan_id?: string | null;
  location_enabled?: boolean | null;
  profile: {
    description?: string;
    phone?: string;
    website_url?: string;
    reservation_url?: string;
    hours?: string;
    image_primary_url?: string;
  };
  dashboard: {
    views: number;
    clicks: number;
    saves: number;
    genie_appearances: number;
  };
  created_at: number;
};

export type StoredAnalyticsEvent = {
  id: number;
  event: string;
  user_id?: number;
  venue_id?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

type ApiStore = {
  next_ids: {
    user: number;
    vendor: number;
    analytics: number;
  };
  users: StoredUser[];
  vendors: StoredVendor[];
  analytics: StoredAnalyticsEvent[];
};

const STORE_PATH = path.join(
  process.cwd(),
  ".next",
  "cache",
  "genie-api-store.json"
);

function createEmptyStore(): ApiStore {
  return {
    next_ids: {
      user: 1,
      vendor: 1,
      analytics: 1,
    },
    users: [],
    vendors: [],
    analytics: [],
  };
}

async function ensureStoreFile() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeFile(STORE_PATH, JSON.stringify(createEmptyStore(), null, 2));
  }
}

export async function readApiStore(): Promise<ApiStore> {
  await ensureStoreFile();
  const raw = await readFile(STORE_PATH, "utf8");

  try {
    return JSON.parse(raw) as ApiStore;
  } catch {
    const empty = createEmptyStore();
    await writeFile(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

export async function writeApiStore(store: ApiStore) {
  await ensureStoreFile();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

// Serialise all store mutations so concurrent requests cannot corrupt the
// JSON file or silently overwrite each other's changes.
let storeWriteQueue: Promise<unknown> = Promise.resolve();

export async function updateApiStore<T>(
  updater: (store: ApiStore) => T | Promise<T>
): Promise<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  storeWriteQueue = storeWriteQueue.then(async () => {
    try {
      const store = await readApiStore();
      const result = await updater(store);
      await writeApiStore(store);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });

  return promise;
}

export function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone ?? null,
    membership: user.membership,
    subscription_status: user.subscription_status,
    vendor_id: user.vendor_id ?? null,
  };
}

export function nextStoreId(
  store: ApiStore,
  key: keyof ApiStore["next_ids"]
) {
  const current = store.next_ids[key];
  store.next_ids[key] += 1;
  return current;
}

export function findStoredUserByEmail(store: ApiStore, email: string) {
  const normalized = email.trim().toLowerCase();
  return store.users.find((user) => user.email.toLowerCase() === normalized);
}

export function findStoredVendorByVenueId(store: ApiStore, venueId: number) {
  return store.vendors.find((vendor) => vendor.venue_id === venueId);
}
