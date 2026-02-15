import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { createApiClient } from "../../lib/api";
import type { ApiKey } from "@claude-chat/shared";

export function ApiKeyManager() {
  const { apiKey } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const api = createApiClient(apiKey!);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await api.get<{ data: ApiKey[] }>("/api/keys");
      setKeys(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setError("");
    try {
      const res = await api.post<{ data: { apiKey: ApiKey; rawKey: string } }>("/api/keys", {
        name: newKeyName.trim(),
      });
      setNewRawKey(res.data.rawKey);
      setNewKeyName("");
      fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    }
  };

  const handleRevoke = async (id: string) => {
    setError("");
    try {
      await api.delete(`/api/keys/${id}`);
      fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke key");
    }
  };

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-white">API Keys</h3>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {newRawKey && (
        <div className="mb-4 rounded-md bg-green-900/30 border border-green-700 p-3">
          <p className="text-sm text-green-400 mb-1">New API key created. Copy it now — it won't be shown again:</p>
          <code className="block text-sm text-green-300 break-all select-all">{newRawKey}</code>
          <button
            onClick={() => setNewRawKey(null)}
            className="mt-2 text-xs text-gray-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name..."
          className="flex-1 rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:border-blue-500"
        />
        <button
          onClick={handleCreate}
          disabled={!newKeyName.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Create
        </button>
      </div>

      {/* Key list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-gray-400">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-md bg-gray-700 px-3 py-2"
            >
              <div>
                <span className="text-sm text-white">{key.name}</span>
                <span className="ml-2 text-xs text-gray-400">{key.keyPrefix}...</span>
                {key.revokedAt && (
                  <span className="ml-2 text-xs text-red-400">revoked</span>
                )}
              </div>
              {!key.revokedAt && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
