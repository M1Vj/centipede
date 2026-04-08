const ONE_MEGABYTE = 1024 * 1024;
const DEFAULT_MAX_BYTES = ONE_MEGABYTE;
const DEFAULT_QUALITY_STEPS = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36] as const;
const DEFAULT_DOWNSCALE_FACTOR = 0.85;
const DEFAULT_MAX_DOWNSCALE_STEPS = 6;

export interface ImagePreprocessingOptions {
  maxBytes?: number;
  qualitySteps?: readonly number[];
  downscaleFactor?: number;
  maxDownscaleSteps?: number;
}

interface RasterSource {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
}

function toWebpFileName(inputName: string): string {
  const trimmed = inputName.trim();
  if (!trimmed) {
    return "problem-image.webp";
  }

  const withoutExtension = trimmed.replace(/\.[^/.]+$/, "");
  return `${withoutExtension || "problem-image"}.webp`;
}

function sanitizeQualitySteps(qualitySteps: readonly number[] | undefined): number[] {
  if (!qualitySteps || qualitySteps.length === 0) {
    return [...DEFAULT_QUALITY_STEPS];
  }

  const sanitized = qualitySteps
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 1);

  if (sanitized.length === 0) {
    return [...DEFAULT_QUALITY_STEPS];
  }

  return Array.from(new Set(sanitized)).sort((left, right) => right - left);
}

function sanitizeDownscaleFactor(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DOWNSCALE_FACTOR;
  }

  if (value <= 0 || value >= 1) {
    return DEFAULT_DOWNSCALE_FACTOR;
  }

  return value;
}

function sanitizeMaxDownscaleSteps(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_DOWNSCALE_STEPS;
  }

  if (value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function formatMaxSize(bytes: number): string {
  const megabytes = bytes / ONE_MEGABYTE;
  const rounded = Number.isInteger(megabytes) ? String(megabytes) : megabytes.toFixed(1);
  return `${rounded.replace(/\.0$/, "")}MB`;
}

async function encodeCanvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image conversion failed. Please choose another image."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

function decodeWithImageBitmap(bitmap: ImageBitmap): RasterSource {
  return {
    width: bitmap.width,
    height: bitmap.height,
    draw: (context, width, height) => {
      context.drawImage(bitmap, 0, 0, width, height);
    },
    cleanup: () => {
      bitmap.close();
    },
  };
}

async function decodeWithHtmlImage(file: File): Promise<RasterSource> {
  if (typeof Image === "undefined" || typeof URL === "undefined") {
    throw new Error("Image conversion is unavailable in this browser.");
  }

  const objectUrl = URL.createObjectURL(file);

  return new Promise<RasterSource>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        draw: (context, width, height) => {
          context.drawImage(image, 0, 0, width, height);
        },
        cleanup: () => {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image conversion failed. Please choose another image."));
    };

    image.src = objectUrl;
  });
}

async function decodeImage(file: File): Promise<RasterSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return decodeWithImageBitmap(bitmap);
    } catch {
      // Fall back to HTMLImage decoding for browser-specific bitmap decode failures.
    }
  }

  try {
    return await decodeWithHtmlImage(file);
  } catch {
    throw new Error("Image conversion failed. Please choose another image format or a smaller file.");
  }
}

export async function preprocessImageForUpload(
  file: File,
  options: ImagePreprocessingOptions = {},
): Promise<File> {
  if (!file.type.toLowerCase().startsWith("image/")) {
    throw new Error("Image conversion failed. Please upload a valid image file.");
  }

  if (typeof document === "undefined") {
    throw new Error("Image conversion is unavailable in this environment.");
  }

  const maxBytes =
    typeof options.maxBytes === "number" && Number.isFinite(options.maxBytes) && options.maxBytes > 0
      ? Math.floor(options.maxBytes)
      : DEFAULT_MAX_BYTES;
  const qualitySteps = sanitizeQualitySteps(options.qualitySteps);
  const downscaleFactor = sanitizeDownscaleFactor(options.downscaleFactor);
  const maxDownscaleSteps = sanitizeMaxDownscaleSteps(options.maxDownscaleSteps);

  const source = await decodeImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    source.cleanup();
    throw new Error("Image conversion is unavailable in this browser.");
  }

  let targetWidth = Math.max(1, Math.round(source.width));
  let targetHeight = Math.max(1, Math.round(source.height));

  try {
    for (let downscaleStep = 0; downscaleStep <= maxDownscaleSteps; downscaleStep += 1) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      context.clearRect(0, 0, targetWidth, targetHeight);
      source.draw(context, targetWidth, targetHeight);

      for (const quality of qualitySteps) {
        const webpBlob = await encodeCanvasToWebp(canvas, quality);
        if (webpBlob.size <= maxBytes) {
          return new File([webpBlob], toWebpFileName(file.name), {
            type: "image/webp",
            lastModified: Date.now(),
          });
        }
      }

      const nextWidth = Math.max(1, Math.floor(targetWidth * downscaleFactor));
      const nextHeight = Math.max(1, Math.floor(targetHeight * downscaleFactor));

      if (nextWidth === targetWidth && nextHeight === targetHeight) {
        break;
      }

      targetWidth = nextWidth;
      targetHeight = nextHeight;
    }
  } finally {
    source.cleanup();
  }

  throw new Error(
    `Image conversion failed. Please choose a smaller image that can be compressed to ${formatMaxSize(maxBytes)} or less.`,
  );
}