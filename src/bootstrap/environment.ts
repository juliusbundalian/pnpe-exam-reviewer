import { z } from 'zod';

const environmentSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('unconfigured') }),
  z.object({
    mode: z.literal('configured'),
    projectId: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/),
  }),
  z.object({
    mode: z.literal('emulator'),
    projectId: z.literal('demo-pnpe'),
    emulatorHost: z.enum(['127.0.0.1', 'localhost', '10.0.2.2']),
    authPort: z.number().int().min(1).max(65535).optional(),
    firestorePort: z.number().int().min(1).max(65535).optional(),
  }),
]);
export type FirebaseEnvironment = z.infer<typeof environmentSchema>;
export function parseFirebaseEnvironment(input: unknown): FirebaseEnvironment {
  const result = environmentSchema.safeParse(input);
  return result.success ? result.data : { mode: 'unconfigured' };
}
