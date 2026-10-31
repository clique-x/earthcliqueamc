import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isDev } from "../env";
import { forbidden, unauthorized } from "./http";

export type AuthUser =
  | { role: "engineer"; sub: string }
  | { role: "company"; sub: string; companyId: string; companyRole: "admin" | "user" }
  | { role: "vendor"; sub: string; vendorId: string; vendorRole: "admin" | "member" }
  | { role: "admin"; sub: string };

export type Role = AuthUser["role"];

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export const COOKIE_NAMES = { company: "amc_company", vendor: "amc_vendor", admin: "amc_admin" } as const;
export type CookieRole = keyof typeof COOKIE_NAMES;
const TOKEN_TTL: Record<Role, string> = { engineer: "30d", company: "7d", vendor: "7d", admin: "12h" };

export function signToken(app: FastifyInstance, user: AuthUser): string {
  return app.jwt.sign(user, { expiresIn: TOKEN_TTL[user.role] });
}

export function setSessionCookie(reply: FastifyReply, role: CookieRole, token: string) {
  reply.setCookie(COOKIE_NAMES[role], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !isDev,
    path: "/",
    maxAge: role === "admin" ? 12 * 3600 : 7 * 24 * 3600,
  });
}

export function clearSessionCookie(reply: FastifyReply, role: CookieRole) {
  reply.clearCookie(COOKIE_NAMES[role], { path: "/" });
}

function tokenFor(req: FastifyRequest, role: Role): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  if (role !== "engineer") return req.cookies[COOKIE_NAMES[role]];
  return undefined;
}

export function verifyToken(app: FastifyInstance, token: string): AuthUser | null {
  try {
    return app.jwt.verify<AuthUser>(token);
  } catch {
    return null;
  }
}

/** Authenticates the request as the given role; returns the user. */
export function authenticate(req: FastifyRequest, role: Role): AuthUser {
  const token = tokenFor(req, role);
  if (!token) throw unauthorized();
  const user = verifyToken(req.server, token);
  if (!user) throw unauthorized("Session expired — sign in again");
  if (user.role !== role) throw forbidden();
  req.user = user;
  return user;
}

export const requireRole = (role: Role) => async (req: FastifyRequest) => {
  authenticate(req, role);
};

export function engineerId(req: FastifyRequest): string {
  if (req.user.role !== "engineer") throw forbidden();
  return req.user.sub;
}

export function companyUser(req: FastifyRequest) {
  if (req.user.role !== "company") throw forbidden();
  return req.user;
}

export function vendorUser(req: FastifyRequest) {
  if (req.user.role !== "vendor") throw forbidden();
  return req.user;
}

export function adminId(req: FastifyRequest): string {
  if (req.user.role !== "admin") throw forbidden();
  return req.user.sub;
}
