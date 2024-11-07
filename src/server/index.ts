import express from "express";
import httpErrors from "http-errors";
import { timeMiddleware } from "./middleware/time";
import rootRoutes from "./routes/root";
import path from "path";
import morgan from "morgan";
const app = express();
const PORT = process.env.PORT || 3000;
import connectLiveReload from "connect-livereload";
import livereload from "livereload";

app.use(timeMiddleware);

/* Rest of server content */

app.get("/", (_req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.use((_request, _response, next) => {next(httpErrors(404))})

app.use(express.static(path.join(process.cwd(), "src", "public")));

app.use(morgan("dev"));
app.use("/", rootRoutes);

app.use(express.static(path.join(process.cwd(), "src", "public")));
app.set( "views", path.join(process.cwd(), "src", "server", "views"));
app.set("view engine", "ejs");
app.use("/", rootRoutes);
const staticPath = path.join(process.cwd(), "src", "public");
app.use(express.static(staticPath));
if (process.env.NODE_ENV === "development") {
  const reloadServer = livereload.createServer();
  reloadServer.watch(staticPath);
  reloadServer.server.once("connection", () => {
    setTimeout(() => {
      reloadServer.refresh("/");
}, 100); });
  app.use(connectLiveReload());
}