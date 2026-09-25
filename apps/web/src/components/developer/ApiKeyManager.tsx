import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../store/auth";
import {
  createApiKey,
  fetchApiKeys,
  revokeApiKey,
} from "../../api/developer";
import type { APIKeyItem } from "../../api/developer";

type UserRole = "buyer" | "vendor" | "admin" | "superadmin" | string;

const TIER_LIMITS: Record<string, number> = {
  FREE: 1000,
  PRO: 10000,
  ENTERPRISE: 100000,
};

export default function ApiKeyManager() {
  const user = useAuth((state) => state.user) as {
    id?: string;
    email?: string;
    role?: UserRole;
  } | null;

  const rawRole = String(user?.role || "")
    .trim()
    .toLowerCase();

  const isBuyer = rawRole === "buyer";
  const isVendor =
    rawRole === "vendor" ||
    rawRole === "admin" ||
    rawRole === "superadmin";

  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [selectedTier, setSelectedTier] = useState("FREE");
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!user) {
      setKeys([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await fetchApiKeys();

      setKeys(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load API keys:", err);

      const status = err?.response?.status;

      if (status === 401) {
        setError("Your session has expired. Please sign in again.");
      } else if (status === 403) {
        setError(
          "You do not have permission to manage developer API keys."
        );
      } else {
        setError(
          err?.response?.data?.detail ||
            "Unable to load your API keys right now."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleGenerate = async () => {
    try {
      setCreating(true);
      setError(null);
      setNewKeyRaw(null);
      setCopied(false);

      const response = await createApiKey(selectedTier);

      const rawKey = response.raw_key || response.api_key;

      if (rawKey) {
        setNewKeyRaw(rawKey);
      }

      setKeys((previous) => {
        const exists = previous.some(
          (item) => item.id === response.id
        );

        if (exists) {
          return previous.map((item) =>
            item.id === response.id ? response : item
          );
        }

        return [response, ...previous];
      });
    } catch (err: any) {
      console.error("Failed to generate API key:", err);

      setError(
        err?.response?.data?.detail ||
          "Failed to generate your API key."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      setRevokingId(keyId);
      setError(null);

      const response = await revokeApiKey(keyId);

      setKeys((previous) =>
        previous.map((item) =>
          item.id === keyId
            ? {
                ...item,
                is_active: response.is_active,
              }
            : item
        )
      );
    } catch (err: any) {
      console.error("Failed to update API key:", err);

      setError(
        err?.response?.data?.detail ||
          "Failed to update the API key."
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyKey = async () => {
    if (!newKeyRaw) return;

    try {
      await navigator.clipboard.writeText(newKeyRaw);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      setError(
        "The key could not be copied automatically. Please select and copy it manually."
      );
    }
  };

  const activeKeys = useMemo(
    () => keys.filter((key) => key.is_active),
    [keys]
  );

  const totalCalls = useMemo(
    () =>
      keys.reduce(
        (total, key) => total + Number(key.calls_made || 0),
        0
      ),
    [keys]
  );

  const canManageKeys = Boolean(user && (isBuyer || isVendor));

  if (!user) {
    return (
      <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5 text-center">
        <div className="w-11 h-11 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl">
          🔐
        </div>

        <h4 className="text-sm font-bold text-white mt-3">
          Sign in required
        </h4>

        <p className="text-[11px] text-slate-500 mt-1">
          Sign in to create and manage your developer API access.
        </p>
      </div>
    );
  }

  if (!canManageKeys) {
    return (
      <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            🔒
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">
              API Access Unavailable
            </h4>

            <p className="text-[10px] text-slate-500 mt-1">
              Your current account role cannot manage developer
              API credentials.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER / SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4">
          <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-black">
            Active Keys
          </span>

          <strong className="block text-xl text-white font-black mt-1">
            {activeKeys.length}
          </strong>
        </div>

        <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4">
          <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-black">
            Total Keys
          </span>

          <strong className="block text-xl text-indigo-400 font-black mt-1">
            {keys.length}
          </strong>
        </div>

        <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4">
          <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-black">
            API Calls
          </span>

          <strong className="block text-xl text-cyan-400 font-black mt-1">
            {totalCalls.toLocaleString()}
          </strong>
        </div>
      </div>

      {/* ROLE DESCRIPTION */}
      <div
        className={`rounded-2xl p-4 border ${
          isBuyer
            ? "bg-cyan-500/5 border-cyan-500/15"
            : "bg-indigo-500/5 border-indigo-500/15"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg">
            {isBuyer ? "👤" : "⚙️"}
          </span>

          <div>
            <h4
              className={`text-xs font-black uppercase tracking-wide ${
                isBuyer
                  ? "text-cyan-300"
                  : "text-indigo-300"
              }`}
            >
              {isBuyer
                ? "Buyer API Access"
                : "Vendor Developer Access"}
            </h4>

            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              {isBuyer
                ? "Your API credentials provide read-only access to marketplace products and your own order information. Buyer credentials cannot trigger AI Vision or modify store data."
                : "Your API credentials allow approved integrations to access marketplace data, order information, and vendor AI Vision functionality."}
            </p>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-sm">⚠️</span>

            <div className="flex-1">
              <p className="text-[11px] text-rose-300 font-semibold">
                {error}
              </p>

              <button
                type="button"
                onClick={loadKeys}
                className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 underline font-bold cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATOR */}
      <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg">
            🔑
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">
              Create API Key
            </h4>

            <p className="text-[10px] text-slate-500 mt-1">
              Generate a secure credential for your integration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-[9px] text-slate-500 uppercase tracking-widest font-black mb-2">
              API Plan
            </label>

            <select
              value={selectedTier}
              onChange={(e) =>
                setSelectedTier(e.target.value)
              }
              disabled={creating}
              className="w-full bg-slate-950 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-xl px-3 py-3 text-xs text-white font-bold outline-none transition-all cursor-pointer"
            >
              <option value="FREE">
                Free — 1,000 calls
              </option>

              <option value="PRO">
                Pro — 10,000 calls
              </option>

              <option value="ENTERPRISE">
                Enterprise — 100,000 calls
              </option>
            </select>

            <p className="text-[9px] text-slate-600 mt-2 font-mono">
              Rate limit:{" "}
              {TIER_LIMITS[selectedTier]?.toLocaleString() ||
                "1,000"}{" "}
              calls
            </p>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={creating}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all shadow-lg shadow-indigo-950/40 cursor-pointer whitespace-nowrap"
            >
              {creating
                ? "Generating..."
                : "Generate API Key"}
            </button>
          </div>
        </div>
      </div>

      {/* NEW RAW KEY */}
      {newKeyRaw && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 animate-in zoom-in-95 duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shrink-0">
              ⚠️
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wide">
                API Key Generated
              </h4>

              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Copy this secret now. For security, the complete
                API key will not be displayed again.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <input
                  type="text"
                  readOnly
                  value={newKeyRaw}
                  className="min-w-0 flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-3 text-[10px] text-slate-200 font-mono outline-none"
                />

                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer"
                >
                  {copied ? "✓ Copied" : "Copy Key"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setNewKeyRaw(null)}
                className="mt-3 text-[9px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
              >
                Hide secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING KEYS */}
      <div className="bg-slate-950/60 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <h4 className="text-sm font-bold text-white">
              Your API Keys
            </h4>

            <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wider font-black">
              Credentials owned by {user.email || "your account"}
            </p>
          </div>

          <button
            type="button"
            onClick={loadKeys}
            disabled={loading}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer disabled:opacity-40"
          >
            {loading ? "Refreshing..." : "Refresh ↻"}
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-16 rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl opacity-40">🔐</div>

            <p className="text-xs text-slate-500 mt-3">
              You do not have any API keys yet.
            </p>

            <p className="text-[9px] text-slate-600 mt-1">
              Generate your first key above to start using the
              developer API.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {keys.map((key) => {
              const limit = Number(key.rate_limit_max || 0);
              const calls = Number(key.calls_made || 0);

              const usage =
                limit > 0
                  ? Math.min((calls / limit) * 100, 100)
                  : 0;

              return (
                <div
                  key={key.id}
                  className="p-5 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-200">
                          {key.prefix}...
                        </span>

                        <span
                          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase border ${
                            key.tier === "ENTERPRISE"
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                              : key.tier === "PRO"
                              ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                              : "bg-slate-500/10 text-slate-300 border-slate-500/20"
                          }`}
                        >
                          {key.tier}
                        </span>

                        <span
                          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase border ${
                            key.is_active
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {key.is_active
                            ? "Active"
                            : "Revoked"}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-black">
                            Usage
                          </span>

                          <span className="text-[9px] text-slate-400 font-mono">
                            {calls.toLocaleString()} /{" "}
                            {limit.toLocaleString()}
                          </span>
                        </div>

                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              usage >= 90
                                ? "bg-rose-500"
                                : usage >= 70
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                            }`}
                            style={{
                              width: `${usage}%`,
                            }}
                          />
                        </div>
                      </div>

                      {key.created_at && (
                        <p className="text-[8px] text-slate-600 mt-2 font-mono">
                          Created{" "}
                          {new Date(
                            key.created_at
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRevoke(key.id)
                      }
                      disabled={revokingId === key.id}
                      className={`shrink-0 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        key.is_active
                          ? "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400"
                          : "bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300"
                      }`}
                    >
                      {revokingId === key.id
                        ? "Updating..."
                        : key.is_active
                        ? "Revoke"
                        : "Restore"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}