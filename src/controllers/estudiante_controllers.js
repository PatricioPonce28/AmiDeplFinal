import mongoose from "mongoose"  
import users from '../models/users.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Evento from '../models/Evento.js';
import { Stripe } from "stripe"
import Chat from '../models/chats.js';
import Aporte from '../models/Aporte.js';
import { injectIO } from "../middlewares/injectIO.js";
import Strike from '../models/strikes.js';


const stripe = new Stripe(`${process.env.STRIPE_PRIVATE_KEY}`)

const completarPerfil = async (req, res) => {
  try {
    const id = req.userBDD._id;

    // Extraer y normalizar datos
    const nombre = req.body.nombre?.trim();
    const biografia = req.body.biografia?.trim();
    const intereses = req.body.intereses?.split(',').map(i => i.trim()) || [];
    const genero = req.body.genero?.toLowerCase();
    const orientacion = req.body.orientacion?.toLowerCase();
    const fechaNacimiento = req.body.fechaNacimiento;
    const ubicacion = JSON.parse(req.body.ubicacion || '{}');

    // Validar campos obligatorios
    if (!nombre || !biografia || !fechaNacimiento || !genero || !orientacion || intereses.length === 0) {
      return res.status(400).json({ msg: "Por favor, completa todos los campos obligatorios." });
    }

    // Buscar al usuario
    const usuario = await users.findById(id);
    if (!usuario) return res.status(404).json({ msg: "Usuario no encontrado." });

    // Subir imagen a Cloudinary si se envió
    if (req.files?.imagenPerfil) {
      const file = req.files.imagenPerfil.tempFilePath;
      const resultado = await cloudinary.uploader.upload(file, {
        folder: 'Estudiantes'
      });
      usuario.imagenPerfil = resultado.secure_url;
      await fs.unlink(file); // borrar imagen temporal
    }
if (usuario.imagenPerfil) {
    const rutaAnterior = path.join(process.cwd(), usuario.imagenPerfil);
    if (fs.existsSync(rutaAnterior)) {
      await fs.unlink(rutaAnterior);
    }
  }
    // Actualizar campos
    usuario.nombre = nombre;
    usuario.biografia = biografia;
    usuario.intereses = intereses;
    usuario.genero = genero;
    usuario.orientacion = orientacion;
    usuario.fechaNacimiento = fechaNacimiento;
    usuario.ubicacion = ubicacion;

    // Por si no están inicializados
    usuario.activo = true;
    usuario.matches = usuario.matches || [];
    usuario.seguidores = usuario.seguidores || [];
    usuario.siguiendo = usuario.siguiendo || [];
    usuario.imagenesGaleria = usuario.imagenesGaleria || [];

    await usuario.save();

    // Limpiar respuesta
    const { password, token, __v, createdAt, updatedAt, ...perfil } = usuario.toObject();

    res.status(200).json({
      msg: "Perfil actualizado correctamente",
      perfilActualizado: perfil
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error en el servidor al actualizar el perfil" });
  }
};


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY )

const chatEstudiante = async (req, res) => {
  try {
    const { mensaje } = req.body;
    if (!mensaje) {
      return res.status(400).json({ msg: "Debes enviar un mensaje" });
    }

    // Obtiene el modelo generativo
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Define el prompt completo
    const prompt = `
Eres un asistente amigable en una app de citas llamada Amikuna. 
Ayudas a los usuarios a iniciar conversaciones, mejorar sus perfiles y dar consejos de relaciones de manera divertida y respetuosa. 
Responde siempre con un tono informal pero con buena ortografía. 
Además, usa lenguaje natural, y sobre todo que no parezca escrito por una IA.
Finalmente, usa jerga y expresiones de Ecuador si es posible.

Mensaje del estudiante: "${mensaje}"
`;

    // Generar respuesta
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const texto = response.text();

    res.status(200).json({ respuesta: texto });
  } catch (error) {
    console.error("Error con Gemini:", error);
    res.status(500).json({ 
      msg: "Error interno al consultar",
      error: error.message 
    });
  }
};
const obtenerPerfilCompleto = async (req, res) => {
  try {
    const usuario = await users.findById(req.userBDD._id).select('-password -token -__v -createdAt -updatedAt');
    if (!usuario) return res.status(404).json({ msg: "Usuario no encontrado" });

    res.status(200).json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el perfil completo" });
  }
};


const listarPotencialesMatches = async (req, res) => {
  const yo = req.userBDD;

  let filtroGenero = {};
  if (yo.genero === "hombre")  filtroGenero.genero = "mujer";
  if (yo.genero === "mujer")   filtroGenero.genero = "hombre";
  if (yo.genero === "otro")    filtroGenero.genero = "otro";

  const perfiles = await users.find({
    _id: { $ne: yo._id },            // que no sea yo
    ...filtroGenero,
    imagenPerfil: { $ne: "" },       // tiene foto
    biografia:  { $ne: "" },         // tiene bio
    intereses: { $exists: true, $not: { $size: 0 } }
  })
  .select("-password -token -__v -updatedAt")
  .lean();

  return res.status(200).json(perfiles);
};

// Cambio documentar
const seguirUsuario = async (req, res) => {
  try {
    const yoId = req.userBDD._id;
    const { idSeguido } = req.params;

    // Validaciones básicas (las que ya tenías)
    if (yoId.toString() === idSeguido) {
      return res.status(400).json({ msg: "No puedes seguirte a ti mismo" });
    }

    const [yo, otro] = await Promise.all([
      users.findById(yoId),
      users.findById(idSeguido)
    ]);

    if (!otro) return res.status(404).json({ msg: "Usuario no encontrado" });

    // Lógica de seguir/dejar de seguir (existente)
    const yaLoSigo = yo.siguiendo.includes(idSeguido);
    if (yaLoSigo) {
      yo.siguiendo.pull(idSeguido);
      otro.seguidores.pull(yoId);
      
      // Opcional: Eliminar match si existía
      yo.matches.pull(idSeguido);
      otro.matches.pull(yoId);
    } else {
      yo.siguiendo.push(idSeguido);
      otro.seguidores.push(yoId);
    }

    // Nuevo: Sistema de matches automáticos
    let huboMatch = false;
    if (!yaLoSigo && otro.siguiendo.includes(yoId)) {
      // Agregar a matches si no existen ya
      if (!yo.matches.includes(idSeguido)) {
        yo.matches.push(idSeguido);
      }
      if (!otro.matches.includes(yoId)) {
        otro.matches.push(yoId);
      }
      huboMatch = true;
      
      // Opcional: Crear chat (si tienes esta función)
      if (req.io) {
        await guardarMatch(yoId, idSeguido, req.io);
      }
    }

    await Promise.all([yo.save(), otro.save()]);

    // Respuesta mejorada
    return res.status(200).json({
      msg: yaLoSigo 
        ? "Has dejado de seguir" 
        : huboMatch 
          ? "¡Match! Ahora pueden chatear" 
          : "Ahora sigues a este usuario",
      siguiendo: yo.siguiendo.length,
      huboMatch //
    });

  } catch (error) {
    console.error("Error en seguirUsuario:", error);
    return res.status(500).json({ msg: "Error interno del servidor" });
  }
};


const listarMatches = async (req, res) => {
  try {
    const usuario = await users.findById(req.userBDD._id);

    console.log("Usuario sin populate:", usuario);

    const usuarioConPopulate = await users.findById(req.userBDD._id)
      .populate({
        path: 'matches',
      });

    console.log("Matches con populate:", usuarioConPopulate.matches);

    res.status(200).json(usuarioConPopulate.matches);

  } catch (error) {
    console.error("Error al listar matches:", error);
    res.status(500).json({ msg: "Error al listar matches", error: error.message });
  }
};

const obtenerEventos = async (req, res) => {
  try {
    const eventos = await Evento.find().select('-_id -__v -createdAt -updatedAt -creador');
      
    res.status(200).json(eventos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener eventos" });
  }
};

const confirmarAsistencia = async (req, res) => {
  try {
    const { idEvento } = req.params;
    const userId = req.userBDD._id;

    const evento = await Evento.findById(idEvento);
    if (!evento) return res.status(404).json({ msg: "Evento no encontrado" });

    if (!evento.asistentes.includes(userId)) {
      evento.asistentes.push(userId);
      evento.noAsistiran = evento.noAsistiran.filter(id => id.toString() !== userId.toString());
    }

    await evento.save();
    res.status(200).json({ msg: "Asistencia confirmada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al confirmar asistencia" });
  }
};

const rechazarAsistencia = async (req, res) => {
  try {
    const { idEvento } = req.params;
    const userId = req.userBDD._id;

    const evento = await Evento.findById(idEvento);
    if (!evento) return res.status(404).json({ msg: "Evento no encontrado" });

    if (!evento.noAsistiran.includes(userId)) {
      evento.noAsistiran.push(userId);
      evento.asistentes = evento.asistentes.filter(id => id.toString() !== userId.toString());
    }

    await evento.save();
    res.status(200).json({ msg: "Asistencia rechazada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al rechazar asistencia" });
  }
};

/// NADA DOCUMENTADO DE AQUÍ EN ADELANTE PILAS

const crearAporte = async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;
    const userId = req.userBDD._id;

    // 1. Crear intento de pago en Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe trabaja en centavos
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      return_url: "http://localhost:5173/user/dashboard", // <--- Con esta ruta
    });

    // 2. Guardar en la base de datos
    const nuevoAporte = await Aporte.create({
      userId,
      amount,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status === "succeeded" ? "pagado" : "pendiente",
    });

    res.status(201).json({
      ok: true,
      mensaje: "Aporte creado exitosamente.",
      aporte: nuevoAporte,
    });
  } catch (error) {
    console.error("Error al procesar aporte:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error al crear el aporte.",
      error: error.message,
    });
  }
};

