import { prisma } from './prisma';

/**
 * Upsert a client by email - quick helper for storing and reusing client addresses
 */
export async function upsertClientByEmail(params: {
  email: string;
  name?: string;
  company?: string;
}) {
  return prisma.client.upsert({
    where: { email: params.email },
    update: {
      name: params.name,
      company: params.company,
      updatedAt: new Date(),
    },
    create: {
      email: params.email,
      name: params.name || params.email.split('@')[0],
      company: params.company,
    },
  });
}

