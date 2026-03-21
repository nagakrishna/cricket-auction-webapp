import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";

export async function login(input: unknown) {
  const values = loginSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { email: values.email.toLowerCase() },
  });

  if (!user) {
    return { ok: false as const, error: "Invalid credentials." };
  }

  const isValid = await verifyPassword(values.password, user.passwordHash);

  if (!isValid) {
    return { ok: false as const, error: "Invalid credentials." };
  }

  return {
    ok: true as const,
    userId: user.id,
    role: user.role,
  };
}
