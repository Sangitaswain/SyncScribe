import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config";

interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Every message sent, kept in memory so tests and local demos can read the links. */
export const sentMail: Mail[] = [];

let transport: Promise<Transporter | null> | undefined;

// SMTP_URL if set; otherwise a free Ethereal test inbox; otherwise console only (BP-9).
const getTransport = () =>
  (transport ??= (async () => {
    if (config.SMTP_URL) return nodemailer.createTransport(config.SMTP_URL);
    if (process.env.VITEST) return null;
    try {
      const acc = await nodemailer.createTestAccount();
      return nodemailer.createTransport({ host: acc.smtp.host, port: acc.smtp.port, secure: acc.smtp.secure, auth: acc });
    } catch {
      return null;
    }
  })());

export const sendMail = async (mail: Mail) => {
  sentMail.push(mail);
  console.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
  try {
    const t = await getTransport();
    if (!t) return;
    const info = await t.sendMail({ from: "SyncScribe <no-reply@syncscribe.local>", ...mail });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[mail] preview: ${preview}`);
  } catch (e) {
    console.warn("[mail] could not send:", (e as Error).message);
  }
};
