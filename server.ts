import { createApp, initializeServerResources } from "./server/app";

async function startServer() {
  try {
    console.log("HaniLink Server is initializing...");
    const app = createApp();
    const PORT = Number(process.env.PORT || 5000);

    await initializeServerResources();

    if (process.env.NODE_ENV !== "production") {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: {
            middlewareMode: true,
            allowedHosts: [
              "commissive-elianna-genitourinary.ngrok-free.dev",
              ".ngrok-free.app",
              ".ngrok-free.dev"
            ]
          },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("Vite development server attached");
      } catch (err) {
        console.error("Vite setup failed, falling back to static.");
      }
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
      -----------------------------------------------
      HaniLink Server is ready!
      Local: http://localhost:${PORT}
      -----------------------------------------------
      `);
    });
  } catch (err) {
    console.error("Critical server error:", err);
  }
}

const app = createApp();
void initializeServerResources();

export default app;

if (!process.env.VERCEL) {
  startServer();
}
