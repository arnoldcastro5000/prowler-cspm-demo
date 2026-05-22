import { z } from 'zod'

export const FindingSchema = z.object({
  id: z.string(),
  source: z.literal('prowler'),
  category: z.enum(['storage', 'iam', 'networking', 'logging', 'encryption']),
  provider: z.enum(['aws', 'gcp', 'azure']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string(),
  resource: z.string(),
  check_id: z.string(),
  status: z.enum(['fail', 'pass']),
  scanned_at: z.string(),
  raw: z.record(z.unknown()),
})

export type Finding = z.infer<typeof FindingSchema>
