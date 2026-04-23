import mongoose from "mongoose";
import users from "../models/users.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs-extra";
import { generarConRetry, getModel } from "../helpers/gemini_helper.js";
import Evento from "../models/Evento.js";
import Chat from "../models/chats.js";
import Aporte from "../models/Aporte.js";
import { injectIO } from "../middlewares/injectIO.js";
import Strike from "../models/strikes.js";
import HistorialConChatbot from "../models/historialConChatbot.js";
import HistorialNotificacion from "../models/HistorialNotificacion.js";
import fetch from "node-fetch";
import paypal from '@paypal/checkout-server-sdk'

const getCloudinaryPublicIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
};

const uploadFilesToCloudinary = async (
  files,
  folder = "Estudiantes/Galeria",
) => {
  if (!files) return [];
  const fileArray = Array.isArray(files) ? files : [files];
  const uploaded = [];

  for (const file of fileArray) {
    const tempPath = file.tempFilePath || file.path;
    const result = await cloudinary.uploader.upload(tempPath, { folder });
    uploaded.push({ url: result.secure_url, public_id: result.public_id });

    // Intentar borrar el archivo temporal (no crítico)
    try {
      if (tempPath) await fs.unlink(tempPath);
    } catch (err) {
      // Ignorar errores de borrado temporal
    }
  }

  return uploaded;
};

const crearNotificacion = async ({
  usuarioId,
  fromUserId = null,
  tipo,
  titulo,
  mensaje,
}) => {
  try {
    await HistorialNotificacion.create({
      usuario: usuarioId,
      fromUser: fromUserId,
      tipo,
      titulo,
      mensaje,
      leido: false,
    });
  } catch (error) {
    console.error("Error creando notificación:", error);
  }
};

const crearChatMatch = async (usuarioAId, usuarioBId, io) => {
  try {
    const sortedIds = [usuarioAId.toString(), usuarioBId.toString()].sort();

    let chat = await Chat.findOne({ participantes: sortedIds });

    if (!chat) {
      chat = await Chat.create({ participantes: sortedIds, mensajes: [] });

      if (io) {
        // 🔥 evento específico
        io.to(usuarioAId.toString()).emit("chat:created", {
          chatId: chat._id,
          otherUserId: usuarioBId,
        });

        io.to(usuarioBId.toString()).emit("chat:created", {
          chatId: chat._id,
          otherUserId: usuarioAId,
        });

        // 🔥 evento global para UI
        io.to(usuarioAId.toString()).emit("nuevo_chat", chat);
        io.to(usuarioBId.toString()).emit("nuevo_chat", chat);

        console.log(
          `Socket: Evento 'nuevo_chat' emitido para el chat ${chat._id}`,
        );
      }
    }

    return chat;
  } catch (error) {
    console.error("Error creando chat de match:", error);
    throw error;
  }
};

const obtenerNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.userBDD._id;
    const notificaciones = await HistorialNotificacion.find({
      usuario: usuarioId,
    })
      .populate("fromUser", "nombre imagenPerfil")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ notificaciones });
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    return res.status(500).json({ msg: "Error al obtener notificaciones" });
  }
};

