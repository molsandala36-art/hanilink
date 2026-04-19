import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp, initializeServerResources } from "../server/app";

const appPromise = (async () => {
  await initializeServerResources();
  return createApp();
})();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error("Vercel API bootstrap failed:", error);
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown bootstrap error"
    });
  }
}
