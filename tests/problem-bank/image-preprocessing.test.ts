// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { preprocessImageForUpload } from "@/lib/problem-bank/image-preprocessing";

const MAX_BYTES = 1024 * 1024;

interface BitmapStub {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}

interface CanvasMockState {
  attemptedDimensions: string[];
  drawImageMock: ReturnType<typeof vi.fn>;
  bitmapCloseMock: ReturnType<typeof vi.fn>;
}

function installCanvasEncodingMocks(
  width: number,
  height: number,
  compressionMultiplier: number,
): CanvasMockState {
  const attemptedDimensions: string[] = [];
  const drawImageMock = vi.fn();
  const bitmapCloseMock = vi.fn();

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: drawImageMock,
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    callback: BlobCallback,
    _type?: string,
    quality?: number,
  ) {
    const resolvedQuality = typeof quality === "number" ? quality : 1;
    attemptedDimensions.push(`${this.width}x${this.height}`);

    const estimatedBytes = Math.max(
      128,
      Math.round(this.width * this.height * resolvedQuality * compressionMultiplier),
    );

    callback(new Blob([new Uint8Array(estimatedBytes)], { type: "image/webp" }));
  });

  const bitmap: BitmapStub = {
    width,
    height,
    close: bitmapCloseMock,
  };

  vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));

  return {
    attemptedDimensions,
    drawImageMock,
    bitmapCloseMock,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("preprocessImageForUpload", () => {
  test("converts to webp and meets max size using quality reduction", async () => {
    const mocks = installCanvasEncodingMocks(1000, 1000, 1.3);
    const input = new File(["source"], "diagram.png", { type: "image/png" });

    const output = await preprocessImageForUpload(input);

    expect(output.type).toBe("image/webp");
    expect(output.name).toBe("diagram.webp");
    expect(output.size).toBeLessThanOrEqual(MAX_BYTES);
    expect(new Set(mocks.attemptedDimensions).size).toBe(1);
    expect(mocks.drawImageMock).toHaveBeenCalledTimes(1);
    expect(mocks.bitmapCloseMock).toHaveBeenCalledTimes(1);
  });

  test("progressively downscales when quality reduction is not enough", async () => {
    const mocks = installCanvasEncodingMocks(2200, 2200, 1.2);
    const input = new File(["source"], "large.jpg", { type: "image/jpeg" });

    const output = await preprocessImageForUpload(input);

    expect(output.type).toBe("image/webp");
    expect(output.size).toBeLessThanOrEqual(MAX_BYTES);
    expect(new Set(mocks.attemptedDimensions).size).toBeGreaterThan(1);
    expect(mocks.drawImageMock.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.bitmapCloseMock).toHaveBeenCalledTimes(1);
  });

  test("throws a clear error when image cannot be compressed to max size", async () => {
    installCanvasEncodingMocks(2600, 2600, 3.5);
    const input = new File(["source"], "too-large.webp", { type: "image/webp" });

    await expect(preprocessImageForUpload(input)).rejects.toThrow(
      "compressed to 1MB or less",
    );
  });
});