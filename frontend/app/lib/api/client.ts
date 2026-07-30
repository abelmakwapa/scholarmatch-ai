import { getPublicEnv } from "@/app/lib/env";
import {
  ApiError,
  apiErrorFromNetwork,
  apiErrorFromResponse,
} from "@/app/lib/api/errors";
import type { components, operations } from "@/app/lib/api/schema";

export type ProfileWrite = components["schemas"]["ProfileWrite"];
export type ProfileResponse = components["schemas"]["ProfileResponse"];
export type MatchPage = components["schemas"]["MatchPage"];
export type MatchResponse = components["schemas"]["MatchResponse"];
export type MatchExplanation = components["schemas"]["MatchExplanation"];
export type JobResponse = components["schemas"]["JobResponse"];
export type MatchFeedbackCreate = components["schemas"]["MatchFeedbackCreate"];
export type MatchFeedbackResponse =
  components["schemas"]["MatchFeedbackResponse"];
export type ApplicationPage = components["schemas"]["ApplicationPage"];
export type ApplicationResponse = components["schemas"]["ApplicationResponse"];
export type ApplicationStatus = components["schemas"]["ApplicationStatus"];
export type ApplicationUpdate = components["schemas"]["ApplicationUpdate"];
export type ApplicationDeadlinePage =
  components["schemas"]["ApplicationDeadlinePage"];
export type ChecklistItemUpdate = components["schemas"]["ChecklistItemUpdate"];
export type ApplicationReminderWrite =
  components["schemas"]["ApplicationReminderWrite"];
export type DocumentPage = components["schemas"]["DocumentPage"];
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type DocumentUploadPolicy =
  components["schemas"]["DocumentUploadPolicy"];
export type DocumentReadinessResponse =
  components["schemas"]["DocumentReadinessResponse"];
export type DocumentRename = components["schemas"]["DocumentRename"];
export type SignedDocumentUrlResponse =
  components["schemas"]["SignedDocumentUrlResponse"];
export type ScholarshipPage = components["schemas"]["ScholarshipPage"];
export type ScholarshipResponse = components["schemas"]["ScholarshipResponse"];
export type EligibilityStatus = components["schemas"]["EligibilityStatus"];
export type SavedScholarshipResponse =
  components["schemas"]["SavedScholarshipResponse"];
export type ScholarshipReportCreate =
  components["schemas"]["ScholarshipReportCreate"];
export type ScholarshipReportResponse =
  components["schemas"]["ScholarshipReportResponse"];
export type ApplicationCreate = components["schemas"]["ApplicationCreate"];
export type AdminScholarshipPage =
  components["schemas"]["AdminScholarshipPage"];
export type AdminScholarshipResponse =
  components["schemas"]["AdminScholarshipResponse"];
export type AdminScholarshipWrite =
  components["schemas"]["AdminScholarshipWrite"];
export type AdminScholarshipPatch =
  components["schemas"]["AdminScholarshipPatch"];
export type AdminLifecycleTransition =
  components["schemas"]["AdminLifecycleTransition"];
export type AdminRequirementSetWrite =
  components["schemas"]["AdminRequirementSetWrite"];
export type AdminBulkActionPreviewRequest =
  components["schemas"]["AdminBulkActionPreviewRequest"];
export type AdminBulkActionPreviewResponse =
  components["schemas"]["AdminBulkActionPreviewResponse"];
export type AdminBulkActionResponse =
  components["schemas"]["AdminBulkActionResponse"];
export type AdminBulkUndoResponse =
  components["schemas"]["AdminBulkUndoResponse"];
export type AdminDuplicatePage = components["schemas"]["AdminDuplicatePage"];
export type AdminDuplicateMergeRequest =
  components["schemas"]["AdminDuplicateMergeRequest"];
export type AdminDuplicateMergeResponse =
  components["schemas"]["AdminDuplicateMergeResponse"];
export type AdminVerificationPage =
  components["schemas"]["AdminVerificationPage"];
export type AdminVerificationItem =
  components["schemas"]["AdminVerificationItem"];
export type AdminVerificationWrite =
  components["schemas"]["AdminVerificationWrite"];
export type AdminAuditEventPage = components["schemas"]["AdminAuditEventPage"];
export type IngestionRunCreate = components["schemas"]["IngestionRunCreate"];
export type IngestionRunResponse =
  components["schemas"]["IngestionRunResponse"];
export type IngestionRunPage = components["schemas"]["IngestionRunPage"];

/** Resolves the current Supabase access token, or null when signed out. */
export type AccessTokenProvider = () => Promise<string | null>;

type RequestOptions = {
  method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** When false, a missing token still sends the request (public endpoints). */
  requireAuth?: boolean;
};

