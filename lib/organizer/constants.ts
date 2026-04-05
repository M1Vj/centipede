export const ORGANIZER_LOGO_BUCKET = "organizer-assets";

export const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const ALLOWED_LOGO_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export const STATUS_LOOKUP_TOKEN_TTL_DAYS = 45;

export const STATUS_LOOKUP_TOKEN_REGEX = /^[a-f0-9]{32,128}$/;

export const ORGANIZER_RESET_REDIRECT_PATH = "/auth/confirm?next=/auth/update-password";
