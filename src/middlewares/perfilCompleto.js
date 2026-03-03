const perfilCompleto = (req, res, next) => {
  const u = req.userBDD;            
  const tieneFoto      = !!u.imagenPerfil;
  const tieneGenero    = u.genero !== "otro";
  const tieneBiografia = !!u.biografia?.trim();
  const tieneIntereses = Array.isArray(u.intereses) && u.intereses.length > 0;
  // AÑADIDO: Validación de ubicación
  const tieneUbicacion = !!u.ubicacion?.ciudad && !!u.ubicacion?.pais;

  if (tieneFoto && tieneGenero && tieneBiografia && tieneIntereses && tieneUbicacion) {
    return next();                  
  }
  return res
    .status(403)
    .json({ msg: "Debes completar tu perfil antes de ver otros estudiantes" });
};

export { perfilCompleto };
