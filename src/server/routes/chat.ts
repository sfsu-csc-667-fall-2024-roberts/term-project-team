import express from "express";

const router = express.Router();

router.post(`/:roomId`, (request, response) => {
  //fill this with serverside chat logic later
  const { roomId } = request.params;
  const { message } = request.body;

  console.log("server side room " + roomId + " EMITTING msg: " + message);

  //Replace testroom and testmessage with the proper room related things
  //Not sure how to get sender info yet so example text for now
  request.app.get("io").to(`testroom`).emit(`message:${roomId}`, {
    message,
    sender: "default_sender", 
    timestamp: new Date(),
  });

  response.status(200).send();
});

export default router;
