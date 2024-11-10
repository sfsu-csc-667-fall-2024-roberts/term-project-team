import express from "express";
import httpErrors from "http-errors";
import { timeMiddleware } from "./middleware/time";
import rootRoutes from "./routes/root";
import path from "path";
import morgan from "morgan";
import connectLiveReload from "connect-livereload";
import livereload from "livereload";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan("dev"));
app.use(timeMiddleware);
app.use(express.static(path.join(process.cwd(), "src", "public")));

// View engine setup
app.set("views", path.join(process.cwd(), "src", "server", "views"));
app.set("view engine", "ejs");

// Routes
app.use("/", rootRoutes);

// 404 handler
app.use((_request, _response, next) => {next(httpErrors(404))});

// Live reload in development
if (process.env.NODE_ENV === "development") {
  const staticPath = path.join(process.cwd(), "src", "public");
  const reloadServer = livereload.createServer();
  reloadServer.watch(staticPath);
  reloadServer.server.once("connection", () => {
    setTimeout(() => {
      reloadServer.refresh("/");
    }, 100);
  });
  app.use(connectLiveReload());
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});