const marcarNotificacionLeida = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.userBDD?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID de notificación inválido" });
    }

    if (!usuarioId) {
      return res.status(401).json({ msg: "Usuario no autenticado" });
    }

    const notificacion = await HistorialNotificacion.findOne({
      _id: id,
      usuario: usuarioId,
    });
    if (!notificacion) {
      return res.status(404).json({
        msg: "Notificación no encontrada o no perteneciente al usuario",
      });
    }

    if (notificacion.leido) {
      return res.status(200).json({
        msg: "Notificación ya estaba marcada como leída",
        notificacion,
      });
    }

    notificacion.leido = true;
    await notificacion.save();

    return res
      .status(200)
      .json({ msg: "Notificación marcada como leída", notificacion });
  } catch (error) {
    console.error("Error marcando notificación como leída:", error);
    return res
      .status(500)
      .json({ msg: "Error al marcar notificación", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    req.userBDD.token = null;
    await req.userBDD.save();
    res.status(200).json({ msg: "Sesión cerrada correctamente" });
  } catch (error) {
    res.status(500).json({ msg: "Error al cerrar sesión" });
  }
};

const marcarNotificacionLeidaPorStrike = async (req, res) => {
  try {
    const { strikeId } = req.params;
    const usuarioId = req.userBDD?._id;

    if (!mongoose.Types.ObjectId.isValid(strikeId)) {
      return res.status(400).json({ msg: "Strike ID inválido" });
    }

    const strike = await Strike.findById(strikeId);
    if (!strike || strike.de.toString() !== usuarioId.toString()) {
      return res
        .status(404)
        .json({ msg: "Strike no encontrado o no te pertenece" });
    }

    let notificacion = await HistorialNotificacion.findOne({
      usuario: usuarioId,
      tipo: "respuesta_strike",
      fromUser: strike.para,
      mensaje: {
        $regex: strike.respuesta ? strike.respuesta.substring(0, 20) : ".*",
      },
    });

    if (!notificacion) {
      // Si no existe notificación, la creamos como leída (para permitir marcarlo sin tener ID explicitamente)
      notificacion = await HistorialNotificacion.create({
        usuario: usuarioId,
        fromUser: strike.para,
        tipo: "respuesta_strike",
        titulo: "Respuesta del Equipo de Soporte",
        mensaje: strike.respuesta
          ? `El equipo de soporte de Amikuna ha respondido a tu ${strike.tipo}: "${strike.respuesta}"`
          : "El equipo de soporte de Amikuna respondió tu solicitud.",
        leido: true,
      });

      return res.status(200).json({
        msg: "Notificación creada y marcada como leída",
        notificacion,
      });
    }

    if (notificacion.leido) {
      return res.status(200).json({
        msg: "Notificación ya estaba marcada como leída",
        notificacion,
      });
    }

    notificacion.leido = true;
    await notificacion.save();

    return res
      .status(200)
      .json({ msg: "Notificación marcada como leída", notificacion });
  } catch (error) {
    console.error("Error marcando notificación por strike:", error);
    return res.status(500).json({
      msg: "Error al marcar notificación por strike",
      error: error.message,
    });
  }
};

const completarPerfil = async (req, res) => {
  try {
    const id = req.userBDD._id;

    const nombre = req.body.nombre?.trim();
    const biografia = req.body.biografia?.trim();
    const intereses = req.body.intereses?.split(',').map(i => i.trim()) || [];
    const genero = req.body.genero?.toLowerCase();
    const orientacion = req.body.orientacion?.toLowerCase();
    const fechaNacimiento = req.body.fechaNacimiento;
    const ciudad = req.body['ubicacion[ciudad]']?.trim();
    const pais = req.body['ubicacion[pais]']?.trim();

    // Validar campos obligatorios
    if (!nombre || !biografia || !fechaNacimiento || !genero || !orientacion || intereses.length === 0 || !ciudad || !pais) {
      return res.status(400).json({ msg: "Por favor, completa todos los campos obligatorios." });
    }

    // Validar nombre sin espacios
    if (/\s/.test(nombre)) {
      return res.status(400).json({ msg: "El nombre no debe contener espacios." });
    }

    // Validar ciudad y país sin espacios
    if (/\s/.test(ciudad)) {
      return res.status(400).json({ msg: "La ciudad no debe contener espacios." });
    }
    if (/\s/.test(pais)) {
      return res.status(400).json({ msg: "El país no debe contener espacios." });
    }

    // Validar mayoría de edad (18 años)
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    const edad = hoy.getFullYear() - nacimiento.getFullYear();
    const cumplioEsteAnio =
      hoy.getMonth() > nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
    const edadReal = cumplioEsteAnio ? edad : edad - 1;

    if (isNaN(nacimiento.getTime())) {
      return res.status(400).json({ msg: "Fecha de nacimiento inválida." });
    }
    if (edadReal < 18) {
      return res.status(400).json({ msg: "Debes tener al menos 18 años para usar Amikuna." });
    }

    // Buscar al usuario
    const usuario = await users.findById(id);
    if (!usuario)
      return res.status(404).json({ msg: "Usuario no encontrado." });

    // Subir imagen a Cloudinary si se envió
    if (req.files?.imagenPerfil) {
      const file = req.files.imagenPerfil.tempFilePath;
      const resultado = await cloudinary.uploader.upload(file, {
        folder: "Estudiantes",
      });
      usuario.imagenPerfil = resultado.secure_url;
    }

    // Subir imágenes de galería
    const galeriaFiles = req.files?.imagenesGaleria || req.files?.galeria;
    if (galeriaFiles) {
      const uploads = await uploadFilesToCloudinary(galeriaFiles);
      const urls = uploads.map((u) => u.url);
      usuario.imagenesGaleria = Array.isArray(usuario.imagenesGaleria)
        ? [...usuario.imagenesGaleria, ...urls]
        : urls;
    }

    usuario.nombre = nombre;
    usuario.biografia = biografia;
    usuario.intereses = intereses;
    usuario.genero = genero;
    usuario.orientacion = orientacion;
    usuario.fechaNacimiento = fechaNacimiento;
    usuario.ubicacion = { ciudad, pais };
    usuario.activo = true;
    usuario.matches = usuario.matches || [];
    usuario.seguidores = usuario.seguidores || [];
    usuario.siguiendo = usuario.siguiendo || [];
    usuario.imagenesGaleria = usuario.imagenesGaleria || [];

    await usuario.save();

    req.userBDD = usuario;

    const { password, token, __v, createdAt, updatedAt, ...perfil } = usuario.toObject();

    res.status(200).json({
      msg: "Perfil actualizado correctamente",
      perfilActualizado: perfil,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ msg: "Error en el servidor al actualizar el perfil" });
  }
};

const agregarFotosGaleria = async (req, res) => {
  try {
    const id = req.userBDD._id;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado." });

    const galeriaFiles = req.files?.imagenesGaleria || req.files?.galeria;
    if (!galeriaFiles) {
      return res.status(400).json({
        msg: "No se recibieron archivos. Envía los archivos en form-data bajo el campo 'imagenesGaleria'",
      });
    }

    const uploads = await uploadFilesToCloudinary(galeriaFiles);
    const urls = uploads.map((u) => u.url);

    user.imagenesGaleria = Array.isArray(user.imagenesGaleria)
      ? [...user.imagenesGaleria, ...urls]
      : urls;

    await user.save();

    return res.status(200).json({
      msg: "Imágenes guardadas en la galería",
      imagenesGaleria: user.imagenesGaleria,
    });
  } catch (error) {
    console.error("Error agregando imágenes de galería:", error);
    return res
      .status(500)
      .json({ msg: "Error al agregar imágenes de galería" });
  }
};

const eliminarFotoGaleria = async (req, res) => {
  try {
    const id = req.userBDD._id;
    const { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ msg: "Se requiere la URL de la imagen a eliminar" });
    }

    const user = await users.findById(id);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado." });

    const exists =
      Array.isArray(user.imagenesGaleria) && user.imagenesGaleria.includes(url);
    if (!exists) {
      return res
        .status(404)
        .json({ msg: "Imagen no encontrada en la galería" });
    }

    const publicId = getCloudinaryPublicIdFromUrl(url);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }

    user.imagenesGaleria = user.imagenesGaleria.filter((img) => img !== url);
    await user.save();

    return res.status(200).json({
      msg: "Imagen eliminada con éxito",
      imagenesGaleria: user.imagenesGaleria,
    });
  } catch (error) {
    console.error("Error eliminando imagen de galería:", error);
    return res.status(500).json({ msg: "Error al eliminar imagen de galería" });
  }
};

