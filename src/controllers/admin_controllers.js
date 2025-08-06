import mongoose from "mongoose"  
import {sendMailToRegister, sendMailToRecoveryPassword} from "../config/nodemailer.js"
import users from "../models/users.js"
import { crearTokenJWT } from "../middlewares/JWT.js"
import Evento from "../models/Evento.js"
import cloudinary from "cloudinary";
import fs from "fs-extra"
import Strike from '../models/strikes.js';


const registro = async (req, res) => {
  const { nombre, apellido, email, password, confirmPassword } = req.body;

  // Validar que ningún campo esté vacío
  if ([nombre, apellido, email, password, confirmPassword].includes("")) {
    return res.status(400).json({ msg: "Lo sentimos, todos los campos son obligatorios" });
  }

  // Verificar si el correo ya existe
  const verificarEmailBDD = await users.findOne({ email });
  if (verificarEmailBDD) {
    return res.status(400).json({ msg: "Lo sentimos, este email ya está registrado" });
  }

  // Validar que las contraseñas coincidan
  if (password !== confirmPassword) {
    return res.status(400).json({ msg: "Las contraseñas no coinciden" });
  }

  // Crear nuevo usuario
  const newUser = new users({ nombre, apellido, email });
  newUser.password = await newUser.encryptPassword(password);

  // Generar token de confirmación
  newUser.crearToken();

  // Guardar en BD
  await newUser.save();

  // Enviar correo
  await sendMailToRegister(email, newUser.token);

  return res.status(200).json({ msg: "Revisa tu correo electrónico para confirmar tu cuenta" });
};


const confirmarMail = async (req,res)=>{
    const token = req.params.token
    const userBDD = await users.findOne({token})
    if(!userBDD?.token) return res.status(404).json({msg:"La cuenta ya ha sido confirmada"})
    userBDD.token = null
    userBDD.confirmEmail=true
    await userBDD.save()
    res.status(200).json({msg:"Token confirmado, ya puedes iniciar sesión"}) 
}

const recuperarPassword = async(req,res)=>{
    const {email} = req.body
    if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Lo sentimos, debes llenar todos los campos"})
    const userBDD = await users.findOne({email})
    if(!userBDD) return res.status(404).json({msg:"Lo sentimos, el usuario no se encuentra registrado"})
    const token = userBDD.crearToken()
    userBDD.token=token
    await sendMailToRecoveryPassword(email,token)
    await userBDD.save()
    res.status(200).json({msg:"Revisa tu correo electrónico para reestablecer tu contraseña"})
}

const comprobarTokenPasword = async (req,res)=>{
    const {token} = req.params
    const userBDD = await users.findOne({token})
    if(userBDD?.token !== req.params.token) return res.status(404).json({msg:"Lo sentimos, no se puede validar la cuenta"})
    await userBDD.save()
    res.status(200).json({msg:"Token confirmado, ya puedes crear tu nuevo password"}) 
}

const crearNuevoPassword = async (req,res)=>{
    const{password,confirmpassword} = req.body
    if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Lo sentimos, debes llenar todos los campos"})
    if(password != confirmpassword) return res.status(404).json({msg:"Lo sentimos, los passwords no coinciden"})
    const userBDD = await users.findOne({token:req.params.token})
    if(userBDD?.token !== req.params.token) return res.status(404).json({msg:"Lo sentimos, no se puede validar la cuenta"})
    userBDD.token = null
    userBDD.password = await userBDD.encryptPassword(password)
    await userBDD.save()
    res.status(200).json({msg:"Felicitaciones, ya puedes iniciar sesión con tu nuevo password"}) 
}


