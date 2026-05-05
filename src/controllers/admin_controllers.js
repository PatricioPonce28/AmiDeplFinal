import mongoose from "mongoose";

import users from "../models/users.js";
import { crearTokenJWT } from "../middlewares/JWT.js";
import Evento from "../models/Evento.js";
import cloudinary from "cloudinary";
import fs from "fs-extra";
import Strike from "../models/strikes.js";
import Chat from "../models/chats.js";
import HistorialNotificacion from "../models/HistorialNotificacion.js";

//nuevas importaciones para correos reemplaxo de nodemailer por supabase
import supabase from "../config/supabase.js";
import Tesoreria from "../models/Tesoreria.js";
import Aporte from "../models/Aporte.js";
import crypto from "crypto";

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const ZONA_ECUADOR = 'America/Guayaquil';

const validarHora = (hora) => {
  if (!hora || typeof hora !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora);
};

const validarFechaHoraEvento = (fecha, hora) => {
  if (!fecha || !hora) {
    return 'La fecha y hora del evento son obligatorias.';
  }

  if (!validarHora(hora)) {
    return 'La hora debe tener el formato HH:mm válido.';
  }

  // Crear la fecha del evento en zona horaria de Ecuador
  const fechaHoraEvento = dayjs.tz(`${fecha} ${hora}`, ZONA_ECUADOR);

  if (!fechaHoraEvento.isValid()) {
    return 'Fecha o hora del evento inválida.';
  }

  // Momento actual en Ecuador
  const ahora = dayjs().tz(ZONA_ECUADOR);

  if (fechaHoraEvento.isBefore(ahora) || fechaHoraEvento.isSame(ahora)) {
    return 'La fecha y hora del evento deben ser futuras.';
  }

  return null;
};

const registro = async (req, res) => {
  const { nombre, apellido, email, password, confirmPassword } = req.body;

  // Validaciones — igual que antes
  if ([nombre, apellido, email, password, confirmPassword].includes("")) {
    return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  }

  const verificarEmailBDD = await users.findOne({ email });
  if (verificarEmailBDD) {
    return res.status(400).json({ msg: "Este email ya está registrado" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ msg: "Las contraseñas no coinciden" });
  }

  // Guardar en MongoDB — igual que antes
  const newUser = new users({ nombre, apellido, email });
  newUser.password = await newUser.encryptPassword(password);
  newUser.crearToken();
  await newUser.save();

  try {
    const confirmationLink = `${process.env.URL_FRONTEND}/confirmar/${newUser.token}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: confirmationLink,
        data: { nombre, apellido },
      },
    });

    if (error) throw error;

    console.log("Email de confirmación enviado:", email);
  } catch (error) {
    console.error("Error enviando correo:", error.message);
    return res.status(500).json({
      msg: "Usuario registrado pero hubo un problema al enviar el correo.",
    });
  }

  return res.status(200).json({
    msg: "Revisa tu correo electrónico para confirmar tu cuenta",
  });
};

const confirmarMail = async (req, res) => {
  const token = req.params.token;
  const userBDD = await users.findOne({ token });
  if (!userBDD?.token)
    return res.status(404).json({ msg: "La cuenta ya ha sido confirmada" });
  userBDD.token = null;
  userBDD.confirmEmail = true;
  await userBDD.save();
  res.status(200).json({ msg: "Token confirmado, ya puedes iniciar sesión" });
};

const recuperarPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: "El correo es obligatorio" });
  }

  try {
    const userBDD = await users.findOne({ email });
    if (!userBDD) {
      return res.status(404).json({ msg: "Usuario no registrado" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    userBDD.token = token;
    userBDD.tokenExpira = Date.now() + 1000 * 60 * 60;
    await userBDD.save();

    const recoveryLink = `${process.env.URL_FRONTEND}/nuevopassword/${token}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryLink,
    });

    if (error) {
      console.error("Error Supabase:", error.message);
      return res.status(500).json({ msg: "Error enviando correo" });
    }

    return res.status(200).json({
      msg: "Revisa tu correo para recuperar tu contraseña",
    });
  } catch (error) {
    console.error("Error recuperando password:", error);
    return res.status(500).json({ msg: "Error enviando correo" });
  }
};