const reemplazarFotoGaleria = async (req, res) => {
  try {
    const id = req.userBDD._id;
    const index = Number(req.params.index);
    const file = req.files?.imagen;

    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ msg: "Índice inválido" });
    }

    if (!file) {
      return res
        .status(400)
        .json({ msg: "Se requiere un archivo para reemplazar" });
    }

    const user = await users.findById(id);
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado." });

    if (
      !Array.isArray(user.imagenesGaleria) ||
      index >= user.imagenesGaleria.length
    ) {
      return res.status(400).json({ msg: "Índice fuera de rango" });
    }

    const oldUrl = user.imagenesGaleria[index];
    const uploads = await uploadFilesToCloudinary(file);
    const newUrl = uploads[0]?.url;

    if (!newUrl) {
      return res.status(500).json({ msg: "No se pudo subir la nueva imagen" });
    }

    const publicIdOld = getCloudinaryPublicIdFromUrl(oldUrl);
    if (publicIdOld) {
      await cloudinary.uploader.destroy(publicIdOld);
    }

    user.imagenesGaleria[index] = newUrl;
    await user.save();

    return res.status(200).json({
      msg: "Imagen actualizada con éxito",
      imagenesGaleria: user.imagenesGaleria,
    });
  } catch (error) {
    console.error("Error reemplazando imagen de galería:", error);
    return res
      .status(500)
      .json({ msg: "Error al reemplazar imagen de galería" });
  }
};

