import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import MemoryStore from "memorystore";

// Check if running in local development mode (not on Replit)
// Use REPL_ID as the primary indicator since it's always set on Replit
const isLocalDevelopment = !process.env.REPL_ID;

if (isLocalDevelopment) {
  console.log("🏠 Running in LOCAL DEVELOPMENT mode - Replit Auth disabled");
  console.log("✅ Using memory-based sessions for local development");
} else {
  console.log("🚀 Running on REPLIT - Replit Auth enabled");
  console.log("📋 REPL_ID:", process.env.REPL_ID);
  console.log("📋 REPLIT_DOMAINS:", process.env.REPLIT_DOMAINS);
}

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

  // Use memory store for local development, PostgreSQL for production
  let sessionStore;
  if (isLocalDevelopment) {
    const MemoryStoreSession = MemoryStore(session);
    sessionStore = new MemoryStoreSession({
      checkPeriod: sessionTtl,
    });
    console.log("💾 Using in-memory session store for local development");
  } else {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  }

  return session({
    secret:
      process.env.SESSION_SECRET || "local-dev-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isLocalDevelopment, // Only require HTTPS in production
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

  // Skip Replit OAuth setup in local development
  if (isLocalDevelopment) {
    console.log(
      "⚠️  Replit OAuth disabled - using email/password authentication only",
    );
    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));
    return;
  }

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

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const trimmedDomain = domain.trim();
    
    // Register strategy for the original domain
    const strategy = new Strategy(
      {
        name: `replitauth:${trimmedDomain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${trimmedDomain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
    
    // Also register variants (.replit.dev <-> .repl.co) since Replit uses both
    if (trimmedDomain.includes('.replit.dev')) {
      const replCoVariant = trimmedDomain.replace('.replit.dev', '.repl.co');
      const variantStrategy = new Strategy(
        {
          name: `replitauth:${replCoVariant}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${trimmedDomain}/api/callback`,
        },
        verify,
      );
      passport.use(variantStrategy);
    } else if (trimmedDomain.includes('.repl.co')) {
      const replitDevVariant = trimmedDomain.replace('.repl.co', '.replit.dev');
      const variantStrategy = new Strategy(
        {
          name: `replitauth:${replitDevVariant}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${trimmedDomain}/api/callback`,
        },
        verify,
      );
      passport.use(variantStrategy);
    }
    
    console.log(`✅ Registered Replit Auth strategy for: ${trimmedDomain}`);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Try the exact hostname first, then try domain variants
    let strategyName = `replitauth:${req.hostname}`;
    
    // Check if the strategy exists, if not try variants
    const registeredStrategies = Object.keys((passport as any)._strategies);
    
    if (!registeredStrategies.includes(strategyName)) {
      // Try swapping .replit.dev <-> .repl.co
      if (req.hostname.includes('.replit.dev')) {
        strategyName = `replitauth:${req.hostname.replace('.replit.dev', '.repl.co')}`;
      } else if (req.hostname.includes('.repl.co')) {
        strategyName = `replitauth:${req.hostname.replace('.repl.co', '.replit.dev')}`;
      }
    }
    
    console.log(`🔐 Login attempt - hostname: ${req.hostname}, using strategy: ${strategyName}`);
    
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Try the exact hostname first, then try domain variants
    let strategyName = `replitauth:${req.hostname}`;
    
    // Check if the strategy exists, if not try variants
    const registeredStrategies = Object.keys((passport as any)._strategies);
    
    if (!registeredStrategies.includes(strategyName)) {
      // Try swapping .replit.dev <-> .repl.co
      if (req.hostname.includes('.replit.dev')) {
        strategyName = `replitauth:${req.hostname.replace('.replit.dev', '.repl.co')}`;
      } else if (req.hostname.includes('.repl.co')) {
        strategyName = `replitauth:${req.hostname.replace('.repl.co', '.replit.dev')}`;
      }
    }
    
    console.log(`🔐 Callback - hostname: ${req.hostname}, using strategy: ${strategyName}`);
    
    passport.authenticate(strategyName, {
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
  // In local development, check for traditional session
  if (isLocalDevelopment) {
    const session = (req as any).session;
    if (session && session.user) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Replit OAuth authentication
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
