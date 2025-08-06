import users from '../models/users.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    let user = await users.findOne({ email });

    if (!user) {
      user = new users({
        nombre: profile.name.givenName,
        apellido: profile.name.familyName || '',
        email: email,
        password: '',
        imagenPerfil: profile.photos[0].value,
        confirmEmail: true,
        genero: profile.gender || 'otro',
        rol: 'estudiante',
        googleId: profile.id 
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = profile.id;
      await user.save();
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

export default passport;
