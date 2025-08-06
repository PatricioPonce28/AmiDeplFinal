const perfilCompleto = (req, res, next) => {
  const u = req.userBDD;            // viene del JWT
  const tieneFoto      = !!u.imagenPerfil;
  const tieneGenero    = u.genero !== "otro";
  const tieneBiografia = !!u.biografia?.trim();
  const tieneIntereses = Array.isArray(u.intereses) && u.intereses.length > 0;

  if (tieneFoto && tieneGenero && tieneBiografia && tieneIntereses) {
    return next();                  
  }
  return res
    .status(403)
    .json({ msg: "Debes completar tu perfil antes de ver otros estudiantes" });
};

export { perfilCompleto,  };