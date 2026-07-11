import { z } from "zod";

const nonEmpty = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

export const storyInputSchema = z.object({
  projectId: nonEmpty("Project"),
  domainId: nonEmpty("Business domain"),
  title: nonEmpty("Story title"),
  userRole: nonEmpty("User role"),
  goal: nonEmpty("Goal"),
  businessValue: nonEmpty("Business value"),
  description: nonEmpty("Description"),
  acceptanceCriteria: z.string().optional(),
  businessRules: z.string().optional(),
  edgeCases: z.string().optional(),
});
export type StoryInput = z.infer<typeof storyInputSchema>;

export const projectInputSchema = z.object({
  name: nonEmpty("Project name"),
  description: z.string().optional(),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const domainInputSchema = z.object({
  name: nonEmpty("Domain name"),
  description: z.string().optional(),
});
export type DomainInput = z.infer<typeof domainInputSchema>;

export const documentInputSchema = z.object({
  title: nonEmpty("Document title"),
  contentText: nonEmpty("Document content"),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;

export const authSignupSchema = z.object({
  fullName: nonEmpty("Full name"),
  tenantName: nonEmpty("Organization name"),
  email: z.string().trim().email("A valid email is required"),
  // Cap at 72 bytes because bcrypt silently ignores input beyond that length.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});
export type AuthSignupInput = z.infer<typeof authSignupSchema>;

export const authLoginSchema = z.object({
  email: z.string().trim().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
