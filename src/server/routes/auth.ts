import express from "express";
import { Users } from "../db"; 

const router = express.Router();

router.get("/register", (_request, response) => {
  response.render("auth/register", { title: "Auth: Register" });
});

router.get("/login", (_request, response) => {
  response.render("auth/login", { title: "Auth: Login" }); // Corrected title
});

router.post("/register", async (request, response) => {
  const { username, email, password } = request.body;

  try {
    const user = await Users.register(username, email, password);
    // @ts-expect-error: Define session type for the user object
    request.session.user = user;

    response.redirect("/lobby"); 
  } catch (error) {
    console.error(error);

    request.flash("error", "Failed to register user. Please try again.");
    response.redirect("/auth/register");
  }
});

router.post("/login", async (request, response) => {
  const { email, password } = request.body;

  try {
    const user = await Users.login(email, password);
    // @ts-expect-error: Define session type for the user object
    request.session.user = user;

    response.redirect("/lobby"); 
  } catch (error) {
    console.error(error);

    request.flash("error", "Invalid email or password.");
    response.redirect("/auth/login");
  }
});

export default router;