const webhookBotpress = async (req, res) => {
  try {
    console.log("Botpress webhook:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ msg: "Error en webhook" });
  }
};

const chatEstudiante = async (req, res) => {
  try {
    const { mensaje } = req.body;
    const usuarioId = req.userBDD._id;

    if (!mensaje) {
      return res.status(400).json({ msg: "Debes enviar un mensaje" });
    }

    const headers = {
      Authorization: `Bearer ${process.env.BOTPRESS_TOKEN}`,
      "x-bot-id": process.env.BOTPRESS_BOT_ID,
      "Content-Type": "application/json",
    };

    // 1️⃣ Crear o recuperar conversación del usuario
    const convResponse = await fetch(
      "https://api.botpress.cloud/v1/chat/conversations",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          integrationName: "api",
          channel: "api",  
          tags: {},
          userId: usuarioId.toString(),  
        }),
      }
    );

    const convData = await convResponse.json();

    if (!convResponse.ok) {
      console.error("Error creando conversación:", convData);
      return res.status(502).json({ msg: "Error al crear conversación" });
    }

    const conversationId = convData.conversation?.id;

    // 2️⃣ Enviar el mensaje a esa conversación
    const msgResponse = await fetch(
      "https://api.botpress.cloud/v1/chat/messages",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          conversationId,
          userId: usuarioId.toString(),
          type: "text",
          payload: {
            text: mensaje,
          },
          tags: {},
        }),
      }
    );

    const msgData = await msgResponse.json();

    if (!msgResponse.ok) {
      console.error("Error enviando mensaje:", msgData);
      return res.status(502).json({ msg: "Error al enviar mensaje" });
    }

    // 3️⃣ Esperar respuesta del bot (polling simple)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const messagesResponse = await fetch(
      `https://api.botpress.cloud/v1/chat/conversations/${conversationId}/messages`,
      { method: "GET", headers }
    );

    const messagesData = await messagesResponse.json();

    // Obtener el último mensaje del bot
    const respuestaBot = messagesData.messages
      ?.filter((m) => m.direction === "outgoing")
      ?.at(-1)?.payload?.text || "Sin respuesta del bot";

    // 4️⃣ Guardar en MongoDB
    await HistorialConChatbot.findOneAndUpdate(
      { usuario: usuarioId },
      {
        $push: {
          mensajes: {
            $each: [
              { rol: "usuario", contenido: mensaje },
              { rol: "asistente", contenido: respuestaBot },
            ],
          },
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ respuesta: respuestaBot });

  } catch (error) {
    console.error("Error chatbot:", error);
    res.status(500).json({ msg: "Error interno", error: error.message });
  }
};

const obtenerHistorialChatbot = async (req, res) => {
  try {
    const usuarioId = req.userBDD._id;

    const historial = await HistorialConChatbot.findOne({
      usuario: usuarioId,
    });

    if (!historial) {
      return res.status(200).json({ mensajes: [] });
    }

    res.status(200).json({ mensajes: historial.mensajes });
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener historial", error: error.message });
  }
};

const obtenerPerfilCompleto = async (req, res) => {
  try {
    const usuario = await users
      .findById(req.userBDD._id)
      .select("-password -token -__v -createdAt -updatedAt");
    if (!usuario) return res.status(404).json({ msg: "Usuario no encontrado" });

    res.status(200).json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el perfil completo" });
  }
};

const listarPotencialesMatches = async (req, res) => {
  try {
    const yo = req.userBDD;

    // Verificar autenticación
    if (!yo) {
      return res.status(401).json({ msg: "Usuario no autenticado" });
    }

    // Filtrar por género opuesto (o mismo si es 'otro')
    let filtroGenero = {};
    if (yo.genero === "hombre") filtroGenero.genero = "mujer";
    if (yo.genero === "mujer") filtroGenero.genero = "hombre";
    if (yo.genero === "otro") filtroGenero.genero = "otro";

    // Buscar perfiles que cumplan los requisitos
    let perfiles = await users
      .find({
        _id: { $ne: yo._id }, // que no sea yo
        ...filtroGenero,
        imagenPerfil: { $ne: "" }, // tiene foto
        biografia: { $ne: "" }, // tiene bio
        intereses: { $exists: true, $not: { $size: 0 } }, // tiene intereses
      })
      .select("-password -token -__v -updatedAt")
      .lean();

    // Filtrar perfiles que ya sean match
    perfiles = perfiles.filter((perfil) => {
      const yoSigo =
        Array.isArray(yo.siguiendo) &&
        yo.siguiendo.some((id) => id.toString() === perfil._id.toString());

      const elMeSigue =
        Array.isArray(perfil.siguiendo) &&
        perfil.siguiendo.some((id) => id.toString() === yo._id.toString());

      // Incluir solo si NO hay match mutuo
      return !(yoSigo && elMeSigue);
    });

    // Filtrar perfiles ya vistos
    perfiles = perfiles.filter((perfil) => {
      return (
        !Array.isArray(yo.perfilesVistos) ||
        !yo.perfilesVistos.some((id) => id.toString() === perfil._id.toString())
      );
    });

    return res.status(200).json(perfiles);
  } catch (error) {
    console.error("Error en listarPotencialesMatches:", error);
    return res.status(500).json({
      msg: "Error interno del servidor al listar matches",
      error: error.message,
    });
  }
};

