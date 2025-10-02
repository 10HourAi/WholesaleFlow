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

export const getOidcConfig = memoize(
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

  // Build list of all domain variants
  const allDomains = new Set<string>();
  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    allDomains.add(domain.trim());
    
    // Add .repl.co variant if domain ends with .replit.dev
    if (domain.endsWith('.replit.dev')) {
      allDomains.add(domain.replace('.replit.dev', '.repl.co'));
    }
    // Add .replit.dev variant if domain ends with .repl.co
    if (domain.endsWith('.repl.co')) {
      allDomains.add(domain.replace('.repl.co', '.replit.dev'));
    }
  }

  const domainArray = Array.from(allDomains);
  console.log("🔧 Registering Replit Auth for all domain variants:", domainArray);

  // Register a strategy for each domain variant
  for (const domain of domainArray) {
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
    console.log(`✅ Registered strategy for: ${domain}`);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const domain = req.hostname;
    console.log(`🔐 Login attempt from domain: ${domain}`);
    
    // Use the strategy matching the current domain
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      failureRedirect: "/auth",
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    let domain = req.hostname;
    console.log(`🔐 Callback from domain: ${domain}`);
    console.log(`🔐 Callback query params:`, req.query);
    console.log(`🔐 Session ID:`, req.sessionID);
    
    // Try the current domain first, then try the alternate variant
    const tryAuth = (strategyName: string) => {
      return new Promise((resolve, reject) => {
        passport.authenticate(strategyName, (err: any, user: any, info: any) => {
          if (err || !user) {
            reject(err || new Error('No user'));
          } else {
            resolve(user);
          }
        })(req, res, next);
      });
    };
    
    const authenticate = async () => {
      try {
        // Try current domain
        let user = await tryAuth(`replitauth:${domain}`).catch(() => null);
        
        // If failed and domain is .repl.co, try .replit.dev
        if (!user && domain.endsWith('.repl.co')) {
          const altDomain = domain.replace('.repl.co', '.replit.dev');
          console.log(`🔄 Trying alternate domain: ${altDomain}`);
          user = await tryAuth(`replitauth:${altDomain}`).catch(() => null);
        }
        
        // If failed and domain is .replit.dev, try .repl.co
        if (!user && domain.endsWith('.replit.dev')) {
          const altDomain = domain.replace('.replit.dev', '.repl.co');
          console.log(`🔄 Trying alternate domain: ${altDomain}`);
          user = await tryAuth(`replitauth:${altDomain}`).catch(() => null);
        }
        
        if (!user) {
          console.error(`❌ No user returned from auth for any domain variant`);
          return res.redirect("/auth?error=no_user");
        }
        
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error(`❌ Login error:`, loginErr);
            return res.redirect("/auth?error=login_error");
          }
          console.log(`✅ User logged in successfully:`, (user as any).claims?.sub);
          return res.redirect("/");
        });
      } catch (error) {
        console.error(`❌ Auth error:`, error);
        return res.redirect("/auth?error=auth_error");
      }
    };
    
    authenticate();
  });

  app.get("/api/logout", (req, res) => {
    const user = req.user as any;
    
    req.logout(() => {
      // Check if this was an OAuth user (has claims and expires_at)
      // vs traditional email/password user (no claims)
      if (user?.claims && user?.expires_at) {
        // OAuth user - redirect to Replit's logout
        console.log("🔐 OAuth user logout - redirecting to Replit logout");
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      } else {
        // Traditional email/password user - just redirect to home
        console.log("🔐 Traditional user logout - redirecting to home");
        res.redirect("/");
      }
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