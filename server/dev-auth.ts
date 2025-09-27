import type { Express, Request, Response, NextFunction } from "express";
import { setupReplitAuth, isAuthenticated as replitIsAuthenticated } from "./replitAuth";

// Setup auth using Replit Auth
export function setupDevAuth(app: Express) {
  console.log("🔧 Setting up Replit Auth integration");
  setupReplitAuth(app);
}

// Use Replit Auth middleware
export const isAuthenticated = replitIsAuthenticated;