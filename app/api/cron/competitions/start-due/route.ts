import { NextResponse } from "next/server";
import { startDueScheduledCompetitions } from "@/lib/competition/scheduled-start";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret?.trim()) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret?.trim()) {
    return NextResponse.json(
      {
        code: "service_unavailable",
        message: "Scheduled competition start worker is unavailable.",
      },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        code: "unauthorized",
        message: "Bearer token required.",
      },
      { status: 401 },
    );
  }

  const summary = await startDueScheduledCompetitions(new Date());
  if (summary.serviceUnavailable) {
    return NextResponse.json(
      {
        code: "service_unavailable",
        message: "Scheduled competition start worker is unavailable.",
        ...summary,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    code: "ok",
    ...summary,
  });
}