const comprobarTokenPasword = async (req, res) => {
  const { token } = req.params;

  const userBDD = await users.findOne({
    token,
    tokenExpira: { $gt: Date.now() },
  });

  if (!userBDD) {
    return res.status(404).json({ msg: "Token inválido o expirado" });
  }

  res.json({ msg: "Token válido" });
};

const crearNuevoPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmpassword } = req.body;

  if (!password || !confirmpassword) {
    return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  }

  if (password !== confirmpassword) {
    return res.status(400).json({ msg: "Las contraseñas no coinciden" });
  }

  const userBDD = await users.findOne({
    token,
    tokenExpira: { $gt: Date.now() },
  });

  if (!userBDD) {
    return res.status(404).json({ msg: "Token inválido o expirado" });
  }

  userBDD.password = await userBDD.encryptPassword(password);
  userBDD.token = null;
  userBDD.tokenExpira = null;

  await userBDD.save();

  res.json({ msg: "Contraseña actualizada correctamente" });
};

const cambiarPasswordAdmin = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: "Las contraseñas no coinciden" });
    }

    const adminUser = await users.findOne({ correo: "admin@epn.edu.ec" });
    if (!adminUser) {
      return res.status(404).json({ msg: "Administrador no encontrado" });
    }

    adminUser.password = await adminUser.encryptPassword(newPassword);
    await adminUser.save();

    res.status(200).json({ msg: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Error en cambiarPasswordAdmin:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ msg: "Lo sentimos, debes llenar todos los campos" });
  }
  try {
    const userBDD = await users
      .findOne({ email })
      .select("-__v -updatedAt -createdAt");
    if (!userBDD) {
      return res
        .status(404)
        .json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
    }
    if (
      userBDD.confirmEmail === false &&
      userBDD.email !== "admin@epn.edu.ec"
    ) {
      return res.status(403).json({
        msg: "Lo sentimos, debes confirmar tu cuenta antes de iniciar sesión",
      });
    }
    const verficarPassword = await userBDD.matchPassword(password);
    if (!verficarPassword) {
      return res
        .status(401)
        .json({ msg: "Lo sentimos, el password es incorrecto" });
    }
    const token = crearTokenJWT(userBDD._id, userBDD.rol);
    userBDD.token = token; // ← guardar en DB
    await userBDD.save();

    const { _id, nombre, apellido, email: userEmail, rol } = userBDD;

    return res.status(200).json({
      msg: `Inicio de sesión exitoso. Bienvenido/a ${nombre}!`,
      token,
      user: {
        _id,
        nombre,
        apellido,
        email: userEmail,
        rol,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const perfil = (req, res) => {
  const { rol, nombre, apellido, email } = req.userBDD;

  if (rol === "admin") {
    return res.status(200).json({
      msg: `Bienvenido administrador ${nombre} ${apellido}`,
      perfil: { nombre, apellido, email, rol },
    });
  }

    if (rol === "estudiante") {
    const { password, token, __v, createdAt, updatedAt, ...resto } = req.userBDD.toObject();
    return res.status(200).json(resto); // ← devuelve perfil completo
  }

  res.status(403).json({ msg: "Rol no autorizado" });
};

const logout = (req, res) => {
  return res.status(200).json({ msg: "Sesión cerrada exitosamente" });
};

const actualizarPerfilAdmin = async (req, res) => {
  const { id } = req.params;
  const { nombre, genero, orientacion } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).json({ msg: `Lo sentimos, debe ser un id válido` });
  if (Object.values(req.body).includes(""))
    return res
      .status(400)
      .json({ msg: "Lo sentimos, debes llenar todos los campos" });
  const userBDD = await users.findById(id);
  if (!userBDD)
    return res
      .status(404)
      .json({ msg: `Lo sentimos, no existe el veterinario ${id}` });
  if (userBDD.email != email) {
    const userBDD = await users.findOne({ email });
    if (userBDDMail) {
      return res.status(404).json({
        msg: `Lo sentimos, el email existe ya se encuentra registrado`,
      });
    }
  }

  userBDD.nombre = nombre ?? userBDD.nombre;
  userBDD.genero = genero ?? userBDD.genero;
  userBDD.orientacion = orientacion ?? userBDD.orientacion;
  userBDD.fotoPerfil = fotoPerfil ?? userBDD.fotoPerfil;
  await userBDD.save();

  return res.status(200).json({
    msg: "Perfil actualizado correctamente",
    user: {
      nombre: userBDD.nombre,
      genero: userBDD.genero,
      orientacion: userBDD.orientacion,
      fotoPerfil: userBDD.fotoPerfil,
    },
  });
};

const listarEstudiantes = async (req, res) => {
  if (req.userBDD.rol !== "admin") {
    return res
      .status(403)
      .json({ msg: "Acceso restringido solo para administradores" });
  }
  try {
    // Solo usuarios con rol "estudiante"
    const estudiantes = await users
      .find({ rol: "estudiante" })
      .select(
        "_id nombre apellido email fechaNacimiento createdAt imagenPerfil",
      );

    res.status(200).json(estudiantes);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener la lista de estudiantes" });
  }
};

const eliminarEstudiante = async (req, res) => {
  const { id } = req.params;

  // Validar que el ID sea válido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ msg: "Lo sentimos, el ID no es válido" });
  }

  try {
    const userBDD = await users.findById(id);

    if (!userBDD) {
      return res.status(404).json({ msg: "Estudiante no encontrado" });
    }

    if (userBDD.rol !== "estudiante") {
      return res
        .status(403)
        .json({ msg: "Solo se pueden eliminar estudiantes" });
    }

    await users.findByIdAndDelete(id);
    // Emitir evento de eliminación
    req.io.emit("estudiante_eliminado", { id });
    res.status(200).json({ msg: "Estudiante eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error del servidor al intentar eliminar" });
  }
};

// Crear evento (solo admin)
const crearEvento = async (req, res) => {
  try {
    const { titulo, descripcion, fecha, hora, lugar } = req.body;

    if (!titulo || !descripcion || !fecha || !hora || !lugar) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }
    if (!req.files?.imagen) {
      return res
        .status(400)
        .json({ msg: "La imagen del evento es obligatoria." });
    }
    const errorValidacion = validarFechaHoraEvento(fecha, hora);
    if (errorValidacion) {
      return res.status(400).json({ msg: errorValidacion });
    }

    let imagen = "";

    if (req.files?.imagen) {
      const file = req.files.imagen.tempFilePath;
      const resultado = await cloudinary.uploader.upload(file, {
        folder: "Eventos",
      });
      imagen = resultado.secure_url;
      await fs.unlink(file); // Borra la imagen temporal
    }

    const soloFecha = new Date(fecha).toISOString().split("T")[0];

    const evento = new Evento({
      titulo,
      descripcion,
      fecha: soloFecha,
      hora,
      lugar,
      imagen,
      creador: req.userBDD._id,
    });

    await evento.save();

    const estudiantes = await users.find({ rol: "estudiante" }).select("_id");

    const notificaciones = await HistorialNotificacion.insertMany(
      estudiantes.map((u) => ({
        usuario: u._id,
        fromUser: req.userBDD._id,
        tipo: "evento",
        titulo: "Nuevo evento disponible",
        mensaje: `El administrador creó un nuevo evento: ${titulo}`,
        leido: false,
      })),
    );

    notificaciones.forEach((n) => {
      req.io.to(n.usuario.toString()).emit("notificacion_nueva", n);
    });
    //Emitir a todos los clientes conectados
    req.io.emit("evento_creado", { evento });

    res.status(201).json({ msg: "Evento creado correctamente", evento });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al crear evento" });
  }
};

const actualizarEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, fecha, hora, lugar } = req.body;

    const evento = await Evento.findById(id);

    if (!evento) {
      return res.status(404).json({ msg: "Evento no encontrado" });
    }
    if (fecha || hora) {
      const fechaParaValidar = fecha
        ? fecha
        : evento.fecha.toISOString().split("T")[0];
      const horaParaValidar = hora ? hora : evento.hora;
      const errorValidacion = validarFechaHoraEvento(
        fechaParaValidar,
        horaParaValidar,
      );
      if (errorValidacion) {
        return res.status(400).json({ msg: errorValidacion });
      }
    }
    // Actualiza campos si vienen en el body
    if (titulo) evento.titulo = titulo;
    if (descripcion) evento.descripcion = descripcion;
    if (fecha) evento.fecha = new Date(fecha).toISOString().split("T")[0];
    if (hora) evento.hora = hora;
    if (lugar) evento.lugar = lugar;

    // Si viene nueva imagen
    if (req.files?.imagen) {
      const file = req.files.imagen.tempFilePath;
      const resultado = await cloudinary.uploader.upload(file, {
        folder: "Eventos",
      });
      evento.imagen = resultado.secure_url;
      await fs.unlink(file);
    }

    await evento.save();
    //Emitir actualización
    req.io.emit("evento_actualizado", { evento });

    res.status(200).json({ msg: "Evento actualizado correctamente", evento });
    const asistentes = evento.asistentes ?? [];

    const notificaciones = await HistorialNotificacion.insertMany(
      asistentes.map((usuarioId) => ({
        usuario: usuarioId,
        tipo: "evento",
        titulo: "Evento actualizado",
        mensaje: `El evento "${evento.titulo}" fue actualizado.`,
        leido: false,
      })),
    );

    notificaciones.forEach((n) => {
      req.io.to(n.usuario.toString()).emit("notificacion_nueva", n);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar evento" });
  }
};

