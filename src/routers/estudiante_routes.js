import {Router} from 'express'
import { completarPerfil, agregarFotosGaleria, eliminarFotoGaleria, reemplazarFotoGaleria, chatEstudiante,  listarPotencialesMatches, seguirUsuario, listarMatches, obtenerPerfilCompleto, 
    obtenerEventos, obtenerMisEventos, confirmarAsistencia, rechazarAsistencia, obtenerNotificaciones, marcarNotificacionLeida, marcarNotificacionLeidaPorStrike, logout, enviarMensaje, obtenerMensajes,
    crearAporte, iniciarChat, enviarStrike, obtenerHistorialChatbot, verMisStrikes,
    reportarUsuarioChat
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
// Ver eventos a los que el estudiante está inscrito + asistentes de cada evento
router.get("/mis-eventos", verificarTokenJWT, perfilCompleto, obtenerMisEventos);

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

// Logout
router.post('/logout', verificarTokenJWT, logout);

// Enviar queja sugerencia al admin 
router.post('/strike', verificarTokenJWT, enviarStrike);

router.post('/chats/:chatId/report', verificarTokenJWT, reportarUsuarioChat);

// Ver mis quejas/sugerencias y sus respuestas
router.get('/mis-strikes', verificarTokenJWT, verMisStrikes);

// Marcar notificación de respuesta de strike como leída usando strikeId
router.put('/notificaciones/strike/:strikeId/leido', verificarTokenJWT, marcarNotificacionLeidaPorStrike);

export default router 