// src/middlewares/injectIO.js
import { getIO } from "../sockets/socket.js"
export const injectIO = (req, res, next) => {
  req.io = getIO();
  next();
};
