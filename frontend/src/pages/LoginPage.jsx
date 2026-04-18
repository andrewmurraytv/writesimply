import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password, name || "Writer");
        toast.success("Account created");
      } else {
        await login(email, password);
        toast.success("Welcome back");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1570626742839-59acd9822944?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwd3JpdGVyJTIwd29ya3NwYWNlJTIwZGVza3xlbnwwfHx8fDE3NzY1NDMyNzl8MA&ixlib=rb-4.1.0&q=85"
          alt="Writer workspace"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1F1E1D]/40" />
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight font-[Manrope] leading-none">
            WriteSimply
          </h1>
          <p className="mt-4 text-lg text-white/80 font-[Manrope] max-w-md">
            Your personal article workspace. Capture ideas, draft with intention, publish with clarity.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FAF9F5]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10">
            <h1 className="text-3xl font-bold text-[#1F1E1D] tracking-tight font-[Manrope]">
              WriteSimply
            </h1>
            <p className="mt-2 text-sm text-[#78716C] font-[Manrope]">
              Write simply. Publish boldly.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-[#1F1E1D] font-[Manrope] tracking-tight">
            {isRegister ? "Create account" : "Sign in"}
          </h2>
          <p className="mt-2 text-sm text-[#78716C] font-[Manrope]">
            {isRegister ? "Start your writing journey" : "Welcome back to your workspace"}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-[#4A4541] mb-1.5 font-[Manrope]">Name</label>
                <Input
                  data-testid="register-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-white border-[#E6E4DD] focus-visible:ring-[#1F1E1D]"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[#4A4541] mb-1.5 font-[Manrope]">Email</label>
              <Input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-white border-[#E6E4DD] focus-visible:ring-[#1F1E1D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4541] mb-1.5 font-[Manrope]">Password</label>
              <Input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="bg-white border-[#E6E4DD] focus-visible:ring-[#1F1E1D]"
              />
            </div>

            {error && (
              <p data-testid="auth-error-message" className="text-sm text-[#991B1B] font-[Manrope]">{error}</p>
            )}

            <Button
              data-testid="auth-submit-button"
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1F1E1D] text-[#FAF9F5] hover:bg-[#1F1E1D]/90 font-[Manrope]"
            >
              {submitting ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              data-testid="toggle-auth-mode"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-sm text-[#78716C] hover:text-[#1F1E1D] font-[Manrope] transition-colors"
            >
              {isRegister ? "Already have an account? Sign in" : "Need an account? Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
