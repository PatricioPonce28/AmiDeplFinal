import jwt from "jsonwebtoken";
import users from "../models/users.js";

const crearTokenJWT = (id, rol) => {
  return jwt.sign({ id, rol }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const verificarTokenJWT = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Token no proporcionado o incorrecto" });
  }

  try {
    const token = authorization.split(" ")[1];
    const { id, rol } = jwt.verify(token, process.env.JWT_SECRET);

    // Validar rol permitido
    if (rol !== "admin" && rol !== "estudiante") {
      return res.status(403).json({ msg: "Acceso restringido" });
    }

    const userBDD = await users.findById(id).select("-password");
    if (!userBDD) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    req.userBDD = userBDD; // ← Aseguramos que no es null
    next();

  } catch (error) {
    console.error("Error al verificar token:", error);
    return res.status(401).json({ msg: "Token no válido o expirado" });
  }
};

export { crearTokenJWT, verificarTokenJWT };