const iniciarChat = async (req, res) => {
  try {
    const myId = req.userBDD?._id;
    const otherUserId = req.params?.otroUserId;

    // 1. Validar IDs y evitar chatear consigo mismo
    if (!mongoose.Types.ObjectId.isValid(myId) || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ error: 'IDs de usuario no válidos' });
    }

    if (myId.toString() === otherUserId.toString()) {
      return res.status(400).json({ error: 'No puedes chatear contigo mismo' });
    }

    // 2. Validar que ambos usuarios existen
    const [yo, otro] = await Promise.all([
      users.findById(myId).select('siguiendo seguidores'),
      users.findById(otherUserId).select('siguiendo seguidores')
    ]);

    if (!yo || !otro) {
      return res.status(404).json({ error: 'Uno o ambos usuarios no encontrados' });
    }

    // 3. Validar match mutuo
    const yoSigoAlOtro = yo.siguiendo.some(id => id.toString() === otro._id.toString());
    const elMeSigueAMi = otro.siguiendo.some(id => id.toString() === yo._id.toString());

    if (!yoSigoAlOtro || !elMeSigueAMi) {
      return res.status(403).json({ 
        error: 'Deben ser matches mutuos (se siguen mutuamente) para chatear',
        details: {
          tuSigueA: yoSigoAlOtro,
          elSigueA: elMeSigueAMi
        }
      });
    }

    // 4. Crear el nuevo chat (sin validación de duplicados)
    const sortedIds = [myId.toString(), otherUserId.toString()].sort();

    const nuevoChat = await Chat.create({
      participantes: sortedIds,
      mensajes: [], // opcional
    });

    // 5. Emitir evento de Socket.io
    if (req.io) {
      req.io.to(myId.toString()).emit('chat:created', {
        chatId: nuevoChat._id,
        otherUserId: otherUserId
      });

      req.io.to(otherUserId.toString()).emit('chat:created', {
        chatId: nuevoChat._id,
        otherUserId: myId
      });
    }

    // 6. Respuesta exitosa
    return res.status(201).json({
      success: true,
      message: 'Chat creado exitosamente',
      chatId: nuevoChat._id
    });

  } catch (error) {
    console.error('Error en iniciarChat:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const enviarMensaje = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { contenido } = req.body;
    const emisorId = req.userBDD._id;

    if (!contenido || !chatId) {
      return res.status(400).json({ msg: 'Contenido y chatId requeridos' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: 'Chat no encontrado' });
    }

    // Verificamos que el emisor pertenezca al chat
    const esParticipante = chat.participantes.some(p =>
      p.toString() === emisorId.toString()
    );
    if (!esParticipante) {
      return res.status(403).json({ msg: 'No tienes permiso para enviar mensajes en este chat' });
    }

    // Crear mensaje
    const nuevoMensaje = {
      emisor: emisorId,
      contenido,
      createdAt: new Date()
    };

    chat.mensajes.push(nuevoMensaje);
    await chat.save();

    // Emitir mensaje por socket.io
    if (req.io) {
      req.io.to(chatId.toString()).emit('mensaje:nuevo', {
        chatId,
        mensaje: nuevoMensaje
      });
    }

    res.status(201).json({
      msg: 'Mensaje enviado',
      mensaje: nuevoMensaje
    });

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ msg: 'Error interno del servidor' });
  }
};