// Cambio documentar
const seguirUsuario = async (req, res) => {
  try {
    const yoId = req.userBDD._id;
    const { idSeguido } = req.params;

    if (yoId.toString() === idSeguido) {
      return res.status(400).json({ msg: "No puedes seguirte a ti mismo" });
    }

    const [yo, otro] = await Promise.all([
      users.findById(yoId),
      users.findById(idSeguido),
    ]);

    if (!otro) return res.status(404).json({ msg: "Usuario no encontrado" });

    const yaLoSigo = yo.siguiendo.some((id) => id.toString() === idSeguido);

    if (yaLoSigo) {
      // --- Lógica para dejar de seguir ---
      yo.siguiendo.pull(idSeguido);
      otro.seguidores.pull(yoId);
      yo.matches.pull(idSeguido);
      otro.matches.pull(yoId);
    } else {
      // --- Lógica para seguir ---
      yo.siguiendo.push(idSeguido);
      otro.seguidores.push(yoId);

      if (!yo.perfilesVistos.some((id) => id.toString() === idSeguido)) {
        yo.perfilesVistos.push(idSeguido);
      }

      await crearNotificacion({
        usuarioId: idSeguido,
        fromUserId: yoId,
        tipo: "seguidor",
        titulo: "Tienes un nuevo seguidor",
        mensaje: `${yo.nombre} ${yo.apellido ?? ""} te está siguiendo.`,
      });
    }

    // --- Sistema de matches automáticos ---
    let huboMatch = false;
    if (
      !yaLoSigo &&
      otro.siguiendo.some((id) => id.toString() === yoId.toString())
    ) {
      if (!yo.matches.some((id) => id.toString() === idSeguido))
        yo.matches.push(idSeguido);
      if (!otro.matches.some((id) => id.toString() === yoId.toString()))
        otro.matches.push(yoId);

      huboMatch = true;

      // Notificaciones de Match en DB
      await Promise.all([
        crearNotificacion({
          usuarioId: yoId,
          fromUserId: idSeguido,
          tipo: "match",
          titulo: "¡Nuevo match!",
          mensaje: `¡Felicitaciones! Hiciste match con ${otro.nombre ?? "alguien"}.`,
        }),
        crearNotificacion({
          usuarioId: idSeguido,
          fromUserId: yoId,
          tipo: "match",
          titulo: "¡Nuevo match!",
          mensaje: `¡Felicitaciones! Hiciste match con ${yo.nombre ?? "alguien"}.`,
        }),
      ]);
    }

    // Guardado final en DB
    await Promise.all([yo.save(), otro.save()]);

    // Crear el chat después de avisar el match
    await crearChatMatch(yoId, idSeguido, req.io);

    // --- BLOQUE UNIFICADO DE SOCKETS (Real-time) ---
    if (req.io) {
      if (huboMatch) {
        console.log("🔥 MATCH DETECTADO");

        req.io.to(yoId.toString()).emit("nuevo_match");
        req.io.to(idSeguido.toString()).emit("nuevo_match");
        console.log("MATCHES YO:", yo.matches);
        console.log("MATCHES OTRO:", otro.matches);

        console.log("📡 EVENTO EMITIDO");
        req.io.emit("notificacion_nueva");
        console.log(`Match confirmado: ${yoId} ❤️ ${idSeguido}`);

        
      } else if (!yaLoSigo) {
        // Notifica solo si es un "Seguir" nuevo (no al dejar de seguir)
        req.io.emit("notificacion_nueva");
      }
      
    }

    return res.status(200).json({
      msg: yaLoSigo
        ? "Has dejado de seguir"
        : huboMatch
          ? "¡Match! Ahora pueden chatear"
          : "Ahora sigues a este usuario",
      siguiendo: yo.siguiendo.length,
      huboMatch,
    });
  } catch (error) {
    console.error("Error en seguirUsuario:", error);
    return res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const listarMatches = async (req, res) => {
  try {
    const usuarioConPopulate = await users
      .findById(req.userBDD._id)
      .populate({ path: "matches" });

    const miId = req.userBDD._id; // ← corregido

    const matchesConChat = await Promise.all(
      usuarioConPopulate.matches.map(async (match) => {
        const chat = await Chat.findOne({
          participantes: { $all: [miId, match._id] },
        }).select("_id");

        return {
          ...match.toObject(),
          chatId: chat?._id?.toString() || null,
        };
      })
    );

    res.status(200).json(matchesConChat); // ← solo una respuesta
  } catch (error) {
    console.error("Error al listar matches:", error);
    res.status(500).json({ msg: "Error al listar matches", error: error.message });
  }
};

const obtenerEventos = async (req, res) => {
  try {
    const ahora = new Date();

    const eventosRaw = await Evento.find({ activo: true })
      .populate("asistentes", "nombre apellido")
      .populate("noAsistiran", "nombre apellido")
      .select("-__v -createdAt -updatedAt -creador")
      .lean();

    const eventosFiltrados = eventosRaw
      .filter((evento) => {
        const [horas, minutos] = evento.hora.split(":").map(Number);
        const fechaEvento = new Date(evento.fecha);
        fechaEvento.setUTCHours(horas + 5, minutos, 0, 0);
        return fechaEvento >= ahora;
      })
      .sort((a, b) => {
        // Construir fecha+hora completa para comparar
        const [hA, mA] = a.hora.split(":").map(Number);
        const fechaA = new Date(a.fecha);
        fechaA.setUTCHours(hA + 5, mA, 0, 0);

        const [hB, mB] = b.hora.split(":").map(Number);
        const fechaB = new Date(b.fecha);
        fechaB.setUTCHours(hB + 5, mB, 0, 0);

        return fechaA - fechaB; // ← más próximo a expirar primero
      });

    const eventos = eventosFiltrados.map((e) => ({
      ...e,
      _id: e._id.toString(),
    }));

    res.status(200).json(eventos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener eventos" });
  }
};

const obtenerMisEventos = async (req, res) => {
  try {
    const userId = req.userBDD._id;

    const eventosRaw = await Evento.find({ activo: true, asistentes: userId })
      .populate("asistentes", "nombre apellido imagenPerfil email")
      .populate("noAsistiran", "nombre apellido imagenPerfil email")
      .populate("creador", "nombre apellido email")
      .select("-__v -createdAt -updatedAt")
      .lean();

    const eventos = eventosRaw.map((evento) => ({
      ...evento,
      _id: evento._id.toString(),
      asistentes: Array.isArray(evento.asistentes)
        ? evento.asistentes.map((a) => ({
            _id: a._id.toString(),
            nombre: a.nombre,
            apellido: a.apellido,
            email: a.email,
            imagenPerfil: a.imagenPerfil,
          }))
        : [],
      noAsistiran: Array.isArray(evento.noAsistiran)
        ? evento.noAsistiran.map((n) => ({
            _id: n._id.toString(),
            nombre: n.nombre,
            apellido: n.apellido,
            email: n.email,
            imagenPerfil: n.imagenPerfil,
          }))
        : [],
    }));

    res.status(200).json(eventos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener mis eventos" });
  }
};

const confirmarAsistencia = async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento || !mongoose.Types.ObjectId.isValid(idEvento)) {
      return res
        .status(400)
        .json({ msg: "ID de evento inválido o no recibido" });
    }

    const userId = req.userBDD._id;

    const evento = await Evento.findById(idEvento);
    if (!evento) return res.status(404).json({ msg: "Evento no encontrado" });

    if (!evento.asistentes.includes(userId)) {
      evento.asistentes.push(userId);
      evento.noAsistiran = evento.noAsistiran.filter(
        (id) => id.toString() !== userId.toString(),
      );
    }

    await evento.save();
    // confirmarAsistencia — admin ve cambio en tiempo real
    req.io.emit("asistencia_actualizada", { eventoId: idEvento });
    res.status(200).json({ msg: "Asistencia confirmada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al confirmar asistencia" });
  }
};

const rechazarAsistencia = async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento || !mongoose.Types.ObjectId.isValid(idEvento)) {
      return res
        .status(400)
        .json({ msg: "ID de evento inválido o no recibido" });
    }

    const userId = req.userBDD._id;

    const evento = await Evento.findById(idEvento);
    if (!evento) return res.status(404).json({ msg: "Evento no encontrado" });

    if (!evento.noAsistiran.includes(userId)) {
      evento.noAsistiran.push(userId);
      evento.asistentes = evento.asistentes.filter(
        (id) => id.toString() !== userId.toString(),
      );
    }

    await evento.save();
    // rechazarAsistencia — admin ve cambio en tiempo real
    req.io.emit("asistencia_actualizada", { eventoId: idEvento });
    res.status(200).json({ msg: "Asistencia rechazada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al rechazar asistencia" });
  }
};

