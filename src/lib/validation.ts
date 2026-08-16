import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export const projectSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(120).default(''),
  hikeDate: z.string().nullable().optional(),
  context: z.string().max(2000).default(''),
});
