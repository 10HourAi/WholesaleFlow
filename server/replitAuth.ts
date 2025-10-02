import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// REPLIT_DOMAINS is automatically set by Replit environment
if (!process.env.REPLIT_DOMAINS || !process.env.REPL_ID) {
  console.warn("⚠️ REPLIT_DOMAINS or REPL_ID not found - Replit Auth will not be available");
} else {
  console.log("✅ Replit Auth is configured with domain:", process.env.REPLIT_DOMAINS);
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
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
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
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

  // Skip Replit Auth setup if not configured
  if (!process.env.REPLIT_DOMAINS || !process.env.REPL_ID) {
    console.log("⚠️ Replit Auth not configured - only email/password login available");
    return;
  }

  console.log("🔧 Setting up Replit Auth for domains:", process.env.REPLIT_DOMAINS);
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    // Register strategy for the original domain
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);

    // Also register for .repl.co variant if domain ends with .replit.dev
    if (domain.endsWith('.replit.dev')) {
      const replCoVariant = domain.replace('.replit.dev', '.repl.co');
      const replCoStrategy = new Strategy(
        {
          name: `replitauth:${replCoVariant}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${replCoVariant}/api/callback`,
        },
        verify,
      );
      passport.use(replCoStrategy);
      console.log(`🔧 Also registered Replit Auth for domain variant: ${replCoVariant}`);
    }
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const primaryDomain = process.env.REPLIT_DOMAINS!.split(",")[0];
    
    // If user is accessing from .repl.co variant, redirect to .replit.dev first
    if (req.hostname !== primaryDomain) {
      console.log(`🔐 Redirecting from ${req.hostname} to primary domain ${primaryDomain}`);
      return res.redirect(`https://${primaryDomain}/api/login`);
    }
    
    console.log(`🔐 Login attempt from primary domain: ${primaryDomain}`);
    
    // Authenticate with the primary domain strategy
    passport.authenticate(`replitauth:${primaryDomain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      failureRedirect: "/auth",
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Always use the primary domain from REPLIT_DOMAINS env variable
    const primaryDomain = process.env.REPLIT_DOMAINS!.split(",")[0];
    console.log(`🔐 Callback from domain: ${req.hostname}, using strategy for: ${primaryDomain}`);
    console.log(`🔐 Callback query params:`, req.query);
    console.log(`🔐 Session ID:`, req.sessionID);
    
    passport.authenticate(`replitauth:${primaryDomain}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error(`❌ Auth error:`, err);
        return res.redirect("/auth?error=auth_error");
      }
      if (!user) {
        console.error(`❌ No user returned from auth. Info:`, info);
        return res.redirect("/auth?error=no_user");
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error(`❌ Login error:`, loginErr);
          return res.redirect("/auth?error=login_error");
        }
        console.log(`✅ User logged in successfully:`, user.claims?.sub);
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};