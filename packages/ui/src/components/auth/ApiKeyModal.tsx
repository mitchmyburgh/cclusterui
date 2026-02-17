import { useState, type FormEvent } from "react";

interface ApiKeyModalProps {
  onSubmit: (key: string) => void;
}

export function ApiKeyModal({ onSubmit }: ApiKeyModalProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter an API key");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-8 shadow-lg border border-gray-200 dark:border-gray-700">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">CCluster</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Enter your API key to connect.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError("");
            }}
            placeholder="Enter API key..."
            className="mb-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-[#cb3837] focus:ring-1 focus:ring-[#cb3837]"
            autoFocus
          />
          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-[#cb3837] px-4 py-3 font-medium text-white hover:bg-[#b53130] transition-colors"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
}
