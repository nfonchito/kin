import { NextResponse } from "next/server";
import { emailConfig, sendTestEmail } from "@/lib/email";

// Visit /api/notify-test in your browser to check the email setup.
// It reports whether the env vars are present and attempts a real send,
// returning the verbatim Resend error so failures are easy to diagnose.
export async function GET() {
  const config = emailConfig();

  if (!config.hasKey || !config.recipient) {
    return NextResponse.json({
      ok: false,
      step: "config",
      message: "Missing environment variables on the server.",
      config,
      hint: "Set RESEND_API_KEY and NOTIFICATION_EMAIL in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  const result = await sendTestEmail();

  return NextResponse.json({
    ok: result.ok,
    step: "send",
    config,
    result,
    hint: result.ok
      ? `Sent. Check the inbox for ${config.recipient}.`
      : "Resend rejected the send. If the error mentions 'testing emails' / 'own email address', the recipient must match the email you registered your Resend account with (the onboarding@resend.dev sender only delivers to your own address). Otherwise verify a domain and set RESEND_FROM.",
  });
}