/**
 * A thin, typed HTTP client for the `/api/v1` contract. It attaches the
 * Supabase bearer token, normalizes every failure into an `ApiError`, and
 * treats a 204/empty body as `null`.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: AccessTokenProvider;

  constructor(getAccessToken: AccessTokenProvider, baseUrl?: string) {
    this.getAccessToken = getAccessToken;
    this.baseUrl = (baseUrl ?? getPublicEnv().apiBaseUrl).replace(/\/$/, "");
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });

    const token = await this.getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else if (options.requireAuth !== false) {
      // Fail fast rather than sending an unauthenticated request the server
      // will only reject; the UI treats this as an expired session.
      throw sessionExpiredError();
    }

    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }

    let payload: BodyInit | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${options.path}`, {
        method: options.method,
        headers,
        body: payload,
        signal: options.signal,
        cache: "no-store",
        credentials: "omit",
      });
    } catch (cause) {
      throw apiErrorFromNetwork(cause);
    }

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    return (text.length > 0 ? JSON.parse(text) : null) as T;
  }

  /** GET /profile — returns null when the student has no profile yet (404). */
  async getProfile(signal?: AbortSignal): Promise<ProfileResponse | null> {
    try {
      return await this.request<ProfileResponse>({
        method: "GET",
        path: "/profile",
        signal,
      });
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  /** PUT /profile — creates or fully replaces the student's profile. */
  async replaceProfile(
    body: ProfileWrite,
    signal?: AbortSignal,
  ): Promise<ProfileResponse> {
    return this.request<ProfileResponse>({
      method: "PUT",
      path: "/profile",
      body,
      signal,
    });
  }

  /** GET /matches — newest server-ranked matches for the current student. */
  async listMatches(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<MatchPage> {
    return this.request<MatchPage>({
      method: "GET",
      path: pagePath("/matches", options),
      signal: options.signal,
    });
  }

  async getMatch(
    scholarshipId: string,
    signal?: AbortSignal,
  ): Promise<MatchResponse> {
    return this.request<MatchResponse>({
      method: "GET",
      path: `/matches/${encodeURIComponent(scholarshipId)}`,
      signal,
    });
  }

  async recalculateMatches(
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<JobResponse> {
    return this.request<JobResponse>({
      method: "POST",
      path: "/matches/recalculate",
      idempotencyKey,
      signal,
    });
  }

  async getMatchRecalculationJob(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<JobResponse> {
    return this.request<JobResponse>({
      method: "GET",
      path: `/matches/recalculation-jobs/${encodeURIComponent(jobId)}`,
      signal,
    });
  }

  async createMatchFeedback(
    scholarshipId: string,
    body: MatchFeedbackCreate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<MatchFeedbackResponse> {
    return this.request<MatchFeedbackResponse>({
      method: "POST",
      path: `/matches/${encodeURIComponent(scholarshipId)}/feedback`,
      body,
      idempotencyKey,
      signal,
    });
  }

  /** GET /applications — applications owned by the current student. */
  async listApplications(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<ApplicationPage> {
    return this.request<ApplicationPage>({
      method: "GET",
      path: pagePath("/applications", options),
      signal: options.signal,
    });
  }

  async listApplicationDeadlines(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<ApplicationDeadlinePage> {
    return this.request<ApplicationDeadlinePage>({
      method: "GET",
      path: pagePath("/applications/deadlines", options),
      signal: options.signal,
    });
  }

  async updateApplication(
    applicationId: string,
    body: ApplicationUpdate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>({
      method: "PATCH",
      path: `/applications/${encodeURIComponent(applicationId)}`,
      body,
      idempotencyKey,
      signal,
    });
  }

  async updateApplicationChecklistItem(
    applicationId: string,
    checklistItemId: string,
    body: ChecklistItemUpdate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>({
      method: "PUT",
      path: `/applications/${encodeURIComponent(applicationId)}/checklist/${encodeURIComponent(checklistItemId)}`,
      body,
      idempotencyKey,
      signal,
    });
  }

  async setApplicationReminder(
    applicationId: string,
    body: ApplicationReminderWrite,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>({
      method: "PUT",
      path: `/applications/${encodeURIComponent(applicationId)}/reminder`,
      body,
      idempotencyKey,
      signal,
    });
  }

  async deleteApplicationReminder(
    applicationId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>({
      method: "DELETE",
      path: `/applications/${encodeURIComponent(applicationId)}/reminder`,
      idempotencyKey,
      signal,
    });
  }

  async listDocuments(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<DocumentPage> {
    return this.request<DocumentPage>({
      method: "GET",
      path: pagePath("/profile/documents", options),
      signal: options.signal,
    });
  }

  async getDocumentUploadPolicy(
    signal?: AbortSignal,
  ): Promise<DocumentUploadPolicy> {
    return this.request<DocumentUploadPolicy>({
      method: "GET",
      path: "/profile/documents/policy",
      signal,
    });
  }

  async getDocumentReadiness(
    signal?: AbortSignal,
  ): Promise<DocumentReadinessResponse> {
    return this.request<DocumentReadinessResponse>({
      method: "GET",
      path: "/profile/documents/readiness",
      signal,
    });
  }

  async renameDocument(
    documentId: string,
    body: DocumentRename,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<DocumentResponse> {
    return this.request<DocumentResponse>({
      method: "PATCH",
      path: `/profile/documents/${encodeURIComponent(documentId)}`,
      body,
      idempotencyKey,
      signal,
    });
  }

  async createDocumentDownloadUrl(
    documentId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<SignedDocumentUrlResponse> {
    return this.request<SignedDocumentUrlResponse>({
      method: "POST",
      path: `/profile/documents/${encodeURIComponent(documentId)}/download-url`,
      idempotencyKey,
      signal,
    });
  }

  async deleteDocument(
    documentId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<null> {
    return this.request<null>({
      method: "DELETE",
      path: `/profile/documents/${encodeURIComponent(documentId)}`,
      idempotencyKey,
      signal,
    });
  }

  /** GET /scholarships — server-filtered discovery results. */
  async listScholarships(
    options: ScholarshipListOptions = {},
  ): Promise<ScholarshipPage> {
    const { signal, ...query } = options;
    return this.request<ScholarshipPage>({
      method: "GET",
      path: queryPath("/scholarships", query),
      signal,
    });
  }

  async getScholarship(
    scholarshipId: string,
    signal?: AbortSignal,
  ): Promise<ScholarshipResponse> {
    return this.request<ScholarshipResponse>({
      method: "GET",
      path: `/scholarships/${encodeURIComponent(scholarshipId)}`,
      signal,
    });
  }

  async listRelatedScholarships(
    scholarshipId: string,
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<ScholarshipPage> {
    return this.request<ScholarshipPage>({
      method: "GET",
      path: pagePath(
        `/scholarships/${encodeURIComponent(scholarshipId)}/related`,
        options,
      ),
      signal: options.signal,
    });
  }

  async setScholarshipSaved(
    scholarshipId: string,
    saved: boolean,
    signal?: AbortSignal,
  ): Promise<SavedScholarshipResponse | null> {
    return this.request<SavedScholarshipResponse | null>({
      method: saved ? "PUT" : "DELETE",
      path: `/scholarships/${encodeURIComponent(scholarshipId)}/saved`,
      signal,
    });
  }

  async createApplication(
    body: ApplicationCreate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>({
      method: "POST",
      path: "/applications",
      body,
      idempotencyKey,
      signal,
    });
  }

  async reportScholarship(
    scholarshipId: string,
    body: ScholarshipReportCreate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ScholarshipReportResponse> {
    return this.request<ScholarshipReportResponse>({
      method: "POST",
      path: `/scholarships/${encodeURIComponent(scholarshipId)}/reports`,
      body,
      idempotencyKey,
      signal,
    });
  }

  async listAdminScholarships(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<AdminScholarshipPage> {
    return this.request<AdminScholarshipPage>({
      method: "GET",
      path: pagePath("/admin/scholarships", options),
      signal: options.signal,
    });
  }

  async getAdminScholarship(
    scholarshipId: string,
    signal?: AbortSignal,
  ): Promise<AdminScholarshipResponse> {
    return this.request<AdminScholarshipResponse>({
      method: "GET",
      path: `/admin/scholarships/${encodeURIComponent(scholarshipId)}`,
      signal,
    });
  }

  async createAdminScholarship(
    body: AdminScholarshipWrite,
    idempotencyKey: string,
  ): Promise<AdminScholarshipResponse> {
    return this.request<AdminScholarshipResponse>({
      method: "POST",
      path: "/admin/scholarships",
      body,
      idempotencyKey,
    });
  }

  async updateAdminScholarship(
    scholarshipId: string,
    body: AdminScholarshipPatch,
    idempotencyKey: string,
  ): Promise<AdminScholarshipResponse> {
    return this.request<AdminScholarshipResponse>({
      method: "PATCH",
      path: `/admin/scholarships/${encodeURIComponent(scholarshipId)}`,
      body,
      idempotencyKey,
    });
  }

  async transitionAdminScholarship(
    scholarshipId: string,
    body: AdminLifecycleTransition,
    idempotencyKey: string,
  ): Promise<AdminScholarshipResponse> {
    return this.request<AdminScholarshipResponse>({
      method: "POST",
      path: `/admin/scholarships/${encodeURIComponent(scholarshipId)}/lifecycle`,
      body,
      idempotencyKey,
    });
  }

  async replaceAdminScholarshipRequirements(
    scholarshipId: string,
    body: AdminRequirementSetWrite,
    idempotencyKey: string,
  ): Promise<AdminScholarshipResponse> {
    return this.request<AdminScholarshipResponse>({
      method: "PUT",
      path: `/admin/scholarships/${encodeURIComponent(scholarshipId)}/requirements`,
      body,
      idempotencyKey,
    });
  }

  async previewAdminBulkAction(
    body: AdminBulkActionPreviewRequest,
  ): Promise<AdminBulkActionPreviewResponse> {
    return this.request<AdminBulkActionPreviewResponse>({
      method: "POST",
      path: "/admin/scholarships/bulk-preview",
      body,
    });
  }

  async applyAdminBulkAction(
    previewToken: string,
    idempotencyKey: string,
  ): Promise<AdminBulkActionResponse> {
    return this.request<AdminBulkActionResponse>({
      method: "POST",
      path: "/admin/scholarships/bulk-action",
      body: { preview_token: previewToken },
      idempotencyKey,
    });
  }

  async undoAdminBulkAction(
    operationId: string,
    idempotencyKey: string,
  ): Promise<AdminBulkUndoResponse> {
    return this.request<AdminBulkUndoResponse>({
      method: "POST",
      path: `/admin/scholarships/bulk-actions/${encodeURIComponent(operationId)}/undo`,
      idempotencyKey,
    });
  }

  async listAdminDuplicateGroups(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<AdminDuplicatePage> {
    return this.request<AdminDuplicatePage>({
      method: "GET",
      path: pagePath("/admin/duplicates", options),
      signal: options.signal,
    });
  }

  async mergeAdminDuplicateGroup(
    duplicateId: string,
    body: AdminDuplicateMergeRequest,
    idempotencyKey: string,
  ): Promise<AdminDuplicateMergeResponse> {
    return this.request<AdminDuplicateMergeResponse>({
      method: "POST",
      path: `/admin/duplicates/${encodeURIComponent(duplicateId)}/merge`,
      body,
      idempotencyKey,
    });
  }

  async listAdminVerificationQueue(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<AdminVerificationPage> {
    return this.request<AdminVerificationPage>({
      method: "GET",
      path: pagePath("/admin/verification-queue", options),
      signal: options.signal,
    });
  }

  async verifyAdminScholarship(
    scholarshipId: string,
    body: AdminVerificationWrite,
    idempotencyKey: string,
  ): Promise<AdminVerificationItem> {
    return this.request<AdminVerificationItem>({
      method: "POST",
      path: `/admin/verification-queue/${encodeURIComponent(scholarshipId)}/verify`,
      body,
      idempotencyKey,
    });
  }

  async listAdminAuditEvents(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<AdminAuditEventPage> {
    return this.request<AdminAuditEventPage>({
      method: "GET",
      path: pagePath("/admin/audit-events", options),
      signal: options.signal,
    });
  }

  async listIngestionRuns(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<IngestionRunPage> {
    return this.request<IngestionRunPage>({
      method: "GET",
      path: pagePath("/admin/ingestion-runs", options),
      signal: options.signal,
    });
  }

  async getIngestionRun(
    runId: string,
    signal?: AbortSignal,
  ): Promise<IngestionRunResponse> {
    return this.request<IngestionRunResponse>({
      method: "GET",
      path: `/admin/ingestion-runs/${encodeURIComponent(runId)}`,
      signal,
    });
  }

  async createIngestionRun(
    body: IngestionRunCreate,
    idempotencyKey: string,
  ): Promise<IngestionRunResponse> {
    return this.request<IngestionRunResponse>({
      method: "POST",
      path: "/admin/ingestion-runs",
      body,
      idempotencyKey,
    });
  }

  async retryIngestionRun(
    runId: string,
    idempotencyKey: string,
  ): Promise<IngestionRunResponse> {
    return this.request<IngestionRunResponse>({
      method: "POST",
      path: `/admin/ingestion-runs/${encodeURIComponent(runId)}/retry`,
      idempotencyKey,
    });
  }
}

export type ScholarshipListOptions = NonNullable<
  operations["listScholarships"]["parameters"]["query"]
> & {
  signal?: AbortSignal;
};

function pagePath(
  path: string,
  options: { limit?: number; cursor?: string },
): string {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function queryPath(
  path: string,
  options: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as { kind?: unknown }).kind === "not_found"
  );
}

// Constructs the "session expired" ApiError without an HTTP round-trip.
function sessionExpiredError(): ApiError {
  return new ApiError({
    kind: "unauthorized",
    status: 401,
    code: "UNAUTHORIZED",
    message: "Your session has expired. Please sign in again to continue.",
  });
}
