import express from "express";

const router = express.Router();

router.post("/test", (request, response) => {
  //fill this with serverside chat logic later
  //const { roomId } = request.params;
  const { message } = request.body;

  console.log("server side chat is alive, message: " + message);



  response.status(200).send();
});

export default router;
