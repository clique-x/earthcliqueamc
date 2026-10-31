import { admins, companies, companyUsers, db, engineers, eq, hashPassword, sql, vendorUsers, vendors, verifyPassword } from "@amc/db";
import { companySignupSchema, engineerOtpRequestSchema, engineerOtpVerifySchema, passwordLoginSchema, vendorSignupSchema } from "@amc/shared";
import type { FastifyInstance } from "fastify";
import { clearSessionCookie, setSessionCookie, signToken } from "../lib/auth";
import { conflict, parse, unauthorized } from "../lib/http";
import { consumeLoginOtp, issueLoginOtp } from "../lib/otp";

const strictLimit = { rateLimit: { max: 5, timeWindow: "1 minute" } };
const loginLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/engineer/otp/request", { config: strictLimit }, async (req) => {
    const { phone } = parse(engineerOtpRequestSchema, req.body);
    const devCode = await issueLoginOtp(phone);
    return { ok: true, devCode };
  });

  app.post("/auth/engineer/otp/verify", { config: loginLimit }, async (req) => {
    const { phone, code } = parse(engineerOtpVerifySchema, req.body);
    await consumeLoginOtp(phone, code);
    const [engineer] = await db
      .insert(engineers)
      .values({ phone })
      .onConflictDoUpdate({ target: engineers.phone, set: { phone } })
      .returning();
    const token = signToken(app, { role: "engineer", sub: engineer!.id });
    return { token, engineer: { id: engineer!.id, status: engineer!.status, name: engineer!.name } };
  });

  app.post("/auth/company/signup", { config: strictLimit }, async (req, reply) => {
    const input = parse(companySignupSchema, req.body);
    const taken = await db.query.companyUsers.findFirst({ where: sql`lower(${companyUsers.email}) = lower(${input.email})` });
    if (taken) throw conflict("An account with this email already exists");
    const passwordHash = await hashPassword(input.password);
    const { user, company } = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({ name: input.companyName, gstin: input.gstin || null }).returning();
      const [user] = await tx
        .insert(companyUsers)
        .values({ companyId: company!.id, name: input.name, email: input.email, phone: input.phone, role: "admin", passwordHash })
        .returning();
      return { user: user!, company: company! };
    });
    setSessionCookie(reply, "company", signToken(app, { role: "company", sub: user.id, companyId: company.id, companyRole: "admin" }));
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, company: { id: company.id, name: company.name } };
  });

  app.post("/auth/company/login", { config: loginLimit }, async (req, reply) => {
    const { email, password } = parse(passwordLoginSchema, req.body);
    const user = await db.query.companyUsers.findFirst({ where: sql`lower(${companyUsers.email}) = lower(${email})` });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw unauthorized("Wrong email or password");
    setSessionCookie(reply, "company", signToken(app, { role: "company", sub: user.id, companyId: user.companyId, companyRole: user.role }));
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });

  app.post("/auth/company/logout", async (_req, reply) => {
    clearSessionCookie(reply, "company");
    return { ok: true };
  });

  app.post("/auth/vendor/signup", { config: strictLimit }, async (req, reply) => {
    const input = parse(vendorSignupSchema, req.body);
    const [emailTaken, gstTaken] = await Promise.all([
      db.query.vendorUsers.findFirst({ where: sql`lower(${vendorUsers.email}) = lower(${input.email})` }),
      db.query.vendors.findFirst({ where: eq(vendors.gstin, input.gstin) }),
    ]);
    if (emailTaken) throw conflict("An account with this email already exists");
    if (gstTaken) throw conflict("A vendor with this GSTIN is already registered — ask your admin to add you as a team member");
    const passwordHash = await hashPassword(input.password);
    const { user, vendor } = await db.transaction(async (tx) => {
      const [vendor] = await tx
        .insert(vendors)
        .values({ name: input.vendorName, gstin: input.gstin, city: input.city, states: [input.state], categories: input.categories })
        .returning();
      const [user] = await tx
        .insert(vendorUsers)
        .values({ vendorId: vendor!.id, name: input.name, email: input.email, phone: input.phone, role: "admin", passwordHash })
        .returning();
      return { user: user!, vendor: vendor! };
    });
    setSessionCookie(reply, "vendor", signToken(app, { role: "vendor", sub: user.id, vendorId: vendor.id, vendorRole: "admin" }));
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, vendor: { id: vendor.id, name: vendor.name, status: vendor.status } };
  });

  app.post("/auth/vendor/login", { config: loginLimit }, async (req, reply) => {
    const { email, password } = parse(passwordLoginSchema, req.body);
    const user = await db.query.vendorUsers.findFirst({ where: sql`lower(${vendorUsers.email}) = lower(${email})` });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw unauthorized("Wrong email or password");
    setSessionCookie(reply, "vendor", signToken(app, { role: "vendor", sub: user.id, vendorId: user.vendorId, vendorRole: user.role }));
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });

  app.post("/auth/vendor/logout", async (_req, reply) => {
    clearSessionCookie(reply, "vendor");
    return { ok: true };
  });

  app.post("/auth/admin/login", { config: loginLimit }, async (req, reply) => {
    const { email, password } = parse(passwordLoginSchema, req.body);
    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email.toLowerCase()) });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) throw unauthorized("Wrong email or password");
    setSessionCookie(reply, "admin", signToken(app, { role: "admin", sub: admin.id }));
    return { admin: { id: admin.id, name: admin.name, email: admin.email } };
  });

  app.post("/auth/admin/logout", async (_req, reply) => {
    clearSessionCookie(reply, "admin");
    return { ok: true };
  });
}