/// NADA DOCUMENTADO DE AQUÍ EN ADELANTE PILAS

const getPayPalToken = async () => {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${process.env.PAYPAL_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  return data.access_token;
};

const crearOrdenPayPal = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, mensaje: "Monto inválido" });
    }

    const token = await getPayPalToken();

    const response = await fetch(
      `${process.env.PAYPAL_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: Number(amount).toFixed(2),
              },
              description: "Aporte para Amikuna",
            },
          ],
          application_context: {
            brand_name: "Amikuna",
            user_action: "PAY_NOW",
          },
        }),
      },
    );

    const order = await response.json();

    if (!order.id) {
      return res.status(500).json({
        ok: false,
        mensaje: "Error creando orden en PayPal",
        detalle: order,
      });
    }

    res.status(201).json({ ok: true, orderId: order.id });
  } catch (error) {
    console.error("Error creando orden PayPal:", error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

const capturarPagoPayPal = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const userId = req.userBDD._id;

    if (!orderId || !amount) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "orderId y amount son requeridos" });
    }

    const token = await getPayPalToken();

    const response = await fetch(
      `${process.env.PAYPAL_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const capture = await response.json();

    if (capture.status !== "COMPLETED") {
      await Aporte.create({
        userId,
        amount,
        paypalOrderId: orderId,
        status: "fallido",
      });
      return res.status(400).json({
        ok: false,
        mensaje: "Pago no completado",
        estado: capture.status,
      });
    }

    await Aporte.create({
      userId,
      amount,
      paypalOrderId: orderId,
      status: "pagado",
    });

    // capturarPagoPayPal — admin ve el pago en tesorería(revision)
    req.io.emit("pago_completado");

    let tesoreria = await Tesoreria.findOne();
    if (!tesoreria) {
      tesoreria = await Tesoreria.create({ saldoTotal: 0, movimientos: [] });
    }

    tesoreria.saldoTotal += amount;
    tesoreria.movimientos.push({
      tipo: "ingreso",
      monto: amount,
      razon: `Aporte de usuario vía PayPal - Orden ${orderId}`,
    });

    await tesoreria.save();

    res.status(200).json({
      ok: true,
      mensaje: "¡Aporte realizado con éxito! Gracias por apoyar Amikuna.",
    });

  } catch (error) {
    console.error("Error capturando pago PayPal:", error);
    res.status(500).json({ ok: false, mensaje: error.message });
  }
};

