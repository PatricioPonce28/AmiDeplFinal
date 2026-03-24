import mongoose from "mongoose";

import users from "../models/users.js";
import { crearTokenJWT } from "../middlewares/JWT.js";
import Evento from "../models/Evento.js";
import cloudinary from "cloudinary";
import fs from "fs-extra";
import Strike from "../models/strikes.js";
import HistorialNotificacion from '../models/HistorialNotificacion.js';

//nuevas importaciones para admin
import supabase from "../config/supabase.js";

// registro para que supabase use su sistema de correo en lugar del nuestro, pero manteniendo la lógica de creación de usuario en MongoDB y el token personalizado.

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

  // Enviar correo via Supabase — NUEVO
  try {
    const confirmationLink = `${process.env.URL_FRONTEND}/confirmar/${newUser.token}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: confirmationLink,
        data: { nombre, apellido }
      }
    });

    if (error) throw error;

    console.log("✅ Email de confirmación enviado:", email);

  } catch (error) {
    console.error("❌ Error enviando correo:", error.message);
    return res.status(500).json({
      msg: "Usuario registrado pero hubo un problema al enviar el correo."
    });
  }

  return res.status(200).json({
    msg: "Revisa tu correo electrónico para confirmar tu cuenta"
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
  if (Object.values(req.body).includes(""))
    return res
      .status(404)
      .json({ msg: "Lo sentimos, debes llenar todos los campos" });
  const userBDD = await users.findOne({ email });
  if (!userBDD)
    return res
      .status(404)
      .json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
  const token = userBDD.crearToken();
  userBDD.token = token;
  await sendMailToRecoveryPassword(email, token);
  await userBDD.save();
  res
    .status(200)
    .json({
      msg: "Revisa tu correo electrónico para reestablecer tu contraseña",
    });
};


const comprobarTokenPasword = async (req, res) => {
  const { token } = req.params;
  const userBDD = await users.findOne({ token });
  if (userBDD?.token !== req.params.token)
    return res
      .status(404)
      .json({ msg: "Lo sentimos, no se puede validar la cuenta" });
  await userBDD.save();
  res
    .status(200)
    .json({ msg: "Token confirmado, ya puedes crear tu nuevo password" });
};

const crearNuevoPassword = async (req, res) => {
  const { password, confirmpassword } = req.body;
  if (Object.values(req.body).includes(""))
    return res
      .status(404)
      .json({ msg: "Lo sentimos, debes llenar todos los campos" });
  if (password != confirmpassword)
    return res
      .status(404)
      .json({ msg: "Lo sentimos, los passwords no coinciden" });
  const userBDD = await users.findOne({ token: req.params.token });
  if (userBDD?.token !== req.params.token)
    return res
      .status(404)
      .json({ msg: "Lo sentimos, no se puede validar la cuenta" });
  userBDD.token = null;
  userBDD.password = await userBDD.encryptPassword(password);
  await userBDD.save();
  res
    .status(200)
    .json({
      msg: "Felicitaciones, ya puedes iniciar sesión con tu nuevo password",
    });
};

const cambiarPasswordAdmin = async (req, res) => {
  try {
    const { email, masterKey, securityAnswer, newPassword, confirmPassword } =
      req.body;

    // Validaciones
    if (
      !email ||
      !masterKey ||
      !securityAnswer ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }
    if (email !== "admin@epn.edu.ec") {
      return res
        .status(403)
        .json({ msg: "Acceso denegado. Solo para administradores" });
    }
    if (masterKey !== process.env.ADMIN_MASTER_KEY) {
      return res.status(403).json({ msg: "Clave maestra incorrecta" });
    }
    if (securityAnswer !== "2025-A") {
      return res.status(403).json({ msg: "Respuesta de seguridad incorrecta" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: "Las contraseñas no coinciden" });
    }

    const adminUser = await users.findOne({ email });
    if (!adminUser) {
      return res
        .status(404)
        .json({
          msg: "Ejecuta el script de creación de administrador primero",
        });
    }

    adminUser.password = await adminUser.encryptPassword(newPassword);
    await adminUser.save();

    res.status(200).json({ msg: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Error en cambiarPasswordAdmin:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const generarNuevaPasswordAdmin = async (req, res) => {
  try {
    const { email, masterKey, securityAnswer } = req.body;

    // Validar campos obligatorios
    if (!email || !masterKey || !securityAnswer) {
      return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    // Validar que es el email del administrador
    if (email !== "admin@epn.edu.ec") {
      return res
        .status(403)
        .json({ msg: "Acceso denegado. Solo para administradores" });
    }

    // Validar la clave maestra
    if (masterKey !== process.env.ADMIN_MASTER_KEY) {
      return res.status(403).json({ msg: "Clave maestra incorrecta" });
    }

    // Validar la pregunta de seguridad
    if (securityAnswer !== "2025-A") {
      return res.status(403).json({ msg: "Respuesta de seguridad incorrecta" });
    }

    // Buscar al administrador (debe existir por tu script)
    const adminUser = await users.findOne({ email });
    if (!adminUser) {
      return res
        .status(404)
        .json({
          msg: "Administrador no encontrado. Ejecuta el script de creación primero.",
        });
    }

    // Generar nueva contraseña (sin token)
    const nuevaPassword =
      "Admin" + Math.random().toString(36).slice(2, 10) + "!";

    // Actualizar contraseña (encriptada)
    adminUser.password = await adminUser.encryptPassword(nuevaPassword);
    await adminUser.save();

    res.status(200).json({
      msg: "Nueva contraseña generada exitosamente",
      nuevaPassword: nuevaPassword,
      warning:
        "Guarda esta contraseña inmediatamente. No se mostrará nuevamente.",
    });
  } catch (error) {
    console.error("Error en generarNuevaPasswordAdmin:", error);
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
      return res
        .status(403)
        .json({
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
    return res.status(200).json({
      msg: `Bienvenido estudiante ${nombre} ${apellido}`,
      perfil: { nombre, apellido, email, rol },
    });
  }

  res.status(403).json({ msg: "Rol no autorizado" });
};

const logout = (req, res) => {
  return res.status(200).json({ msg: 'Sesión cerrada exitosamente' });
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
      return res
        .status(404)
        .json({
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
        "_id nombre apellido email fechaNacimiento createdAt imagenPerfil"
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

    const estudiantes = await users.find({ rol: 'estudiante' }).select('_id');
    const notificaciones = estudiantes.map(u => ({
      usuario: u._id,
      tipo: 'evento',
      titulo: 'Nuevo evento disponible',
      mensaje: `El administrador creó un nuevo evento: ${titulo}`,
      leido: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    if (notificaciones.length) {
      await HistorialNotificacion.insertMany(notificaciones);
    }

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

    res.status(200).json({ msg: "Evento actualizado correctamente", evento });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar evento" });
  }
};

const obtenerEventosAdmin = async (req, res) => {
  try {
    const eventosRaw = await Evento.find({ activo: true })
      .populate('asistentes', 'nombre apellido')
      .select("-__v -createdAt -updatedAt -creador")
      .lean();

    // Transformamos para asegurar que _id es string
    const eventos = eventosRaw.map(evento => ({
      ...evento,
      _id: evento._id.toString(),
    }));

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

    res.status(200).json({ msg: "Evento eliminado (ocultado) correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar evento" });
  }
};

const verMisStrikes = async (req, res) => {
  try {
    const usuario = req.userBDD;

    if (!usuario || usuario.rol !== "admin") {
      return res
        .status(403)
        .json({
          msg: "Acceso denegado: solo los administradores pueden ver estos datos.",
        });
    }

    // Admin ve TODOS los strikes de todos los estudiantes
    const strikes = await Strike.find({})
      .populate("de", "nombre apellido email") // quién envió
      .populate("para", "nombre apellido email") // a quién (admin)
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
      return res
        .status(403)
        .json({
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
      return res.status(403).json({ msg: "No puedes responder strikes de otros admins" });
    }

    // Actualizar el strike con la respuesta
    strike.respuesta = respuesta.trim();
    strike.respondido = true;
    strike.fechaRespuesta = new Date();
    await strike.save();

    // Crear notificación para el usuario que hizo el strike
    await HistorialNotificacion.create({
      usuario: strike.de._id,
      fromUser: usuario._id,
      tipo: 'respuesta_strike',
      titulo: 'Respuesta del Equipo de Soporte',
      mensaje: `El equipo de soporte de Amikuna ha respondido a tu ${strike.tipo}: "${respuesta}"`
    });

    return res.status(200).json({
      msg: "Respuesta enviada exitosamente",
      strike,
    });
  } catch (error) {
    console.error("Error al responder strike:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};


export {
  registro,
  confirmarMail,
  recuperarPassword,
  comprobarTokenPasword,
  crearNuevoPassword,
  cambiarPasswordAdmin,
  generarNuevaPasswordAdmin,
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
  responderStrike,
};
