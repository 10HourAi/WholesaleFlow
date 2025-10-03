import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Verify required environment variables
if (!process.env.REPL_ID) {
  throw new Error("REPL_ID environment variable is required for Replit Auth");
}

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

// Build the callback URL using Replit environment variables
const getCallbackURL = () => {
  // Try REPLIT_DEV_DOMAIN first (provided in dev mode)
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/callback`;
  }

  // Fall back to constructing from REPL_SLUG and REPL_OWNER
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/callback`;
  }

  throw new Error(
    "Cannot determine callback URL. Missing REPLIT_DEV_DOMAIN or REPL_SLUG/REPL_OWNER",
  );
};

const CALLBACK_URL = getCallbackURL();
console.log("🔐 Replit Auth callback URL:", CALLBACK_URL);

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!,
    );
  },
  { maxAge: 3600 * 1000 },
);

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

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: String(claims["sub"]),
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback,
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Register strategy with the correct callback URL
  const strategy = new Strategy(
    {
      name: "replitauth",
      config,
      scope: "openid email profile offline_access",
      callbackURL: CALLBACK_URL,
    },
    verify,
  );
  passport.use(strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate("replitauth", {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate("replitauth", {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href,
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = (req as any).session;
  const user = req.user as any;

  // Check for traditional session first (email/password users)
  if (session && session.user) {
    console.log("🔐 Traditional session found:", session.user.email);
    return next();
  }

  // Check if user is authenticated via Passport (OAuth)
  if (!req.isAuthenticated()) {
    console.log("❌ No authentication found in request");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // OAuth users have user.claims and user.expires_at
  const isOAuthUser = user && user.claims && user.expires_at;

  if (!isOAuthUser) {
    // Invalid user session
    console.log("❌ Invalid user session - no valid auth data");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // OAuth user - check token expiration and refresh if needed
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    console.log("🔐 OAuth session valid:", user.claims.sub);
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log("❌ OAuth token expired, no refresh token");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    console.log("✅ OAuth token refreshed");
    return next();
  } catch (error) {
    console.log("❌ OAuth token refresh failed:", error);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