const iniciarChat = async (req, res) => {
  try {
    const myId = req.userBDD?._id;
    const otherUserId = req.params?.otroUserId;

    // Validaciones previas (como ya tienes)...

    // IDs ordenados para buscar el chat único
    const sortedIds = [myId.toString(), otherUserId.toString()].sort();

    // Buscar si ya existe chat entre estos dos usuarios
    let chatExistente = await Chat.findOne({
      participantes: sortedIds,
    });

    if (!chatExistente) {
      // Si no existe, crear uno nuevo
      chatExistente = await Chat.create({
        participantes: sortedIds,
        mensajes: [],
      });

      // Emitir eventos Socket.io para chat creado
      if (req.io) {
        req.io.to(myId.toString()).emit("chat:created", {
          chatId: chatExistente._id,
          otherUserId: otherUserId,
        });

        req.io.to(otherUserId.toString()).emit("chat:created", {
          chatId: chatExistente._id,
          otherUserId: myId,
        });
      }
    }

    // Responder con el chat existente o creado
    return res.status(200).json({
      success: true,
      message: "Chat listo",
      chatId: chatExistente._id,
    });
  } catch (error) {
    console.error("Error en iniciarChat:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const enviarMensaje = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { contenido } = req.body;
    const emisorId = req.userBDD._id;

    if (!contenido || !chatId) {
      return res.status(400).json({ msg: "Contenido y chatId requeridos" });
    }

    const chat = await Chat.findById(chatId);
    if (
      !chat ||
      !chat.participantes.some((p) => p.toString() === emisorId.toString())
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para enviar mensajes en este chat" });
    }

    const nuevoMensaje = {
      emisor: emisorId,
      contenido,
      createdAt: new Date(),
    };

    const chatActualizado = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { mensajes: nuevoMensaje } },
      { new: true, runValidators: true },
    );

    if (!chatActualizado) {
      return res
        .status(404)
        .json({ msg: "Chat no encontrado durante la actualización" });
    }

    // Poblar la información del emisor en el último mensaje para que el otro usuario lo reciba completo
    const mensajeFinal = await Chat.populate(chatActualizado, {
      path: "mensajes.emisor",
      select: "nombre imagenPerfil",
    });

    // El mensaje que se envía ahora contiene la info del emisor
    const ultimoMensaje =
      mensajeFinal.mensajes[mensajeFinal.mensajes.length - 1];

    if (req.io) {
      req.io.to(`chat_${chatId}`).emit("mensaje:nuevo", {
        chatId,
        mensaje: ultimoMensaje,
      });
    }

    res.status(201).json({
      msg: "Mensaje enviado",
      mensaje: ultimoMensaje,
    });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const obtenerMensajes = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userBDD._id;

    const chat = await Chat.findById(chatId).populate(
      "mensajes.emisor",
      "nombre imagenPerfil",
    );

    if (!chat) {
      return res.status(404).json({ msg: "Chat no encontrado" });
    }

    const esParticipante = chat.participantes.some(
      (p) => p.toString() === userId.toString(),
    );
    if (!esParticipante) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para ver este chat" });
    }

    res.status(200).json(chat.mensajes);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const reportarUsuarioChat = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const usuarioId = req.userBDD._id;
    const { razon } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ msg: "ID de chat inválido" });
    }

    if (!razon || razon.trim().length < 5) {
      return res.status(400).json({
        msg: "Por favor describe el motivo con al menos 5 caracteres",
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: "Chat no encontrado" });
    }

    if (
      !chat.participantes.some((p) => p.toString() === usuarioId.toString())
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permiso para reportar este chat" });
    }

    const usuarioReportado = chat.participantes.find(
      (p) => p.toString() !== usuarioId.toString(),
    );
    if (!usuarioReportado) {
      return res
        .status(400)
        .json({ msg: "No se pudo identificar al usuario reportado" });
    }

    const admin = await users.findOne({ email: "admin@epn.edu.ec" });
    if (!admin) {
      return res
        .status(500)
        .json({ msg: "Administrador no encontrado en el sistema" });
    }

    const nuevoStrike = new Strike({
      de: usuarioId,
      para: admin._id,
      tipo: "denuncia",
      razon: razon.trim(),
      usuarioReportado,
      chat: chat._id,
      status: "pendiente",
    });

    await nuevoStrike.save();

    await HistorialNotificacion.create({
      usuario: admin._id,
      fromUser: usuarioId,
      tipo: "denuncia",
      titulo: "Nueva denuncia de usuario",
      mensaje: `El usuario con ID ${usuarioId} reportó al usuario con ID ${usuarioReportado} en el chat ${chat._id}`,
    });
    // reportarUsuarioChat + enviarStrike — admin recibe notificación
    req.io.emit("notificacion_nueva");
    return res
      .status(201)
      .json({ msg: "Denuncia enviada correctamente", strike: nuevoStrike });
  } catch (error) {
    console.error("Error al reportar usuario:", error);
    return res.status(500).json({ msg: "Error interno al reportar usuario" });
  }
};

