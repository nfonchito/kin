import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface TaskNotification {
  userMessage: string;
  kinReply: string;
  taskTitle: string;
  taskCategory: string;
  taskStatus: string;
}

export async function sendTaskNotification(n: TaskNotification) {
  const to = process.env.NOTIFICATION_EMAIL;
  if (!resend || !to) return; // skip silently if not configured

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

  await resend.emails.send({
    from: "Kin <onboarding@resend.dev>",
    to,
    subject: `Kin · ${n.taskTitle}`,
    html: `
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

        <div style="display: flex; gap: 8px; margin-bottom: 32px;">
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
    `,
  }).catch(() => {
    // Don't let email failures break the chat response
  });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
