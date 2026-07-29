"use client";

import {
  apiErrorFromNetwork,
  apiErrorFromResponse,
} from "@/app/lib/api/errors";
import type {
  DocumentResponse,
  DocumentUploadPolicy,
} from "@/app/lib/api/client";
import { getPublicEnv } from "@/app/lib/env";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export type UploadInput = {
  file: File;
  documentType?: DocumentResponse["document_type"];
  documentId?: string;
  idempotencyKey: string;
  onProgress: (percent: number) => void;
};

export function validateDocumentFile(file: File, policy: DocumentUploadPolicy) {
  if (file.size > policy.max_size_bytes) {
    return `Choose a file smaller than ${formatBytes(policy.max_size_bytes)}.`;
  }
  if (!policy.allowed_mime_types.includes(file.type)) {
    return `Choose an approved file type: ${policy.accepted_extensions.join(", ")}.`;
  }
  return null;
}

export function isSignedUrlExpired(expiresAt: string, now = Date.now()) {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= now + 5_000;
}

export async function uploadPrivateDocument(
  input: UploadInput,
): Promise<DocumentResponse> {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session has expired. Sign in again to upload.");
  }

  const body = new FormData();
  if (input.documentType) body.set("document_type", input.documentType);
  body.set("file", input.file);
  const suffix = input.documentId
    ? `/${encodeURIComponent(input.documentId)}`
    : "";
  return xhrUpload(
    `${getPublicEnv().apiBaseUrl.replace(/\/$/, "")}/profile/documents${suffix}`,
    input.documentId ? "PUT" : "POST",
    body,
    session.access_token,
    input.idempotencyKey,
    input.onProgress,
  );
}

function xhrUpload(
  url: string,
  method: "POST" | "PUT",
  body: FormData,
  accessToken: string,
  idempotencyKey: string,
  onProgress: (percent: number) => void,
): Promise<DocumentResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("Idempotency-Key", idempotencyKey);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", async () => {
      const response = new Response(request.responseText, {
        status: request.status,
        headers: {
          "Content-Type":
            request.getResponseHeader("Content-Type") ?? "application/json",
        },
      });
      if (!response.ok) {
        reject(await apiErrorFromResponse(response));
        return;
      }
      onProgress(100);
      resolve(JSON.parse(request.responseText) as DocumentResponse);
    });
    request.addEventListener("error", () =>
      reject(apiErrorFromNetwork(new Error("Upload failed"))),
    );
    request.addEventListener("abort", () =>
      reject(
        apiErrorFromNetwork(new DOMException("Upload aborted", "AbortError")),
      ),
    );
    request.send(body);
  });
}

function formatBytes(bytes: number) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}