const enviarStrike = async (req, res) => {
  try {
    const de = req.userBDD._id;
    const { tipo, razon } = req.body;

    // Buscar el ID del admin quemado
    const admin = await users.findOne({ email: "admin@epn.edu.ec" });

    if (!admin) {
      return res
        .status(500)
        .json({ msg: "Administrador no encontrado en el sistema" });
    }

    // Validaciones
    if (!["queja", "sugerencia", "denuncia"].includes(tipo)) {
      return res
        .status(400)
        .json({ msg: "Tipo debe ser 'queja', 'sugerencia' o 'denuncia'" });
    }

    if (!razon || razon.trim().length < 5) {
      return res
        .status(400)
        .json({ msg: "La razón debe tener al menos 5 caracteres" });
    }

    // Crear strike dirigido al admin
    const nuevoStrike = new Strike({
      de,
      para: admin._id,
      tipo,
      razon,
    });

    await nuevoStrike.save();

    res.status(201).json({
      msg: `Tu ${tipo} ha sido enviada al administrador. Pronto revisará tu mensaje.`,
    });
  } catch (error) {
    console.error("Error al enviar queja/sugerencia:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const verMisStrikes = async (req, res) => {
  try {
    const usuarioId = req.userBDD._id;

    const strikes = await Strike.find({ de: usuarioId })
      .populate("para", "nombre apellido email")
      .sort({ fecha: -1 })
      .lean();

    res.status(200).json({
      msg: "Consulta realizada exitosamente",
      strikes,
    });
  } catch (error) {
    console.error("Error al obtener strikes:", error);
    res.status(500).json({ msg: "Error al obtener tus quejas/sugerencias" });
  }
};

export {
  completarPerfil,
  agregarFotosGaleria,
  eliminarFotoGaleria,
  reemplazarFotoGaleria,
  webhookBotpress,
  chatEstudiante,
  obtenerPerfilCompleto,
  listarPotencialesMatches,
  seguirUsuario,
  listarMatches,
  obtenerEventos,
  obtenerMisEventos,
  confirmarAsistencia,
  rechazarAsistencia,
  obtenerNotificaciones,
  marcarNotificacionLeida,
  marcarNotificacionLeidaPorStrike,
  logout,
  getPayPalToken,
  crearOrdenPayPal,
  capturarPagoPayPal,
  iniciarChat,
  enviarMensaje,
  obtenerMensajes,
  reportarUsuarioChat,
  enviarStrike,
  obtenerHistorialChatbot,
  verMisStrikes,
};
