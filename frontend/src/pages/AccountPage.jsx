import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FEATURE_LABELS = {
  "expand-idea": "Flesh out an idea",
  "suggest-metadata": "Tag & headline suggestions",
};

// Sub-cent totals are the normal case here, so a plain 2dp format would show
// "$0.00" for every real call and read as broken.
const money = (n) => {
  if (!n) return "$0.00";
  if (n < 0.01) return `<$0.01`;
  return `$${n.toFixed(2)}`;
};
const exact = (n) => `$${(n || 0).toFixed(4)}`;
const num = (n) => (n || 0).toLocaleString();

export default function AccountPage() {
  const { user, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API}/usage`);
        if (!res.ok) throw new Error();
        setUsage(await res.json());
      } catch {
        toast.error("Could not load usage");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  const features = Object.entries(usage?.by_feature || {});

  return (
    <div className="min-h-screen bg-[#FAF9F5]" data-testid="account-page">
      <header className="border-b border-[#E6E4DD] bg-[#FAF9F5] sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 md:px-12 h-16 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            data-testid="account-back"
            onClick={() => navigate("/")}
            className="text-[#78716C] hover:text-[#1F1E1D] h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          <FileText className="w-5 h-5 text-[#C96442]" strokeWidth={1.5} />
          <h1 className="text-lg font-bold text-[#1F1E1D] font-[Manrope] tracking-tight">Account</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-12 py-10 space-y-10 font-[Manrope]">
        <section>
          <h2 className="text-xs font-medium text-[#78716C] uppercase tracking-wider mb-2">Signed in as</h2>
          <p className="text-[#1F1E1D]">{user?.name || user?.email}</p>
          {user?.name && <p className="text-sm text-[#78716C]">{user.email}</p>}
        </section>

        {loading ? (
          <p className="text-sm text-[#78716C]">Loading usage...</p>
        ) : usage ? (
          <>
            <section>
              <h2 className="text-xs font-medium text-[#78716C] uppercase tracking-wider mb-3">Estimated AI cost</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#FCFBF8] border border-[#E6E4DD] rounded-lg" data-testid="cost-this-month">
                  <p className="text-2xl font-bold text-[#1F1E1D] tabular-nums">{money(usage.this_month.cost_usd)}</p>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    This month · {num(usage.this_month.calls)} {usage.this_month.calls === 1 ? "call" : "calls"}
                  </p>
                  <p className="text-[0.625rem] text-[#A8A29E] mt-1 tabular-nums">{exact(usage.this_month.cost_usd)}</p>
                </div>
                <div className="p-4 bg-[#FCFBF8] border border-[#E6E4DD] rounded-lg" data-testid="cost-all-time">
                  <p className="text-2xl font-bold text-[#1F1E1D] tabular-nums">{money(usage.all_time.cost_usd)}</p>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    All time · {num(usage.all_time.calls)} {usage.all_time.calls === 1 ? "call" : "calls"}
                  </p>
                  <p className="text-[0.625rem] text-[#A8A29E] mt-1 tabular-nums">{exact(usage.all_time.cost_usd)}</p>
                </div>
              </div>
              <p className="text-xs text-[#78716C] leading-relaxed mt-3">
                An estimate, not a bill. It prices the tokens Anthropic reported for each call against
                the published rates{usage.rates ? ` for ${usage.model} ($${usage.rates.input}/M in, $${usage.rates.output}/M out)` : ` for ${usage.model}`}.
                It can't see prompt-cache discounts or anything spent outside this app, so check
                your Anthropic console for the real figure.
              </p>
            </section>

            {features.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-[#78716C] uppercase tracking-wider mb-3">By feature</h2>
                <table className="w-full text-sm" data-testid="usage-by-feature">
                  <thead>
                    <tr className="text-left text-xs text-[#A8A29E] border-b border-[#E6E4DD]">
                      <th className="pb-2 font-medium">Feature</th>
                      <th className="pb-2 font-medium text-right">Calls</th>
                      <th className="pb-2 font-medium text-right">Tokens in / out</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map(([key, t]) => (
                      <tr key={key} className="border-b border-[#E6E4DD] last:border-0">
                        <td className="py-2 text-[#1F1E1D]">{FEATURE_LABELS[key] || key}</td>
                        <td className="py-2 text-right tabular-nums text-[#78716C]">{num(t.calls)}</td>
                        <td className="py-2 text-right tabular-nums text-[#78716C]">
                          {num(t.input_tokens)} / {num(t.output_tokens)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[#1F1E1D]">{exact(t.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {usage.all_time.calls === 0 && (
              <p className="text-sm text-[#78716C]">
                No AI calls yet. Costs appear here once you use Flesh out or AI Suggest.
              </p>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
