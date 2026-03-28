/**
 * api.ts — PixelStudio API Client
 *
 * Multi-tenant JWT API client. Studio slug is required at login and stored
 * in localStorage. All subsequent requests use the JWT (which carries studioId).
 */

const BASE_URL = "";

const TOKEN_KEY          = "ps_token";
const PLATFORM_TOKEN_KEY = "ps_platform_token";
const STUDIO_SLUG_KEY    = "studio_slug";
const STUDIO_NAME_KEY    = "studio_name";
const STUDIO_LOGO_KEY    = "studio_logo";
const STUDIO_PLAN_KEY    = "studio_plan";
const STUDIO_ID_KEY      = "studio_id";

// ─── Image URL helper ──────────────────────────────────────────────────────────

export function getImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("data:")) return imageUrl;
  const base = BASE_URL.replace(/\/$/, "");
  const p    = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${p}`;
}

// ─── Token helpers ─────────────────────────────────────────────────────────────

const isBrowser = typeof window !== "undefined";
const ls = {
  get:    (k: string) => isBrowser ? localStorage.getItem(k)        : null,
  set:    (k: string, v: string) => { if (isBrowser) localStorage.setItem(k, v); },
  remove: (k: string) => { if (isBrowser) localStorage.removeItem(k); },
};

export function saveToken(token: string): void { ls.set(TOKEN_KEY, token); }
export function getToken(): string | null       { return ls.get(TOKEN_KEY); }
export function clearToken(): void              { ls.remove(TOKEN_KEY); }
export function isLoggedIn(): boolean           { return getToken() !== null; }

export function savePlatformToken(token: string): void { ls.set(PLATFORM_TOKEN_KEY, token); }
export function getPlatformToken(): string | null       { return ls.get(PLATFORM_TOKEN_KEY); }
export function clearPlatformToken(): void              { ls.remove(PLATFORM_TOKEN_KEY); }

// ─── Studio helpers ────────────────────────────────────────────────────────────

export function getStudioSlug(): string | null { return ls.get(STUDIO_SLUG_KEY); }
export function getStudioName(): string        { return ls.get(STUDIO_NAME_KEY) ?? "PixelStudio"; }
export function getStudioLogo(): string | null { return ls.get(STUDIO_LOGO_KEY); }
export function getStudioPlan(): string        { return ls.get(STUDIO_PLAN_KEY) ?? "free"; }

export function saveStudioInfo(studio: { id?: string; slug: string; name: string; logoUrl?: string | null; plan: string }) {
  ls.set(STUDIO_SLUG_KEY, studio.slug);
  ls.set(STUDIO_NAME_KEY, studio.name);
  ls.set(STUDIO_PLAN_KEY, studio.plan);
  if (studio.id)      ls.set(STUDIO_ID_KEY,   studio.id);
  if (studio.logoUrl) ls.set(STUDIO_LOGO_KEY, studio.logoUrl);
  else                ls.remove(STUDIO_LOGO_KEY);
}

export function clearStudioInfo() {
  [STUDIO_SLUG_KEY, STUDIO_NAME_KEY, STUDIO_LOGO_KEY, STUDIO_PLAN_KEY, STUDIO_ID_KEY].forEach(k => ls.remove(k));
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token   = getToken();
  const headers = new Headers(options.headers);

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  let data: unknown;
  try   { data = await response.json(); }
  catch { data = null; }

  if (!response.ok) {
    const message = (data as { message?: string })?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (data as { data?: T })?.data as T;
}

async function platformApiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token   = getPlatformToken();
  const headers = new Headers(options.headers);

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  let data: unknown;
  try   { data = await response.json(); }
  catch { data = null; }

  if (!response.ok) {
    const message = (data as { message?: string })?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (data as { data?: T })?.data as T;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "staff" | "superadmin";

export interface AuthUser {
  id:        string;
  name:      string;
  email:     string;
  phone:     string;
  role:      "admin" | "staff";
  studioId:  string | null;
  isActive:  boolean;
  createdAt: string | null;
}

export interface StudioInfo {
  id:      string;
  name:    string;
  slug:    string;
  logoUrl: string | null;
  phone:   string | null;
  address: string | null;
  email:   string | null;
  plan:    "free" | "pro";
}

export interface StaffMember {
  id:        string;
  name:      string;
  email:     string;
  phone:     string;
  role:      "STAFF";
  isActive:  boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id:            string;
  clientName:    string;
  phone:         string;
  price:         string;
  deposit:       string;
  photoFormat:   "SOFTCOPY" | "HARDCOPY" | "BOTH";
  paymentStatus: "PENDING" | "PAID";
  orderStatus:   "PENDING" | "EDITING" | "READY" | "DELIVERED";
  notes:         string | null;
  galleryToken:  string;
  createdAt:     string;
  createdBy?:    { id: string; name: string; email: string };
  invoices?:     Invoice[];
  gallery?:      { photos: Photo[] };
}

export interface Invoice {
  id:            string;
  invoiceNumber: string;
  amount:        string;
  paymentStatus: "PENDING" | "PAID";
  createdAt:     string;
  client?: {
    id:          string;
    clientName:  string;
    phone:       string;
    price:       string;
    photoFormat: Client["photoFormat"];
    orderStatus: Client["orderStatus"];
  };
  createdBy?: { id: string; name: string; email: string; phone: string };
  studio?:    { name: string; address: string; logoUrl?: string | null };
}

export interface Payment {
  id:        string;
  amount:    string;
  status:    "PENDING" | "PAID";
  createdAt: string;
  client?:   { id: string; clientName: string; phone: string };
  receivedBy?: { id: string; name: string };
}

export interface Photo {
  id:        string;
  imageUrl:  string;
  fileName:  string;
  createdAt: string;
}

export interface UploadResult {
  client: {
    id: string; clientName: string; phone: string;
    orderStatus: Client["orderStatus"]; paymentStatus: Client["paymentStatus"]; galleryToken: string;
  };
  gallery:    { id: string; token: string; url: string };
  photoCount: number;
  photos:     Photo[];
}

export interface GalleryView {
  studioName:       string;
  studioLogoUrl:    string | null;
  clientName:       string;
  photographerName: string;
  galleryToken:     string;
  galleryUrl:       string;
  orderStatus:      Client["orderStatus"];
  createdAt:        string;
  photoCount:       number;
  photos:           Photo[];
}

export interface AdminDashboardData {
  stats: {
    totalStaff: number; totalClients: number; totalPhotos: number;
    totalRevenue: number; totalPaid: number; totalPending: number;
    pendingPaymentsCount: number; totalGalleries: number;
  };
  recentClients:  Array<{
    id: string; clientName: string; phone: string; price: string;
    photoFormat: Client["photoFormat"]; orderStatus: Client["orderStatus"];
    paymentStatus: Client["paymentStatus"]; createdAt: string;
    createdBy: { id: string; name: string };
  }>;
  recentPayments: Array<{
    id: string; amount: string; status: Payment["status"]; createdAt: string;
    client: { id: string; clientName: string }; receivedBy: { id: string; name: string };
  }>;
}

export interface StaffDashboardData {
  stats: {
    totalClients: number; pendingEditingCount: number; readyForUploadCount: number;
    uploadedGalleriesCount: number; totalRevenue: number; totalPaid: number; totalPending: number;
  };
  recentClients:  Array<{
    id: string; clientName: string; phone: string;
    orderStatus: Client["orderStatus"]; paymentStatus: Client["paymentStatus"]; createdAt: string;
  }>;
  recentPayments: Array<{
    id: string; amount: string; status: Payment["status"]; createdAt: string;
    client: { id: string; clientName: string };
  }>;
}

// ─── 1. Authentication ─────────────────────────────────────────────────────────

export async function login(
  email:       string,
  password:    string,
  role:        UserRole,
  studioSlug?: string
): Promise<{ token: string; user: AuthUser; studio: StudioInfo | null }> {
  const body: Record<string, string> = { email, password, role };
  if (studioSlug) body.studioSlug = studioSlug;
  const result = await apiFetch<{ token: string; user: AuthUser; studio: StudioInfo | null }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(body) }
  );
  saveToken(result.token);
  if (result.studio) saveStudioInfo(result.studio);
  return result;
}

export async function platformLogin(
  email:    string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const result = await apiFetch<{ token: string; user: AuthUser; studio: null }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password, role: "superadmin" }) }
  );
  savePlatformToken(result.token);
  return result;
}

// ─── Platform (superadmin) ────────────────────────────────────────────────────

export interface PlatformStudio {
  id:                 string;
  name:               string;
  slug:               string;
  logoUrl:            string | null;
  plan:               "free" | "pro";
  isActive:           boolean;
  subscriptionStatus: "active" | "trial" | "expired";
  trialEndsAt:        string | null;
  createdAt:          string;
  _stats: { staffCount: number; clientCount: number; photoCount: number; invoiceCount: number; revenue: number };
  _admin: { name: string; email: string } | null;
}

export interface PlatformStats {
  totalStudios:     number;
  activeStudios:    number;
  suspendedStudios: number;
  proStudios:       number;
  freeStudios:      number;
  totalUsers:       number;
  totalClients:     number;
  totalPhotos:      number;
  totalRevenue:     number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  return platformApiFetch<PlatformStats>("/api/platform/stats");
}

export async function getPlatformStudios(): Promise<PlatformStudio[]> {
  return platformApiFetch<PlatformStudio[]>("/api/platform/studios");
}

export async function createPlatformStudio(data: {
  name: string; slug: string; adminName: string;
  adminEmail: string; adminPassword: string; plan?: "free" | "pro";
}): Promise<PlatformStudio> {
  return platformApiFetch<PlatformStudio>("/api/platform/studios", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

export async function updatePlatformStudio(
  id: string,
  data: {
    isActive?: boolean; plan?: "free" | "pro"; name?: string; slug?: string;
    subscriptionStatus?: "active" | "trial" | "expired"; trialEndsAt?: string | null;
  }
): Promise<PlatformStudio> {
  return platformApiFetch<PlatformStudio>(`/api/platform/studios/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(data),
  });
}

