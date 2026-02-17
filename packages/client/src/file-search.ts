import { execFile } from "child_process";
import { promisify } from "util";
import type { FileSearchResult } from "@mitchmyburgh/shared";
import { MAX_FILE_SEARCH_RESULTS } from "@mitchmyburgh/shared";

const execFileAsync = promisify(execFile);

const SEARCH_TIMEOUT = 5000;

function fuzzyMatch(filename: string, query: string): boolean {
  const lowerFile = filename.toLowerCase();
  const lowerQuery = query.toLowerCase();
  // Simple substring match plus path-component matching
  if (lowerFile.includes(lowerQuery)) return true;
  // Match just the basename
  const basename = lowerFile.split("/").pop() || "";
  return basename.includes(lowerQuery);
}

export async function searchFiles(
  cwd: string,
  query: string,
  searchType: "filename" | "content",
  maxResults: number = MAX_FILE_SEARCH_RESULTS,
): Promise<FileSearchResult[]> {
  try {
    if (searchType === "filename") {
      return await searchFilenames(cwd, query, maxResults);
    } else {
      return await searchContent(cwd, query, maxResults);
    }
  } catch (err: any) {
    console.error(`File search error: ${err.message}`);
    return [];
  }
}

async function searchFilenames(
  cwd: string,
  query: string,
  maxResults: number,
): Promise<FileSearchResult[]> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files"], {
      cwd,
      timeout: SEARCH_TIMEOUT,
      maxBuffer: 5 * 1024 * 1024,
    });

    const files = stdout.split("\n").filter(Boolean);
    const matches = files.filter((f) => fuzzyMatch(f, query));

    return matches.slice(0, maxResults).map((path) => ({
      path,
      type: "file" as const,
    }));
  } catch {
    // Fallback: not a git repo or git not available
    return [];
  }
}

async function searchContent(
  cwd: string,
  query: string,
  maxResults: number,
): Promise<FileSearchResult[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["grep", "-n", "-I", "--max-count", "3", query],
      {
        cwd,
        timeout: SEARCH_TIMEOUT,
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    const lines = stdout.split("\n").filter(Boolean);
    const results: FileSearchResult[] = [];

    for (const line of lines) {
      if (results.length >= maxResults) break;
      // Format: file:lineNumber:content
      const firstColon = line.indexOf(":");
      if (firstColon === -1) continue;
      const secondColon = line.indexOf(":", firstColon + 1);
      if (secondColon === -1) continue;

      const path = line.substring(0, firstColon);
      const lineNumber = parseInt(
        line.substring(firstColon + 1, secondColon),
        10,
      );
      const lineContent = line.substring(secondColon + 1).trim();

      if (isNaN(lineNumber)) continue;

      results.push({
        path,
        type: "content_match",
        lineNumber,
        lineContent: lineContent.substring(0, 200),
      });
    }

    return results;
  } catch (err: any) {
    // git grep returns exit code 1 when no matches found
    if (err.code === 1) return [];
    return [];
  }
}
