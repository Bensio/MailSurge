import { Inngest } from 'inngest';

// Initialize Inngest client
// INNGEST_EVENT_KEY is required for sending events
// INNGEST_SIGNING_KEY is required for the serve endpoint
export const inngest = new Inngest({ 
  id: 'mailsurge',
  name: 'MailSurge',
  eventKey: typeof process !== 'undefined' ? process.env.INNGEST_EVENT_KEY : undefined,
});

