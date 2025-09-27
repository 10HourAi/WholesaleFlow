
import type { Express, Request, Response, NextFunction } from "express";

// Simple dev auth setup - you can replace this with your actual auth logic
export function setupDevAuth(app: Express) {
  // Add any dev-specific auth setup here
  console.log("🔧 Dev auth middleware setup complete");
}

// Authentication middleware
export function isAuthenticated(req: any, res: Response, next: NextFunction) {
  // For now, create a mock user for development
  // Replace this with actual Replit Auth logic
  if (!req.user) {
    req.user = {
      claims: {
        sub: "dev-user-123", // Mock user ID
        email: "dev@example.com"
      }
    };
  }
  
  next();
}
