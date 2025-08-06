import app from './server.js'
import connection from './database.js'
import http from 'http'
import { initSocket } from "../src/sockets/socket.js";

// Conectar a la base de datos
connection()
console.log("Conectado a MongoDB")

// Crear el servidor HTTP usando la app de Express
const server = http.createServer(app);

// Inicializar Socket.IO con el servidor HTTP
initSocket(server);

// Escuchar en el puerto definido, pero usando el servidor HTTP
const PORT = app.get('port');
server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});