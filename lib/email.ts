import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Default sender is Resend's shared test address. NOTE: with this sender Resend
// will ONLY deliver to the email you registered your Resend account with.
// To send anywhere else, verify a domain and set RESEND_FROM (e.g. "Kin <kin@yourdomain.com>").
const FROM = process.env.RESEND_FROM || "Kin <onboarding@resend.dev>";

export interface TaskNotification {
  userMessage: string;
  kinReply: string;
  taskTitle: string;
  taskCategory: string;
  taskStatus: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export function emailConfig() {
  return {
    hasKey: !!process.env.RESEND_API_KEY,
    recipient: process.env.NOTIFICATION_EMAIL ?? null,
    from: FROM,
  };
}

// Who a notification goes to: the user's own email when provided, else the
// owner inbox (NOTIFICATION_EMAIL). The owner is bcc'd on user-bound sends so
// every request stays visible for manual fulfillment.
export function resolveRecipients(
  userEmail: string | null | undefined,
  owner: string | null | undefined
): { to: string; bcc?: string } | null {
  const to = userEmail || owner;
  if (!to) return null;
  const bcc = owner && owner.toLowerCase() !== to.toLowerCase() ? owner : undefined;
  return bcc ? { to, bcc } : { to };
}

async function send(subject: string, html: string, userEmail?: string | null): Promise<SendResult> {
  if (!resend) return { ok: false, error: "RESEND_API_KEY is not set on the server" };
  const recipients = resolveRecipients(userEmail, process.env.NOTIFICATION_EMAIL);
  if (!recipients) return { ok: false, error: "No recipient: no user email and NOTIFICATION_EMAIL is not set" };

  try {
    const { data, error } = await resend.emails.send({ from: FROM, subject, html, ...recipients });
    if (error) {
      // Resend returns API errors here (e.g. 403 test-sender restriction) without throwing
      console.error("[email] Resend rejected the send:", error);
      const e = error as { name?: string; message?: string };
      return { ok: false, error: `${e.name ?? "error"}: ${e.message ?? JSON.stringify(error)}` };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("[email] send threw:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendTaskNotification(
  n: TaskNotification,
  opts?: { userEmail?: string | null }
): Promise<SendResult> {
  const res = await send(`Kin · ${n.taskTitle}`, renderTaskHtml(n), opts?.userEmail);
  if (!res.ok) console.error("[email] task notification failed:", res.error);
  return res;
}

export async function sendTestEmail(): Promise<SendResult> {
  return send(
    "Kin · Test notification",
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
       <p style="margin: 0 0 4px; font-size: 13px; color: #15c489; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Kin Family Assistant</p>
       <h1 style="margin: 0 0 12px; font-size: 20px;">✅ Email notifications are working</h1>
       <p style="margin: 0; font-size: 15px; color: #444;">If you're reading this in your inbox, your Resend setup is configured correctly. Task requests will now be emailed here.</p>
     </div>`
  );
}

function renderTaskHtml(n: TaskNotification): string {
  const categoryLabel: Record<string, string> = {
    lawn: "🌿 Lawn & Yard",
    reminder: "🔔 Reminder",
    general: "📋 General",
    booking: "📅 Booking",
    errand: "🛒 Errand",
  };
  const statusLabel: Record<string, string> = {
    pending: "Pending",
    in_progress: "In progress",
    done: "Done",
  };
  const category = categoryLabel[n.taskCategory] ?? n.taskCategory;
  const status = statusLabel[n.taskStatus] ?? n.taskStatus;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">

      <p style="margin: 0 0 4px; font-size: 13px; color: #15c489; font-weight: 600;
                letter-spacing: 0.05em; text-transform: uppercase;">Kin Family Assistant</p>
      <h1 style="margin: 0 0 24px; font-size: 20px; font-weight: 700;">
        New request received
      </h1>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px 16px; background: #f9f9f9; border-radius: 8px 8px 0 0;
                     border-bottom: 1px solid #eee; font-size: 13px; color: #555; width: 90px;">
            You asked
          </td>
          <td style="padding: 12px 16px; background: #f9f9f9; border-radius: 8px 8px 0 0;
                     border-bottom: 1px solid #eee; font-size: 15px;">
            ${escapeHtml(n.userMessage)}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background: #f9f9f9;
                     font-size: 13px; color: #555; vertical-align: top;">
            Kin said
          </td>
          <td style="padding: 12px 16px; background: #f9f9f9; font-size: 15px; color: #333;">
            ${escapeHtml(n.kinReply)}
          </td>
        </tr>
      </table>

      <div style="margin-bottom: 32px;">
        <span style="display: inline-block; padding: 4px 10px; background: #f0fdf9;
                     color: #15c489; border: 1px solid #bbf0e0; border-radius: 20px;
                     font-size: 12px; font-weight: 500;">
          ${category}
        </span>
        <span style="display: inline-block; padding: 4px 10px; background: #f5f5f5;
                     color: #555; border: 1px solid #e0e0e0; border-radius: 20px;
                     font-size: 12px;">
          ${status}
        </span>
      </div>

      <p style="margin: 0; font-size: 12px; color: #aaa;">
        This is a notification from your Kin dashboard — no action needed yet.
        Full automation coming soon.
      </p>
    </div>
  `;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
