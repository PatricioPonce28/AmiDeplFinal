import {Router} from 'express'
import { completarPerfil, agregarFotosGaleria, eliminarFotoGaleria, reemplazarFotoGaleria, chatEstudiante,  listarPotencialesMatches, seguirUsuario, listarMatches, obtenerPerfilCompleto, 
    obtenerEventos, confirmarAsistencia, rechazarAsistencia, obtenerNotificaciones, marcarNotificacionLeida, enviarMensaje, obtenerMensajes,
    crearAporte, iniciarChat, enviarStrike, obtenerHistorialChatbot
  } from '../controllers/estudiante_controllers.js'
import {verificarTokenJWT, } from '../middlewares/JWT.js'
import { perfilCompleto } from '../middlewares/perfilCompleto.js'
import { injectIO } from "../middlewares/injectIO.js";


const router = Router();

// Ruta para actualizar perfil
router.put("/completarperfil", verificarTokenJWT, completarPerfil);

// Rutas para manejar galería de fotos (subir / actualizar / eliminar)
router.post("/galeria", verificarTokenJWT, agregarFotosGaleria);
router.delete("/galeria", verificarTokenJWT, eliminarFotoGaleria);
router.put("/galeria/:index", verificarTokenJWT, reemplazarFotoGaleria);

// Ruta para chatbot
router.post('/perfil/chat', verificarTokenJWT, chatEstudiante);

// Ruta para ver el historial de respuestas con el chatbot
router.get('/perfil/chat/historial', verificarTokenJWT, obtenerHistorialChatbot);

// Notificaciones
router.get('/notificaciones', verificarTokenJWT, obtenerNotificaciones);
router.put('/notificaciones/:id/leido', verificarTokenJWT, marcarNotificacionLeida);

// Nueva ruta para obtener perfil completo
router.get('/perfil', verificarTokenJWT, obtenerPerfilCompleto);

router.get("/matches", verificarTokenJWT, perfilCompleto, listarPotencialesMatches);

// Ruta para obtener los eventos creados
router.get("/ver-eventos", verificarTokenJWT, perfilCompleto, obtenerEventos);

// Asistir al evento 
router.post("/asistir/:idEvento", verificarTokenJWT, confirmarAsistencia);

// No asistir al evento 
router.post("/no-asistir/:idEvento", verificarTokenJWT, rechazarAsistencia);

// Probar Estos 3 endpoitns cuando el Jhonn me siga
// Endpoint clave y genera el match
router.post("/seguir/:idSeguido", verificarTokenJWT, perfilCompleto, seguirUsuario);

// Listar Matches
router.get("/listarmatches", verificarTokenJWT, perfilCompleto, listarMatches);

router.post('/chat-con-match/:otroUserId', verificarTokenJWT, injectIO, iniciarChat );

// Enviar mensaje
router.post("/chats/:chatId/mensajes", verificarTokenJWT, injectIO, enviarMensaje);
// Obtener mensaje
router.get("/chats/:chatId/ver-mensajes", verificarTokenJWT, injectIO, obtenerMensajes);
// Pasarela para aporte 
router.post("/aportes", verificarTokenJWT, crearAporte);

// Enviar queja sugerencia al admin 
router.post('/strike', verificarTokenJWT, enviarStrike);


export default router 