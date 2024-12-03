import express from "express";

const router = express.Router();

router.get("/register", (_request, response) => {
  response.render("auth/register", { title: "Auth: Register" });
});

router.get("/login", (_request, response) => {
  response.render("auth/login", { title: "Auth: Logout" });
});

router.post("/register", async (request, response) => {
  const { username, email, password } = request.body;
  try {
    const user = await Users.register(username, email, password);
    response.redirect("/lobby");
  } catch (error) {
    console.error(error);
    response.redirect("/auth/register");
  }
});
router.post("/login", async (request, response) => {
  const { email, password } = request.body;
  try {
    const user = await Users.login(email, password);
    response.redirect("/lobby");
  } catch (error) {
    console.error(error);
    response.redirect("/auth/login");
  }
});

export default router;
