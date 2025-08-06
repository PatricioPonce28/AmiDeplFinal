import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import users from '../models/users.js';
import Chat from '../models/chats.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // Ajusta según tu frontend
      methods: ["GET", "POST"]
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Token requerido"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await users.findById(decoded.id).select("_id nombre");
      
      if (!user) return next(new Error("Usuario no encontrado"));
      
      socket.user = user;
      socket.join(user._id.toString()); // Room por usuario ID
      next();
    } catch (error) {
      next(new Error("Autenticación fallida"));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`Usuario conectado: ${socket.user._id} (${socket.id})`);

    // Unir al usuario a sus chats existentes
    const chats = await Chat.find({ participantes: socket.user._id });
    chats.forEach(chat => {
      socket.join(`chat_${chat._id}`);
    });

    // Manejar mensajes de chat
    socket.on('chat:mensaje', async ({ chatId, contenido }) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participantes: socket.user._id
        });

        if (!chat) return;

        const nuevoMensaje = {
          emisor: socket.user._id,
          contenido,
          createdAt: new Date()
        };

        chat.mensajes.push(nuevoMensaje);
        chat.ultimoMensaje = contenido;
        await chat.save();

        // Emitir a todos en el room del chat
        io.to(`chat_${chatId}`).emit('chat:mensaje', nuevoMensaje);
      } catch (error) {
        console.error("Error al guardar mensaje:", error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.user._id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io no inicializado");
  return io;
};