import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const mod = await import("../server.ts");
    const app = mod.default;
    return app(req, res);
  } catch (error) {
    console.error("Vercel API bootstrap failed:", error);
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown bootstrap error"
    });
  }
}
