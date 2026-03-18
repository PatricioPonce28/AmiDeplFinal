import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const sendMailToRegister = async (userMail, token) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    })

    try {
        const confirmationLink = `${process.env.URL_FRONTEND}/confirmar/${token}`

        await transporter.sendMail({
            from: `AmiKuna <${process.env.GMAIL_USER}>`,
            to: userMail,
            subject: '❤️🔥 AmiKuna 🔥❤️ - Confirma tu cuenta para empezar',
            html: `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Confirma tu cuenta - AmiKuna</title>
                </head>
                <body style="margin:0; padding:0; font-family:Arial, Helvetica, sans-serif; background:#f9f9f9;">
                  <div style="max-width:600px; margin:30px auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(255,107,107,0.2);">
                    <div style="background:linear-gradient(135deg, #ff6b6b, #ff4757, #ff3838); padding:40px 20px; text-align:center;">
                      <span style="font-size:48px;">❤️</span>
                      <h1 style="color:white; margin:10px 0 0; font-size:36px; font-weight:bold;">🔥 AmiKuna 🔥</h1>
                      <p style="color:rgba(255,255,255,0.9); margin:12px 0 0; font-size:18px;">Conoce y comparte con la comunidad</p>
                    </div>
                    <div style="padding:40px 30px; text-align:center;">
                      <h2 style="color:#ff4757; font-size:28px; margin:0 0 20px;">¡Bienvenido(a) a AmiKuna! 💕</h2>
                      <p style="color:#555; font-size:16px; line-height:1.6; margin:0 0 30px;">
                        Estás a solo un clic de comenzar a conectar con personas increíbles.<br>
                        Confirma tu cuenta para activar tu perfil.
                      </p>
                      <a href="${confirmationLink}" style="display:inline-block; background:linear-gradient(135deg, #ff6b6b, #ff4757); color:white; padding:16px 50px; text-decoration:none; border-radius:50px; font-weight:bold; font-size:18px; box-shadow:0 4px 15px rgba(255,71,87,0.4);">
                        ✨ Confirmar mi cuenta ✨
                      </a>
                      <p style="color:#777; font-size:14px; margin:30px 0 0;">
                        Este enlace es válido por <strong>24 horas</strong>.<br>
                        Si no solicitaste esta cuenta, puedes ignorar este correo.
                      </p>
                    </div>
                    <div style="background:linear-gradient(135deg, #ff8e8e, #ffa8a8); padding:25px; text-align:center;">
                      <p style="color:white; font-size:14px; margin:0;">Con cariño,<br><strong>El equipo de AmiKuna</strong> ❤️</p>
                    </div>
                  </div>
                </body>
                </html>
              `
        })

        console.log(`Email de registro enviado a: ${userMail}`)
    } catch (error) {
        console.error('Error en sendMailToRegister:', error)
        throw error
    }
}

const sendMailToRecoveryPassword = async (userMail, token) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    })

    try {
        const resetLink = `${process.env.URL_FRONTEND}/recuperarpassword/${token}`

        await transporter.sendMail({
            from: `AmiKuna <${process.env.GMAIL_USER}>`,
            to: userMail,
            subject: '🔐 AmiKuna - Recupera tu contraseña',
            html: `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Recuperar contraseña - AmiKuna</title>
                </head>
                <body style="margin:0; padding:0; font-family:Arial, Helvetica, sans-serif; background:#f9f9f9;">
                  <div style="max-width:600px; margin:30px auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(255,107,107,0.2);">
                    <div style="background:linear-gradient(135deg, #ff6b6b, #ff4757); padding:40px 20px; text-align:center;">
                      <span style="font-size:48px;">🔐</span>
                      <h1 style="color:white; margin:10px 0 0; font-size:32px;">AmiKuna</h1>
                      <p style="color:rgba(255,255,255,0.9); margin:12px 0 0;">Recuperación de contraseña</p>
                    </div>
                    <div style="padding:40px 30px; text-align:center;">
                      <h2 style="color:#ff4757; font-size:26px; margin:0 0 20px;">¿Olvidaste tu contraseña? 💭</h2>
                      <p style="color:#555; font-size:16px; line-height:1.6; margin:0 0 30px;">
                        No te preocupes, pasa muy seguido.<br>
                        Haz clic en el botón de abajo para crear una nueva contraseña.
                      </p>
                      <a href="${resetLink}" style="display:inline-block; background:linear-gradient(135deg, #ff6b6b, #ff4757); color:white; padding:16px 50px; text-decoration:none; border-radius:50px; font-weight:bold; font-size:18px; box-shadow:0 4px 15px rgba(255,71,87,0.4);">
                        🔑 Restablecer contraseña 🔑
                      </a>
                      <p style="color:#777; font-size:14px; margin:30px 0 0;">
                        <strong>Este enlace expira en 1 hora.</strong><br>
                        Si no solicitaste este cambio, ignora este correo.
                      </p>
                    </div>
                    <div style="background:linear-gradient(135deg, #ff8e8e, #ffa8a8); padding:25px; text-align:center;">
                      <p style="color:white; font-size:14px; margin:0;">Con seguridad y cariño,<br><strong>Equipo AmiKuna</strong> ❤️</p>
                    </div>
                  </div>
                </body>
                </html>
            `
        })

        console.log(`Email de recuperación enviado a: ${userMail}`)
    } catch (error) {
        console.error('Error en sendMailToRecoveryPassword:', error)
        throw error
    }
}

export { sendMailToRegister, sendMailToRecoveryPassword }