const obtenerEventosAdmin = async (req, res) => {
  try {
    const eventosRaw = await Evento.find({ activo: true })
      .populate("asistentes", "nombre apellido")
      .select("-__v -createdAt -updatedAt -creador")
      .lean();

    // Transformamos para asegurar que _id es string
    const eventos = eventosRaw.map((evento) => ({
      ...evento,
      _id: evento._id.toString(),
    }));
    req.io.emit("eventos_actualizados", { eventos }); // Emitir lista actualizada a admin
    res.status(200).json(eventos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener eventos" });
  }
};

const eliminarEvento = async (req, res) => {
  try {
    const { id } = req.params;

    const evento = await Evento.findById(id);

    if (!evento) {
      return res.status(404).json({ msg: "Evento no encontrado" });
    }

    evento.activo = false;
    await evento.save();

    const asistentes = Array.isArray(evento.asistentes)
      ? evento.asistentes
      : [];

    if (asistentes.length > 0) {
      const notificaciones = await HistorialNotificacion.insertMany(
        asistentes.map((usuarioId) => ({
          usuario: usuarioId,
          fromUser: req.userBDD?._id || null,
          tipo: "evento",
          titulo: "Evento cancelado",
          mensaje: `El evento "${evento.titulo}" ha sido cancelado.`,
          leido: false,
        })),
      );

      // 🔥 EMITIR NOTIFICACIÓN REAL (sin refetch)
      for (const n of notificaciones) {
        req.io.to(n.usuario.toString()).emit("notificacion_nueva", n);
      }
    }

    // Emitir eliminación de evento (como ya haces)
    req.io.emit("evento_eliminado", { id });

    res.status(200).json({
      msg: "Evento eliminado (ocultado) correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar evento" });
  }
};

const verMisStrikes = async (req, res) => {
  try {
    const usuario = req.userBDD;

    if (!usuario || usuario.rol !== "admin") {
      return res.status(403).json({
        msg: "Acceso denegado: solo los administradores pueden ver estos datos.",
      });
    }

    // Admin ve TODOS los strikes de todos los estudiantes
    const strikes = await Strike.find({})
      .populate("de", "nombre apellido email") // quién envió
      .populate("para", "nombre apellido email") // a quién (admin)
      .populate("usuarioReportado", "nombre apellido email")
      .populate("chat")
      .sort({ fecha: -1 });

    res.status(200).json(strikes);
  } catch (error) {
    console.error("Error al obtener strikes:", error);
    res.status(500).json({ msg: "Error interno al obtener strikes." });
  }
};

const responderStrike = async (req, res) => {
  try {
    const { strikeId } = req.params;
    const { respuesta } = req.body;
    const usuario = req.userBDD;

    // Validar que sea admin
    if (!usuario || usuario.rol !== "admin") {
      return res.status(403).json({
        msg: "Acceso denegado: solo los administradores pueden responder strikes.",
      });
    }

    // Validar campos obligatorios
    if (!strikeId || !respuesta || respuesta.trim().length < 5) {
      return res.status(400).json({
        msg: "Strike ID y respuesta (mínimo 5 caracteres) son obligatorios",
      });
    }

    // Buscar el strike
    const strike = await Strike.findById(strikeId).populate("de", "_id");
    if (!strike) {
      return res.status(404).json({ msg: "Strike no encontrado" });
    }

    // Verificar que el strike va dirigido al admin actual
    if (strike.para.toString() !== usuario._id.toString()) {
      return res
        .status(403)
        .json({ msg: "No puedes responder strikes de otros admins" });
    }

    // Actualizar el strike con la respuesta
    strike.respuesta = respuesta.trim();
    strike.respondido = true;
    strike.fechaRespuesta = new Date();
    await strike.save();
    // responderStrike — notifica al estudiante afectado (revision)
    req.io.to(strike.de._id.toString()).emit("strike_respondido", {
      strikeId: strike._id,
    });

    // Crear notificación para el usuario que hizo el strike
    const notif = await HistorialNotificacion.create({
      usuario: strike.de._id,
      fromUser: usuario._id,
      tipo: "respuesta_strike",
      titulo: "Respuesta del Equipo de Soporte",
      mensaje: `El equipo de soporte de Amikuna ha respondido a tu ${strike.tipo}: "${respuesta}"`,
    });
    req.io
      .to(strike.de._id.toString())
      .emit("notificacion_nueva", notif.toObject());

    return res.status(200).json({
      msg: "Respuesta enviada exitosamente",
      strike,
    });
  } catch (error) {
    console.error("Error al responder strike:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const obtenerDenunciaDetalle = async (req, res) => {
  try {
    const usuario = req.userBDD;
    if (!usuario || usuario.rol !== "admin") {
      return res
        .status(403)
        .json({ msg: "Acceso denegado: solo administradores" });
    }

    const { strikeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(strikeId)) {
      return res.status(400).json({ msg: "ID de strike inválido" });
    }

    const strike = await Strike.findById(strikeId)
      .populate("de", "nombre apellido email")
      .populate("usuarioReportado", "nombre apellido email")
      .populate({
        path: "chat",
        populate: {
          path: "mensajes.emisor",
          select: "nombre apellido email",
        },
      });

    if (!strike) {
      return res.status(404).json({ msg: "Strike no encontrado" });
    }

    return res.status(200).json({ strike });
  } catch (error) {
    console.error("Error al obtener detalle de denuncia:", error);
    return res
      .status(500)
      .json({ msg: "Error interno al obtener detalle de denuncia" });
  }
};

const eliminarMatchYChat = async (req, res) => {
  try {
    const usuario = req.userBDD;
    if (!usuario || usuario.rol !== "admin") {
      return res
        .status(403)
        .json({ msg: "Acceso denegado: solo administradores" });
    }

    const { strikeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(strikeId)) {
      return res.status(400).json({ msg: "ID de strike inválido" });
    }

    const strike = await Strike.findById(strikeId);
    // ✅ Ya no se exige strike.chat para continuar
    if (!strike || !strike.usuarioReportado) {
      return res
        .status(404)
        .json({ msg: "Strike o datos asociados no encontrados" });
    }

    // ✅ Se elimina solo el match (sin tocar el chat)
    await users.findByIdAndUpdate(strike.de, {
      $pull: {
        matches: strike.usuarioReportado,
        siguiendo: strike.usuarioReportado,
        seguidores: strike.usuarioReportado,
      },
    });

    await users.findByIdAndUpdate(strike.usuarioReportado, {
      $pull: {
        matches: strike.de,
        siguiendo: strike.de,
        seguidores: strike.de,
      },
    });

    strike.status = "resuelto";
    await strike.save();

    const notifDenunciante = await HistorialNotificacion.create({
      usuario: strike.de,
      fromUser: usuario._id,
      tipo: "respuesta_strike",
      titulo: "Respuesta del Equipo de Soporte",
      mensaje:
        "El equipo de Amikuna ha resuelto tu denuncia y eliminado el match con el usuario reportado.",
    });

    const notifReportado = await HistorialNotificacion.create({
      usuario: strike.usuarioReportado,
      fromUser: usuario._id,
      tipo: "respuesta_strike",
      titulo: "Aviso del Equipo de Soporte",
      mensaje:
        "El equipo de Amikuna ha eliminado tu match con un usuario debido a una denuncia.",
    });

    req.io
      .to(strike.de.toString())
      .emit("notificacion_nueva", notifDenunciante.toObject());
    req.io
      .to(strike.usuarioReportado.toString())
      .emit("notificacion_nueva", notifReportado.toObject());

    // ✅ Emite match_eliminado a ambos
    req.io.to(strike.de.toString()).emit("match_eliminado", {
      strikeId: strike._id.toString(),
      matchId: strike.usuarioReportado.toString(),
    });
    req.io.to(strike.usuarioReportado.toString()).emit("match_eliminado", {
      strikeId: strike._id.toString(), // ← para el admin
      matchId: strike.de.toString(),
    });

    return res.status(200).json({
      msg: "Match eliminado con éxito",
      strike,
    });
  } catch (error) {
    console.error("Error eliminando match:", error);
    return res.status(500).json({ msg: "Error interno al eliminar el match" });
  }
};

const verTesoreria = async (req, res) => {
  try {
    const tesoreria = await Tesoreria.findOne();
    const aportes = await Aporte.find({ status: "pagado" })
      .populate("userId", "nombre apellido correo")
      .sort({ createdAt: -1 });

    const totalAportes = aportes.reduce((acc, a) => acc + a.amount, 0);

    res.status(200).json({
      saldoDisponible: tesoreria?.saldoTotal ?? 0,
      totalRecaudado: totalAportes,
      totalMovimientos: tesoreria?.movimientos?.length ?? 0,
      movimientos: tesoreria?.movimientos ?? [],
      aportes,
    });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Error al obtener tesorería", error: error.message });
  }
};

// Registrar un gasto — resta del saldo y guarda la razón
const registrarGasto = async (req, res) => {
  try {
    const { monto, razon } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ msg: "Monto inválido" });
    }
    if (!razon || razon.trim().length < 3) {
      return res.status(400).json({ msg: "Debes especificar una razón" });
    }

    const tesoreria = await Tesoreria.findOne();
    if (!tesoreria) {
      return res.status(404).json({ msg: "No hay tesorería inicializada aún" });
    }

    if (tesoreria.saldoTotal < monto) {
      return res.status(400).json({
        msg: `Saldo insuficiente. Disponible: $${tesoreria.saldoTotal}`,
      });
    }

    tesoreria.saldoTotal -= monto;
    tesoreria.movimientos.push({
      tipo: "gasto",
      monto,
      razon: razon.trim(),
    });

    await tesoreria.save();

    res.status(200).json({
      msg: "Gasto registrado correctamente",
      saldoActual: tesoreria.saldoTotal,
    });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Error al registrar gasto", error: error.message });
  }
};

