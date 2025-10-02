
import { Issuer, Client, generators } from 'openid-client';
import type { Express } from 'express';

let oidcClient: Client | null = null;

export async function setupOIDC(app: Express) {
  try {
    // Discover Replit's OIDC configuration
    const replitIssuer = await Issuer.discover('https://replit.com');
    
    // Create OIDC client
    oidcClient = new replitIssuer.Client({
      client_id: process.env.REPLIT_OIDC_CLIENT_ID || '',
      client_secret: process.env.REPLIT_OIDC_CLIENT_SECRET || '',
      redirect_uris: [`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/auth/oidc/callback`],
      response_types: ['code'],
    });

    console.log('✅ Replit OIDC client configured');
    
    // OIDC Login Endpoint
    app.get('/api/auth/oidc/login', (req: any, res) => {
      const codeVerifier = generators.codeVerifier();
      const codeChallenge = generators.codeChallenge(codeVerifier);
      
      // Store code verifier in session
      req.session.codeVerifier = codeVerifier;
      
      const authUrl = oidcClient!.authorizationUrl({
        scope: 'openid profile email',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      
      res.redirect(authUrl);
    });

    // OIDC Callback Endpoint
    app.get('/api/auth/oidc/callback', async (req: any, res) => {
      try {
        const params = oidcClient!.callbackParams(req);
        const codeVerifier = req.session.codeVerifier;
        
        if (!codeVerifier) {
          throw new Error('Code verifier not found in session');
        }
        
        // Exchange authorization code for tokens
        const tokenSet = await oidcClient!.callback(
          `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/auth/oidc/callback`,
          params,
          { code_verifier: codeVerifier }
        );
        
        // Get user info
        const userInfo = await oidcClient!.userinfo(tokenSet.access_token!);
        
        // Import storage
        const { storage } = await import('./storage');
        
        // Upsert user in database
        const user = await storage.upsertUser({
          id: userInfo.sub,
          email: userInfo.email as string,
          firstName: (userInfo.given_name as string) || '',
          lastName: (userInfo.family_name as string) || '',
          profileImageUrl: (userInfo.picture as string) || null,
        });
        
        // Clear logout flag and create session
        req.session.loggedOut = false;
        req.session.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName} ${user.lastName}`,
          profileImage: user.profileImageUrl,
        };
        
        // Clear code verifier
        delete req.session.codeVerifier;
        
        console.log('✅ OIDC login successful:', user.email);
        
        // Redirect to home
        res.redirect('/');
      } catch (error: any) {
        console.error('❌ OIDC callback error:', error);
        res.redirect('/auth?error=oidc_failed');
      }
    });

    return oidcClient;
  } catch (error) {
    console.error('❌ Failed to setup OIDC:', error);
    return null;
  }
}

export function getOIDCClient() {
  return oidcClient;
}
