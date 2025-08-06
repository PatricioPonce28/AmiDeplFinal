
import express from 'express'
import passport from '../config/passport.js'
import { crearTokenJWT } from '../middlewares/JWT.js';
const router = express.Router();

//  Redirige al login con Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

//  Google redirige aquí después del login
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    // Si quieres, redirige a tu frontend o devuelve un JSON
    res.redirect('/auth/success');
  }
);

//  Ruta de éxito
router.get('/success', (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });

  const { _id, rol } = req.user; // `req.user` debe venir de Passport
  const token = crearTokenJWT(_id, rol);
  

 res.status(200).json({
    msg: "Autenticación exitosa",
    user: req.user,
    token,
  });
});

//  Ruta de fallo
router.get('/login-failed', (req, res) => {
  res.status(401).json({ message: 'Falló la autenticación con Google' });
});

//  Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.json({ message: 'Cerraste sesión correctamente' });
  });
});

export default router;
