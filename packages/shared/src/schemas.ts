// Request body schemas shared by the web client and the server (BACKEND_PLAN.md BP-5).
import { z } from "zod";

const shareRole = z.enum(["editor", "commenter", "viewer"]);
const id = z.string().min(1).max(64);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(200),
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const forgotSchema = z.object({ email: z.email() });
export const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(200) });
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const workspaceCreateSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const memberInviteSchema = z.object({ email: z.email(), role: shareRole });
export const roleUpdateSchema = z.object({ role: shareRole });

export const shareCreateSchema = z.object({ resourceId: id, email: z.email(), role: shareRole });
export const shareLinkCreateSchema = z.object({ resourceId: id, role: shareRole });

export const versionNameSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const notificationsReadSchema = z.object({ ids: z.array(id).min(1) });
export const mentionSchema = z.object({ docId: id, threadId: id, userIds: z.array(id).min(1) });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
export type ShareLinkCreateInput = z.infer<typeof shareLinkCreateSchema>;
export type MentionInput = z.infer<typeof mentionSchema>;