export async function deletePlatformStudio(id: string): Promise<void> {
  await platformApiFetch(`/api/platform/studios/${id}`, { method: "DELETE" });
}

export interface ImpersonateResult {
  token:  string;
  studio: { id: string; name: string; slug: string; plan: string };
  user:   { id: string; name: string; email: string; role: string };
}

export async function impersonateStudio(id: string): Promise<ImpersonateResult> {
  return platformApiFetch<ImpersonateResult>(`/api/platform/studios/${id}/impersonate`, { method: "POST" });
}

export function startImpersonation(result: ImpersonateResult): void {
  saveToken(result.token);
  ls.set("role",                    "admin");
  ls.set("user_name",               result.user.name);
  ls.set("user_id",                 result.user.id);
  ls.set("user_email",              result.user.email);
  ls.set("studio_id",               result.studio.id);
  ls.set("studio_name",             result.studio.name);
  ls.set("studio_slug",             result.studio.slug);
  ls.set("studio_plan",             result.studio.plan);
  ls.set("ps_impersonating",        "1");
  ls.set("ps_impersonating_studio", result.studio.name);
}

export interface ActivityLogEntry {
  id:          string;
  studioId:    string;
  studioName?: string;
  studioSlug?: string;
  userId:      string;
  userName:    string;
  userRole:    string;
  action:      string;
  entityType:  string | null;
  entityId:    string | null;
  entityName:  string | null;
  createdAt:   string;
}

