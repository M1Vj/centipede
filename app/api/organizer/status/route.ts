import { NextRequest, NextResponse } from "next/server";
import { lookupOrganizerApplicationStatus } from "@/lib/organizer/lifecycle";

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return null;
}

function isPrerenderInterruption(error: unknown): error is { digest: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      (error as { digest?: string }).digest === "NEXT_PRERENDER_INTERRUPTED",
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get("token") || "";

    const lookup = await lookupOrganizerApplicationStatus(token, getClientIp(request));

    if (lookup.machineCode !== "ok") {
      if (lookup.machineCode === "throttled") {
        return NextResponse.json(
          {
            code: "throttled",
            message: "Please wait before checking status again.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": "1",
            },
          },
        );
      }

      return NextResponse.json(
        {
          code: "not_found",
          message: "We could not find an application for this status token.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      code: "ok",
      status: lookup.status,
      rejectionReason: lookup.rejectionReason,
      maskedContactEmail: lookup.maskedContactEmail,
    });
  } catch (error) {
    if (isPrerenderInterruption(error)) {
      throw error;
    }

    return NextResponse.json(
      {
        code: "status_lookup_failed",
        message: "Unable to check organizer application status.",
      },
      { status: 500 },
    );
  }
}
