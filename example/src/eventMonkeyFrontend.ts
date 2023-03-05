import express from "express";

const expressServer = express();
expressServer.listen(8080);
expressServer.get("/", (request, response, next) => {
  response.send("Eventmonkey is active.");
});

