import { env } from "../env";

export type Email = { to: string[]; subject: string; text: string };

interface EmailProvider {
  send(email: Email): Promise<void>;
}

// Dev-only provider: prints the message to the API log. Swap for SendGrid / Resend in production.
const consoleProvider: EmailProvider = {
  async send(email) {
    console.info(`[email:console] To: ${email.to.join(", ")}\n  Subject: ${email.subject}\n  ${email.text.replace(/\n/g, "\n  ")}`);
  },
};

const provider: EmailProvider = consoleProvider;

export async function sendEmail(email: Email): Promise<void> {
  if (email.to.length === 0) return;
  try {
    await provider.send(email);
  } catch (err) {
    console.error("[email] send failed", err);
  }
}

export const portalUrl = (path: string) => `${env.WEB_ORIGIN.split(",")[0]}${path}`;