const obtenerMensajes = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userBDD._id;

    const chat = await Chat.findById(chatId).populate('mensajes.emisor', 'nombre imagenPerfil');

    if (!chat) {
      return res.status(404).json({ msg: 'Chat no encontrado' });
    }

    const esParticipante = chat.participantes.some(p =>
      p.toString() === userId.toString()
    );
    if (!esParticipante) {
      return res.status(403).json({ msg: 'No tienes permiso para ver este chat' });
    }

    res.status(200).json(chat.mensajes);

  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ msg: 'Error interno del servidor' });
  }
};

const enviarStrike = async (req, res) => {
  try {
    const de = req.userBDD._id;
    const { tipo, razon } = req.body;

    // Buscar el ID del admin quemado
    const admin = await users.findOne({ correo: 'admin@epn.edu.ec' });

    if (!admin) {
      return res.status(500).json({ msg: 'Administrador no encontrado en el sistema' });
    }

    // Validaciones
    if (!['queja', 'sugerencia'].includes(tipo)) {
      return res.status(400).json({ msg: "Tipo debe ser 'queja' o 'sugerencia'" });
    }

    if (!razon || razon.trim().length < 5) {
      return res.status(400).json({ msg: "La razón debe tener al menos 5 caracteres" });
    }

    // Crear strike dirigido al admin
    const nuevoStrike = new Strike({
      de,
      para: admin._id,
      tipo,
      razon
    });

    await nuevoStrike.save();

    res.status(201).json({
      msg: `Tu ${tipo} ha sido enviada al administrador. Pronto revisará tu mensaje.`
    });

  } catch (error) {
    console.error("Error al enviar queja/sugerencia:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};


export { 
  completarPerfil,
  chatEstudiante,
  obtenerPerfilCompleto, 
  listarPotencialesMatches,
  seguirUsuario,
  listarMatches,
  obtenerEventos,
  confirmarAsistencia,
  rechazarAsistencia,
  crearAporte,
  iniciarChat,
  enviarMensaje,
  obtenerMensajes,
  enviarStrike
}
