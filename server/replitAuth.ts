import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  console.log("✅ Simple Repl Auth configured");
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = req.session as any;

  // Check traditional email/password session
  if (session && session.user) {
    return next();
  }

  // Check Repl Auth headers
  const replitUserId = req.headers['x-replit-user-id'];
  if (replitUserId) {
    // User is authenticated via Repl Auth
    return next();
  }

  res.status(401).json({ message: "Unauthorized" });
};