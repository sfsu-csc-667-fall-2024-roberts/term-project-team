"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_errors_1 = __importDefault(require("http-errors"));
const time_1 = require("./middleware/time");
const path_1 = __importDefault(require("path"));
const morgan_1 = __importDefault(require("morgan"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(time_1.timeMiddleware);
/* Rest of server content */
app.get("/", (_req, res) => {
    res.send("Hello World!");
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
app.use((_request, _response, next) => { next((0, http_errors_1.default)(404)); });
app.use(express_1.default.static(path_1.default.join(process.cwd(), "src", "public")));
app.use((0, morgan_1.default)("dev"));
