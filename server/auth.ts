import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "./db.js";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AuthRequest extends Request {
  userId?: string;
}

export async function login(email: string, password: string) {
  const authorizedUser = db.prepare(`
    SELECT * FROM authorized_users WHERE email = ?
  `).get(email) as any;

  if (!authorizedUser) {
    throw new Error("Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, authorizedUser.password_hash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  let user = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(email) as any;

  if (!user) {
    const userId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    db.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (?, ?, ?)
    `).run(userId, email, hashedPassword);

    user = { id: userId, email };
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare(`
      UPDATE users SET password_hash = ? WHERE id = ?
    `).run(hashedPassword, user.id);
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, user.id, token, expiresAt);

  return { token, user: { id: user.id, email: user.email } };
}

export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    const session = db.prepare(`
      SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')
    `).get(token) as any;

    if (!session) {
      throw new Error("Session expired");
    }

    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export async function logout(token: string) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}
