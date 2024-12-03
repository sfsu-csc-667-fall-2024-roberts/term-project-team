import dotenv from "dotenv";
import express from "express";
import httpErrors from "http-errors";
import { timeMiddleware } from "./middleware/time";
import path from "path";
import morgan from "morgan";

dotenv.config();


//Cannot find module "./folder" when trying to import the entire folder like in the lectures.
//Error only goes away when importing a specific file. I assume we need to import the manifest files?
import * as configuration from "./config/manifestlivereload";
import * as routes from "./routes/manifestroutes";
//import rootRoutes from "./routes/root";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan("dev"));
app.use(timeMiddleware);
app.use(express.json()); // Parse JSON payloads
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded payloads

// LiveReload (See 11/4, 13:45)
const staticPath = path.join(process.cwd(), "src", "public");
app.use(express.static(staticPath));

// LiveReload (See 11/4, 13:45)
configuration.configureLiveReload(app, staticPath);

// View engine setup
app.set("views", path.join(process.cwd(), "src", "server", "views"));
app.set("view engine", "ejs");

// Routes
//app.use("/", rootRoutes);
app.use("/", routes.root);
app.use("/tests", routes.tests);

// 404 handler
app.use((_request, _response, next) => next(httpErrors(404)));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
