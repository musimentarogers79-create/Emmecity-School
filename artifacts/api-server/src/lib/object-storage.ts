import { randomUUID } from "node:crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const privateObjectDir = () => {
  const value = process.env["PRIVATE_OBJECT_DIR"]?.trim();
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured.");
  return value.replace(/\/+$/, "");
};

const parseObjectPath = (value: string) => {
  const normalized = value.startsWith("/") ? value : `/${value}`;
  const parts = normalized.split("/");
  if (parts.length < 3 || !parts[1] || !parts.slice(2).join("/")) {
    throw new Error("Invalid object storage path.");
  }
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
};

async function signObjectUrl(input: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT";
}) {
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: input.bucketName,
      object_name: input.objectName,
      method: input.method,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to sign object URL (${response.status}).`);
  const body = await response.json() as { signed_url?: string };
  if (!body.signed_url) throw new Error("Object storage did not return a signed URL.");
  return body.signed_url;
}

export function isPupilPhotoPath(value: unknown): value is string {
  return typeof value === "string" && /^\/objects\/uploads\/[A-Za-z0-9-]+$/.test(value);
}

export async function requestPupilPhotoUpload(contentType: string) {
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
    throw new Error("Only JPEG, PNG, and WebP pupil photos are supported.");
  }
  const objectId = randomUUID();
  const objectName = `uploads/${objectId}`;
  const { bucketName } = parseObjectPath(`${privateObjectDir()}/${objectName}`);
  return {
    uploadURL: await signObjectUrl({ bucketName, objectName, method: "PUT" }),
    objectPath: `/objects/${objectName}`,
  };
}

export async function requestObjectDownload(objectPath: string) {
  if (!isPupilPhotoPath(objectPath)) throw new Error("Invalid object path.");
  const objectName = objectPath.slice("/objects/".length);
  const { bucketName } = parseObjectPath(`${privateObjectDir()}/${objectName}`);
  return signObjectUrl({ bucketName, objectName, method: "GET" });
}