const cambiarPasswordAdmin = async (req, res) => {
    try {
        const { email, masterKey, securityAnswer, newPassword, confirmPassword } = req.body;
        
        // Validaciones 
        if (!email || !masterKey || !securityAnswer || !newPassword || !confirmPassword) {
            return res.status(400).json({ msg: "Todos los campos son obligatorios" });
        }
        if (email !== "admin@epn.edu.ec") {
            return res.status(403).json({ msg: "Acceso denegado. Solo para administradores" });
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
            return res.status(404).json({ msg: "Ejecuta el script de creación de administrador primero" });
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
            return res.status(403).json({ msg: "Acceso denegado. Solo para administradores" });
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
            return res.status(404).json({ msg: "Administrador no encontrado. Ejecuta el script de creación primero." });
        }
        
        // Generar nueva contraseña (sin token)
        const nuevaPassword = "Admin" + Math.random().toString(36).slice(2, 10) + "!";
        
        // Actualizar contraseña (encriptada)
        adminUser.password = await adminUser.encryptPassword(nuevaPassword);
        await adminUser.save();
        
        res.status(200).json({ 
            msg: "Nueva contraseña generada exitosamente",
            nuevaPassword: nuevaPassword,
            warning: "Guarda esta contraseña inmediatamente. No se mostrará nuevamente."
        });
        
    } catch (error) {
        console.error("Error en generarNuevaPasswordAdmin:", error);
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" });
  }
  try {
    const userBDD = await users.findOne({ email }).select("-__v -updatedAt -createdAt");
    if (!userBDD) {
      return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
    }
    if (userBDD.confirmEmail === false && userBDD.email !== "admin@epn.edu.ec") {
      return res.status(403).json({ msg: "Lo sentimos, debes confirmar tu cuenta antes de iniciar sesión" });
    }
    const verficarPassword = await userBDD.matchPassword(password);
    if (!verficarPassword) {
      return res.status(401).json({ msg: "Lo sentimos, el password es incorrecto" });
    }
    const token = crearTokenJWT(userBDD._id,userBDD.rol)
    const {
      _id,
      nombre,
      apellido,
      email: userEmail,
      rol
    } = userBDD;

    return res.status(200).json({
      
      msg: `Inicio de sesión exitoso. Bienvenido/a ${nombre}!`,
      token,
      user: {
        
        _id,
        nombre,
        apellido,
        email: userEmail,
        rol
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error interno del servidor" });
  }
};

const perfil = (req, res) => {
  const { rol, nombre, apellido, email } = req.userBDD;

  if (rol === 'admin') {
    return res.status(200).json({
      msg: `Bienvenido administrador ${nombre} ${apellido}`,
      perfil: { nombre, apellido, email, rol }
    });
  }

  if (rol === 'estudiante') {
    return res.status(200).json({
      msg: `Bienvenido estudiante ${nombre} ${apellido}`,
      perfil: { nombre, apellido, email, rol }
    });
  }

  res.status(403).json({ msg: "Rol no autorizado" });
};

const actualizarPerfilAdmin = async (req,res)=>{
    const {id} = req.params
    const {nombre, genero, orientacion} = req.body
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, debe ser un id válido`});
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
    const userBDD = await users.findById(id)
    if(!userBDD) return res.status(404).json({msg:`Lo sentimos, no existe el veterinario ${id}`})
    if (userBDD.email != email)
    {
        const userBDD = await users.findOne({email})
        if (userBDDMail)
        {
            return res.status(404).json({msg:`Lo sentimos, el email existe ya se encuentra registrado`})  
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
      fotoPerfil: userBDD.fotoPerfil
    }
  });
}

const listarEstudiantes = async (req, res) => {
  if (req.userBDD.rol !== "admin") {
    return res.status(403).json({ msg: "Acceso restringido solo para administradores" });
  }
  try {
    // Solo usuarios con rol "estudiante"
    const estudiantes = await users.find({ rol: "estudiante" })
      .select("_id nombre apellido email fechaNacimiento createdAt imagenPerfil");

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
      return res.status(403).json({ msg: "Solo se pueden eliminar estudiantes" });
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
        folder: 'Eventos'
      });
      imagen = resultado.secure_url;
      await fs.unlink(file); // Borra la imagen temporal
    }

    const soloFecha = new Date(fecha).toISOString().split('T')[0];

    const evento = new Evento({
      titulo,
      descripcion,
      fecha: soloFecha,
      hora,
      lugar,
      imagen,
      creador: req.userBDD._id 
    });

    await evento.save();

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
    if (fecha) evento.fecha = new Date(fecha).toISOString().split('T')[0];
    if (hora) evento.hora = hora;
    if (lugar) evento.lugar = lugar;

    // Si viene nueva imagen
    if (req.files?.imagen) {
      const file = req.files.imagen.tempFilePath;
      const resultado = await cloudinary.uploader.upload(file, {
        folder: 'Eventos'
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
    const eventos = await Evento.find({ activo: true })
      .select('-_id -__v -createdAt -updatedAt -creador');

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

    if (!usuario || usuario.rol !== 'admin') {
      return res.status(403).json({ msg: "Acceso denegado: solo los administradores pueden ver estos datos." });
    }

    const strikes = await Strike.find({ para: usuario._id })
      .populate('de', 'nombre apellido correo') // quién envió
      .sort({ fecha: -1 });

    res.status(200).json(strikes);

  } catch (error) {
    console.error("Error al obtener mensajes del admin:", error);
    res.status(500).json({ msg: "Error interno al obtener mensajes." });
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
  actualizarPerfilAdmin,
  listarEstudiantes, 
  eliminarEstudiante,
  crearEvento,
  obtenerEventosAdmin,
  actualizarEvento,
  eliminarEvento,
  verMisStrikes
}
