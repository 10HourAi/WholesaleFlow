
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Mail, Lock, User, ArrowRight } from "lucide-react";

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/signup";
      const body = isLogin 
        ? { email, password }
        : { email, password, firstName, lastName };

      console.log("🔐 Submitting auth request:", { endpoint, email, isLogin });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: 'include', // Important for session cookies
      });

      const result = await response.json();
      console.log("🔐 Auth response:", result);

      if (response.ok && result.success) {
        console.log("✅ Auth successful, redirecting...");
        if (isLogin) {
          // For login, redirect to home
          window.location.href = "/";
        } else {
          // For signup, show success message and switch to login
          alert("Account created successfully! Please log in with your email and password.");
          setIsLogin(true);
          // Clear form but keep email for convenience
          setPassword("");
          setFirstName("");
          setLastName("");
        }
      } else {
        alert(result.message || "Authentication failed");
      }
    } catch (error) {
      console.error("❌ Auth error:", error);
      alert("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReplitAuth = () => {
    // Simply redirect to the Replit login endpoint
    // The server will handle the OAuth flow for the current domain
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-blue-600 mr-2" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              10HourAi
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            AI-powered real estate wholesaling platform
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin 
                ? "Sign in to your account to continue" 
                : "Sign up to start your real estate journey"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Replit Auth - Primary Option */}
            <Button 
              onClick={handleReplitAuth}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              size="lg"
              disabled={loading}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {loading ? "Loading..." : "Continue with Replit"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Traditional Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" variant="outline" disabled={loading}>
                {loading ? "Processing..." : (isLogin ? "Sign in" : "Create account")}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </button>
            </div>

            {isLogin && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-xs text-slate-500">
          By continuing, you agree to our{" "}
          <a href="#" className="hover:underline">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="hover:underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