export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  return apiFetch<ActivityLogEntry[]>("/api/activity");
}

export async function getPlatformActivity(): Promise<ActivityLogEntry[]> {
  return platformApiFetch<ActivityLogEntry[]>("/api/platform/activity");
}

export interface PlatformAnalytics {
  revenueByMonth:      Array<{ month: string; total: number }>;
  studioGrowthByMonth: Array<{ month: string; newStudios: number }>;
  topStudios:          Array<{ studioId: string; studioName: string; studioSlug: string; plan: string; revenue: number }>;
  activeVsInactive:    { active: number; inactive: number };
  totalRevenue:        number;
  totalInvoices:       number;
  paidInvoices:        number;
  pendingInvoices:     number;
  avgRevenuePerStudio: number;
}

export interface PlatformNotification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  studioId?: string | null;
  createdAt: string;
  read?:     boolean;
}

export async function getPlatformNotifications(): Promise<PlatformNotification[]> {
  return platformApiFetch<PlatformNotification[]>("/api/platform/notifications");
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  return platformApiFetch<PlatformAnalytics>("/api/platform/analytics");
}

export interface SystemHealth {
  status:    string;
  database:  { status: string; latencyMs: number };
  server:    { uptime: number; uptimeHuman: string };
  memory:    { heapUsedMb: number; rss: number };
  checkedAt: string;
}

