import {Router} from 'express'
import { comprobarTokenPasword, confirmarMail, crearNuevoPassword, recuperarPassword, registro, 
    cambiarPasswordAdmin, login, perfil, logout, actualizarPerfilAdmin, listarEstudiantes, 
    eliminarEstudiante, crearEvento, obtenerEventosAdmin, actualizarEvento, eliminarEvento, verMisStrikes, responderStrike, 
    obtenerDenunciaDetalle, eliminarMatchYChat, verTesoreria, registrarGasto, ajustarSaldo } 
from '../controllers/admin_controllers.js'
import { verificarTokenJWT } from '../middlewares/JWT.js'

const router = Router()


router.post('/registro',registro)   
router.get('/confirmar/:token',confirmarMail)

router.post('/recuperarpassword',recuperarPassword)
router.get('/recuperarpassword/:token',comprobarTokenPasword)
router.post('/nuevopassword/:token',crearNuevoPassword)

// Nuevas rutas para administrador
router.put('/admin/cambiar-password', cambiarPasswordAdmin);

// Ruta del Login
router.post('/login', login)

// Ruta protegida
router.get('/perfil', verificarTokenJWT, perfil)
router.post('/logout', verificarTokenJWT, logout)
router.put('/perfil/:id',verificarTokenJWT,actualizarPerfilAdmin)

// Listar todos los usuarios
router.get("/listar",verificarTokenJWT,listarEstudiantes)

// Eliminar estudiantes específicos
router.delete("/eliminar/:id", verificarTokenJWT, eliminarEstudiante);

// Crear un evento
router.post("/crear-evento", verificarTokenJWT, crearEvento);

// Ver el evento
router.get("/ver-evento", verificarTokenJWT, obtenerEventosAdmin);

// Actualizar el evento
router.put('/eventos/:id', verificarTokenJWT, actualizarEvento);

//Elimniar el evento
router.delete('/eliminar-evento/:id' , verificarTokenJWT, eliminarEvento);

// Ver los strikes de los usuarios 
router.get('/mis-strikes', verificarTokenJWT, verMisStrikes);

// Ver detalle de una denuncia (incluye chat si existe)
router.get('/denuncias/:strikeId', verificarTokenJWT, obtenerDenunciaDetalle);

// Eliminar match y chat asociado a una denuncia
router.post('/denuncias/:strikeId/eliminar-match-chat', verificarTokenJWT, eliminarMatchYChat);

// Responder a un strike (crear respuesta y notificación)
router.post('/responder-strike/:strikeId', verificarTokenJWT, responderStrike);

// Rutas de la tesorería por los pagos de PayPal
router.get("/tesoreria", verificarTokenJWT, verTesoreria);
router.post("/tesoreria/gasto", verificarTokenJWT, registrarGasto);
router.post("/tesoreria/ajuste", verificarTokenJWT, ajustarSaldo);

export default router