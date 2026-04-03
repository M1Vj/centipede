export type OrganizerEmailMessageType = "submission" | "approved" | "rejected";

type OrganizerEmailPayload = {
  messageType: OrganizerEmailMessageType;
  recipientEmail: string;
  applicantName: string;
  organizationName: string;
  statusLink?: string;
  activationLink?: string;
  rejectionReason?: string | null;
};

function getOrganizerEmailFromAddress() {
  return process.env.ORGANIZER_EMAIL_FROM || "no-reply@mathwiz.local";
}

function buildSubject(payload: OrganizerEmailPayload) {
  if (payload.messageType === "submission") {
    return "Organizer application received";
  }

  if (payload.messageType === "approved") {
    return "Organizer application approved";
  }

  return "Organizer application update";
}

function buildHtml(payload: OrganizerEmailPayload) {
  if (payload.messageType === "submission") {
    return [
      `<p>Hello ${payload.applicantName},</p>`,
      `<p>We received your organizer application for ${payload.organizationName}. Our team will review it soon.</p>`,
      payload.statusLink
        ? `<p>You can check your review status here: <a href="${payload.statusLink}">${payload.statusLink}</a></p>`
        : "",
      "<p>Thank you for applying.</p>",
    ].join("");
  }

  if (payload.messageType === "approved") {
    return [
      `<p>Hello ${payload.applicantName},</p>`,
      `<p>Your organizer application for ${payload.organizationName} has been approved.</p>`,
      payload.activationLink
        ? `<p>Set your organizer password using this secure link: <a href="${payload.activationLink}">${payload.activationLink}</a></p>`
        : "<p>Please use the password reset flow to complete your organizer setup.</p>",
      "<p>Once complete, sign in and you will be routed to /organizer.</p>",
    ].join("");
  }

  return [
    `<p>Hello ${payload.applicantName},</p>`,
    `<p>Your organizer application for ${payload.organizationName} was not approved.</p>`,
    payload.rejectionReason
      ? `<p>Reason: ${payload.rejectionReason}</p>`
      : "",
    payload.statusLink
      ? `<p>You can review your latest status here: <a href="${payload.statusLink}">${payload.statusLink}</a></p>`
      : "",
  ].join("");
}

function buildText(payload: OrganizerEmailPayload) {
  if (payload.messageType === "submission") {
    return [
      `Hello ${payload.applicantName},`,
      `We received your organizer application for ${payload.organizationName}.`,
      payload.statusLink ? `Status link: ${payload.statusLink}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (payload.messageType === "approved") {
    return [
      `Hello ${payload.applicantName},`,
      `Your organizer application for ${payload.organizationName} has been approved.`,
      payload.activationLink
        ? `Set your organizer password here: ${payload.activationLink}`
        : "Use the password reset flow to complete setup.",
      "After setup, sign in and you will land in /organizer.",
    ].join("\n\n");
  }

  return [
    `Hello ${payload.applicantName},`,
    `Your organizer application for ${payload.organizationName} was not approved.`,
    payload.rejectionReason ? `Reason: ${payload.rejectionReason}` : "",
    payload.statusLink ? `Status link: ${payload.statusLink}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function sendOrganizerLifecycleEmail(payload: OrganizerEmailPayload) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getOrganizerEmailFromAddress(),
      to: [payload.recipientEmail],
      subject: buildSubject(payload),
      html: buildHtml(payload),
      text: buildText(payload),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { id?: string };

  return {
    providerMessageId: data.id || null,
  };
}
