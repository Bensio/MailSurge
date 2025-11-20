import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  subject: z.string().min(1, 'Subject is required').max(500),
  body_html: z.string().min(1, 'Email body is required'),
  body_text: z.string().min(1, 'Plain text version is required'),
  from_email: z.string().email('Invalid from email address').optional().nullable().or(z.literal('').transform(() => null)),
  settings: z.object({
    delay: z.number().min(1).max(300).default(45),
    ccEmail: z.string().email().optional().nullable().or(z.literal('').transform(() => null)),
  }).optional(),
});

export const ContactSchema = z.object({
  email: z.string().email('Invalid email address'),
  company: z.string().min(1, 'Company name is required'),
  custom_fields: z.record(z.string()).optional(),
});

export const ContactsUploadSchema = z.array(ContactSchema);

