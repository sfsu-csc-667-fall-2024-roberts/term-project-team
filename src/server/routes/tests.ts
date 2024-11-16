import express from "express";

const router = express.Router();

router.get("/", (_request, response) => {
    response.render("tests/test1", { title: "Default test page?" });
});

router.get("/t1", (_request, response) => {
    response.render("tests/test1", { title: "Test Page 1" });
});

router.get("/t2", (_request, response) => {
    response.render("tests/test2", { title: "Test Page 2" });
});

export default router;
