import { canMutateBank } from "@/lib/problem-bank/api-helpers";
import {
  fetchProblemBank,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireSameOriginMutation,
  requireProblemBankActor,
} from "@/app/api/organizer/problem-banks/_shared";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFromMimeType(mimeType: string): string | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseImagePath(imagePath: string): { ownerId: string; bankId: string } | null {
  const segments = imagePath.split("/");
  if (segments.length !== 3) {
    return null;
  }

  const [ownerId, bankId, fileName] = segments;
  if (!ownerId || !bankId || !fileName) {
    return null;
  }

  if (!isUuid(ownerId) || !isUuid(bankId)) {
    return null;
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
    return null;
  }

  return { ownerId, bankId };
}

export async function POST(request: Request) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { actor, supabase } = auth;
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  const bankId = String(formData.get("bankId") ?? "").trim();
  const fileEntry = formData.get("file");

  if (!bankId || !(fileEntry instanceof File)) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "formData",
            reason: "bankId and file are required.",
          },
        ],
      },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "file",
            reason: "Unsupported file type.",
          },
        ],
      },
    );
  }

  if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "file",
            reason: "File size must be 5MB or less.",
          },
        ],
      },
    );
  }

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canMutateBank(actor, bankResult.bank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const extension = extensionFromMimeType(fileEntry.type);
  if (!extension) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  const ownerId = bankResult.bank.organizerId;
  const objectName = `${ownerId}/${bankResult.bank.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("problem-assets")
    .upload(objectName, fileEntry, {
      contentType: fileEntry.type,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    return jsonDatabaseError(uploadError);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("problem-assets")
    .createSignedUrl(objectName, 60 * 30);

  if (signedUrlError) {
    return jsonDatabaseError(signedUrlError);
  }

  return jsonOk({
    code: "uploaded",
    imagePath: objectName,
    signedUrl: signedUrlData?.signedUrl ?? null,
  });
}

export async function DELETE(request: Request) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { actor, supabase } = auth;
  const payload = (await request.json().catch(() => null)) as
    | { imagePath?: string; bankId?: string }
    | null;

  const imagePath = String(payload?.imagePath ?? "").trim();
  if (!imagePath) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  const parsedImagePath = parseImagePath(imagePath);
  if (!parsedImagePath) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  if (payload?.bankId && payload.bankId !== parsedImagePath.bankId) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  const bankResult = await fetchProblemBank(supabase, parsedImagePath.bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canMutateBank(actor, bankResult.bank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  if (bankResult.bank.organizerId !== parsedImagePath.ownerId) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const { error } = await supabase.storage.from("problem-assets").remove([imagePath]);
  if (error) {
    return jsonDatabaseError(error);
  }

  return jsonOk({
    code: "deleted",
    imagePath,
  });
}
