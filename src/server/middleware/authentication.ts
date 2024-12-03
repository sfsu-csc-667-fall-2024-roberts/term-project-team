import { NextFunction, Request, Response } from "express";

const authenticationMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  // @ts-expect-error TODO: Define session type for the user object
  if (!request.session.user) {
    response.redirect("/auth/login"); // Redirect to login if not authenticated
  } else {
    // @ts-expect-error TODO: Define session type for the user object
    response.locals.user = request.session.user; // Store user in locals for templates
    next();
  }
};

export default authenticationMiddleware;
