import connectLiveReload from "connect-livereload";
import type { Express } from "express";
import livereload from "livereload";

// (Moved from index.ts for milestone 4)
// Live reload in development

const configureLiveReload = (app: Express, staticPath: string) =>
    {
        if (process.env.NODE_ENV === "development") {
            //const staticPath = path.join(process.cwd(), "src", "public");
            const reloadServer = livereload.createServer();
            reloadServer.watch(staticPath);
            reloadServer.server.once("connection", () => {
              setTimeout(() => {
                reloadServer.refresh("/");
              }, 100);
            });
            app.use(connectLiveReload());
          }
    };

export default configureLiveReload;