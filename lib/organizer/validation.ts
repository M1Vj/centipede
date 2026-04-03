import {
  ALLOWED_LOGO_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
} from "@/lib/organizer/constants";

export type OrganizerApplicationInput = {
  applicantFullName: string;
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  organizationType: string;
  statement: string;
  hasAcceptedDataPrivacyAct: boolean;
  hasAcceptedTerms: boolean;
};

export type ValidatedOrganizerApplicationInput = {
  applicantFullName: string;
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  organizationType: string;
  statement: string;
};

function hasText(value: string) {
  return value.trim().length > 0;
}

export function validateOrganizerApplicationInput(
  input: OrganizerApplicationInput,
): ValidatedOrganizerApplicationInput {
  const applicantFullName = input.applicantFullName.trim();
  const organizationName = input.organizationName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  const contactPhone = input.contactPhone.trim();
  const organizationType = input.organizationType.trim();
  const statement = input.statement.trim();

  if (!hasText(applicantFullName)) {
    throw new Error("Applicant full name is required.");
  }

  if (!hasText(organizationName)) {
    throw new Error("Organization name is required.");
  }

  if (!hasText(contactEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("A valid contact email is required.");
  }

  if (!hasText(contactPhone)) {
    throw new Error("Contact phone is required.");
  }

  if (!hasText(organizationType)) {
    throw new Error("Organization type is required.");
  }

  if (!hasText(statement)) {
    throw new Error("Organizer statement is required.");
  }

  if (!input.hasAcceptedDataPrivacyAct || !input.hasAcceptedTerms) {
    throw new Error(
      "You must accept the Data Privacy Act of 2012 and Terms & Conditions.",
    );
  }

  return {
    applicantFullName,
    organizationName,
    contactEmail,
    contactPhone,
    organizationType,
    statement,
  };
}

export function getLogoExtensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  return null;
}

export function validateLogoUpload(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
    throw new Error("Only JPEG and PNG logo files are allowed.");
  }

  if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
    throw new Error("Logo file size must be 2MB or less.");
  }

  const extension = getLogoExtensionForMimeType(file.type);
  if (!extension) {
    throw new Error("Unsupported logo file type.");
  }

  return {
    extension,
    contentType: file.type,
  };
}
