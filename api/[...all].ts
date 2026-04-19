import type { VercelRequest, VercelResponse } from "@vercel/node";

let appPromise: Promise<(req: VercelRequest, res: VercelResponse) => unknown> | null = null;

const getApp = async () => {
  if (!appPromise) {
    appPromise = (async () => {
      const mod = await import("../server/app.ts");
      await mod.initializeServerResources();
      return mod.createApp();
    })();
  }

  return appPromise;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("Vercel API bootstrap failed:", error);
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown bootstrap error"
    });
  }
}