export async function getPlatformHealth(): Promise<SystemHealth> {
  return platformApiFetch<SystemHealth>("/api/platform/health");
}

export async function exportStudiosCSV(): Promise<void> {
  const token = getPlatformToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch("/api/platform/export/studios", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.setAttribute("download", `studios-${Date.now()}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export async function registerStudio(data: {
  studioName: string; slug: string; adminName: string;
  adminEmail: string; adminPassword: string;
}): Promise<{ token: string; user: AuthUser; studio: StudioInfo }> {
  const result = await apiFetch<{ token: string; user: AuthUser; studio: StudioInfo }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(data) }
  );
  saveToken(result.token);
  saveStudioInfo(result.studio);
  return result;
}

export async function getMe(): Promise<{ user: AuthUser; studio: StudioInfo | null }> {
  return apiFetch<{ user: AuthUser; studio: StudioInfo | null }>("/api/auth/me");
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch("/api/auth/change-password", {
    method: "POST",
    body:   JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function updateProfile(name: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me", {
    method: "PUT",
    body:   JSON.stringify({ name }),
  });
}

export async function deleteAllPhotos(): Promise<{ deletedCount: number; filesRemoved: number }> {
  return apiFetch<{ deletedCount: number; filesRemoved: number }>("/api/photos", {
    method: "DELETE",
  });
}

export async function requestPasswordReset(email: string, studioSlug: string): Promise<void> {
  await apiFetch("/api/auth/request-otp", {
    method: "POST",
    body:   JSON.stringify({ email, studioSlug }),
  });
}

export async function verifyPasswordResetOtp(
  email: string,
  otp: string,
  studioSlug: string,
): Promise<{ resetToken: string }> {
  return apiFetch("/api/auth/verify-otp", {
    method: "POST",
    body:   JSON.stringify({ email, otp, studioSlug }),
  });
}

export async function resetPassword(
  email:       string,
  resetToken:  string,
  newPassword: string,
  studioSlug:  string,
): Promise<void> {
  await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body:   JSON.stringify({ email, resetToken, newPassword, studioSlug }),
  });
}

export function logout(): void {
  clearToken();
  clearStudioInfo();
  ["role", "user_name", "user_id", "user_email"].forEach(k => ls.remove(k));
}

// ─── 2. Studio ─────────────────────────────────────────────────────────────────

export async function getMyStudio(): Promise<{
  studio: StudioInfo;
  usage:  { staffCount: number; clientCount: number; photoCount: number };
  limits: { staff: number | null; clients: number | null; photos: number | null };
}> {
  return apiFetch("/api/studios/me");
}

export async function updateMyStudio(data: { name?: string; slug?: string; logoUrl?: string | null; phone?: string | null; address?: string | null; email?: string | null }): Promise<StudioInfo> {
  return apiFetch<StudioInfo>("/api/studios/me", {
    method: "PUT",
    body:   JSON.stringify(data),
  });
}

export async function uploadStudioLogo(file: File): Promise<{ logoUrl: string }> {
  const form = new FormData();
  form.append("logo", file);
  return apiFetch<{ logoUrl: string }>("/api/studios/me/logo", {
    method: "POST",
    body:   form,
  });
}

// ─── 2b. Studio Upgrade ────────────────────────────────────────────────────────

export type UpgradeRequestStatus = "pending" | "confirmed" | "rejected";

export interface UpgradeInfo {
  bankName:      string;
  accountNumber: string;
  accountName:   string;
  proPlanPrice:  string;
  request: {
    id:        string;
    amount:    string;
    reference: string;
    notes:     string | null;
    status:    UpgradeRequestStatus;
    createdAt: string;
  } | null;
}

export async function getMyUpgradeInfo(): Promise<UpgradeInfo> {
  return apiFetch<UpgradeInfo>("/api/studios/me/upgrade-info");
}

export async function submitUpgradeRequest(data: { reference: string; notes?: string }): Promise<UpgradeInfo["request"]> {
  return apiFetch<UpgradeInfo["request"]>("/api/studios/me/upgrade-request", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

// ─── Platform Settings & Upgrade Requests (Superadmin) ────────────────────────

export interface PlatformSettingsData {
  bankName:      string;
  accountNumber: string;
  accountName:   string;
  proPlanPrice:  string;
}

export interface PlatformUpgradeRequest {
  id:         string;
  amount:     string;
  reference:  string;
  notes:      string | null;
  status:     UpgradeRequestStatus;
  createdAt:  string;
  studioId:   string;
  studioName: string;
  studioSlug: string;
  studioPlan: string;
}

export async function getPlatformSettings(): Promise<PlatformSettingsData> {
  return platformApiFetch<PlatformSettingsData>("/api/platform/settings");
}

export async function updatePlatformSettings(data: PlatformSettingsData): Promise<PlatformSettingsData> {
  return platformApiFetch<PlatformSettingsData>("/api/platform/settings", {
    method: "PUT",
    body:   JSON.stringify(data),
  });
}

export async function getPlatformUpgradeRequests(): Promise<PlatformUpgradeRequest[]> {
  return platformApiFetch<PlatformUpgradeRequest[]>("/api/platform/upgrade-requests");
}

export async function confirmUpgradeRequest(id: string): Promise<void> {
  await platformApiFetch(`/api/platform/upgrade-requests/${id}/confirm`, { method: "POST" });
}

export async function rejectUpgradeRequest(id: string): Promise<void> {
  await platformApiFetch(`/api/platform/upgrade-requests/${id}/reject`, { method: "POST" });
}

// ─── 3. Staff Management ──────────────────────────────────────────────────────

export async function getStaff(filters?: { active?: boolean }): Promise<StaffMember[]> {
  const params = new URLSearchParams();
  if (filters?.active !== undefined) params.set("active", String(filters.active));
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<StaffMember[]>(`/api/staff${query}`);
}

export async function createStaff(data: {
  name: string; email: string; phone: string; password: string; isActive?: boolean;
}): Promise<StaffMember> {
  return apiFetch<StaffMember>("/api/staff", { method: "POST", body: JSON.stringify(data) });
}

export async function updateStaff(
  staffId: string,
  data: { name?: string; email?: string; phone?: string }
): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${staffId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function toggleStaffStatus(staffId: string, isActive: boolean): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${staffId}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) });
}

export async function setStaffPassword(staffId: string, newPassword: string): Promise<void> {
  await apiFetch(`/api/staff/${staffId}/password`, { method: "PATCH", body: JSON.stringify({ newPassword }) });
}

export async function deleteStaff(staffId: string): Promise<void> {
  await apiFetch(`/api/staff/${staffId}`, { method: "DELETE" });
}

// ─── 4. Clients ───────────────────────────────────────────────────────────────

export async function createClient(data: {
  clientName: string; phone: string; price: number; deposit?: number;
  photoFormat?: "SOFTCOPY" | "HARDCOPY" | "BOTH";
  orderStatus?: Client["orderStatus"]; paymentStatus?: Client["paymentStatus"];
  notes?: string; createdById?: string;
}): Promise<Client> {
  return apiFetch<Client>("/api/clients", { method: "POST", body: JSON.stringify(data) });
}

export async function getClients(filters?: {
  orderStatus?: Client["orderStatus"]; paymentStatus?: Client["paymentStatus"];
}): Promise<Client[]> {
  const params = new URLSearchParams();
  if (filters?.orderStatus)   params.set("orderStatus",   filters.orderStatus);
  if (filters?.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<Client[]>(`/api/clients${query}`);
}

export async function getClient(clientId: string): Promise<Client> {
  return apiFetch<Client>(`/api/clients/${clientId}`);
}

export async function updateClient(
  clientId: string,
  data: {
    clientName?: string; phone?: string; price?: number; deposit?: number;
    photoFormat?: Client["photoFormat"]; orderStatus?: Client["orderStatus"];
    paymentStatus?: Client["paymentStatus"]; notes?: string | null; createdById?: string;
  }
): Promise<Client> {
  return apiFetch<Client>(`/api/clients/${clientId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteClient(clientId: string): Promise<void> {
  await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
}

// ─── 5. Photo upload ──────────────────────────────────────────────────────────

export async function uploadPhotos(clientId: string, files: File[]): Promise<UploadResult> {
  const form = new FormData();
  files.forEach((file) => form.append("photos", file));
  return apiFetch<UploadResult>(`/api/clients/${clientId}/photos`, { method: "POST", body: form });
}

// ─── 6. Public gallery ─────────────────────────────────────────────────────────

export async function getGallery(token: string): Promise<GalleryView> {
  return apiFetch<GalleryView>(`/api/gallery/${token}`);
}

// ─── 7. Invoices ──────────────────────────────────────────────────────────────

export async function createInvoice(clientId: string, amount?: number): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${clientId}`, {
    method: "POST",
    body:   JSON.stringify(amount !== undefined ? { amount } : {}),
  });
}

export async function getInvoices(): Promise<Invoice[]> {
  return apiFetch<Invoice[]>("/api/invoices");
}

export async function getInvoice(invoiceId: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${invoiceId}`);
}

export async function markInvoicePaid(invoiceId: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${invoiceId}/mark-paid`, { method: "PATCH" });
}

// ─── 8. Payments ──────────────────────────────────────────────────────────────

export async function getPayments(): Promise<Payment[]> {
  return apiFetch<Payment[]>("/api/payments");
}

export async function recordPayment(clientId: string, amount: number): Promise<{
  payment: Payment;
  summary: { totalPaid: number; sessionPrice: number; balance: number; isFullyPaid: boolean };
}> {
  return apiFetch(`/api/payments/${clientId}`, {
    method: "POST",
    body:   JSON.stringify({ amount }),
  });
}

// ─── 9. Dashboard ─────────────────────────────────────────────────────────────

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  return apiFetch<AdminDashboardData>("/api/dashboard/admin");
}

export async function getStaffDashboard(): Promise<StaffDashboardData> {
  return apiFetch<StaffDashboardData>("/api/dashboard/staff");
}

// ─── 10. Studio public info ───────────────────────────────────────────────────

export async function getPublicStudio(slug: string): Promise<{ name: string; logoUrl: string | null; isActive: boolean }> {
  return apiFetch(`/api/studios/public/${slug}`);
}
