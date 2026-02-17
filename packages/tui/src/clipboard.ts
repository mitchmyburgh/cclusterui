export interface ClipboardResult {
  type: "text" | "image";
  text?: string;
  imageData?: string;
  mimeType?: string;
}

export async function fetchClipboard(port: number = 17995): Promise<ClipboardResult | null> {
  try {
    const response = await fetch(`http://localhost:${port}/clipboard`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";

    if (contentType.startsWith("image/")) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      return { type: "image", imageData: dataUrl, mimeType: contentType };
    }

    const text = await response.text();
    if (text) {
      return { type: "text", text };
    }

    return null;
  } catch {
    return null;
  }
}
