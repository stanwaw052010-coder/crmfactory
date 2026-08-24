import "server-only";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Мінімальні вимоги до пароля. Повертає список проблем українською. */
export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push("щонайменше 8 символів");
  if (!/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(password)) issues.push("хоча б одну літеру");
  if (!/\d/.test(password)) issues.push("хоча б одну цифру");
  return issues;
}