// Ajuste manual — por si necesitas corregir el saldo a mano
const ajustarSaldo = async (req, res) => {
  try {
    const { monto, razon } = req.body;

    if (!razon || razon.trim().length < 3) {
      return res.status(400).json({ msg: "Debes especificar una razón" });
    }

    let tesoreria = await Tesoreria.findOne();
    if (!tesoreria) {
      tesoreria = await Tesoreria.create({ saldoTotal: 0, movimientos: [] });
    }

    const tipo = monto >= 0 ? "ingreso" : "gasto";
    tesoreria.saldoTotal += monto;
    tesoreria.movimientos.push({
      tipo,
      monto: Math.abs(monto),
      razon: razon.trim(),
    });

    await tesoreria.save();

    res.status(200).json({
      msg: "Saldo ajustado correctamente",
      saldoActual: tesoreria.saldoTotal,
    });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Error al ajustar saldo", error: error.message });
  }
};

export {
  registro,
  confirmarMail,
  recuperarPassword,
  comprobarTokenPasword,
  crearNuevoPassword,
  cambiarPasswordAdmin,
  login,
  perfil,
  logout,
  actualizarPerfilAdmin,
  listarEstudiantes,
  eliminarEstudiante,
  crearEvento,
  obtenerEventosAdmin,
  actualizarEvento,
  eliminarEvento,
  verMisStrikes,
  obtenerDenunciaDetalle,
  eliminarMatchYChat,
  responderStrike,
  verTesoreria,
  registrarGasto,
  ajustarSaldo,
};
