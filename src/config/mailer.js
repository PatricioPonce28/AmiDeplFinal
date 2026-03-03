import { Resend } from 'resend'
import dotenv from 'dotenv'
dotenv.config()

const resend = new Resend(process.env.RESEND_API_KEY)

const sendMailToRegister = async (userMail, token) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'AmiKuna <onboarding@resend.dev>',
            to: userMail,
            subject: '❤️🔥 AmiKuna 🔥 ❤️',
            html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bienvenido a AmiKuna</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);">
                    <div style="background: linear-gradient(135deg, #ff6b6b, #ff4757, #ff3838); padding: 40px 20px; text-align: center;">
                        <span style="font-size: 40px;">❤️</span>
                        <h1 style="color: white; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">
                            🔥 AmiKuna 🔥
                        </h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">
                            ¡Conoce y comparte con la comunidad!
                        </p>
                    </div>
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #ff4757; font-size: 28px; text-align: center;">
                            ¡Bienvenido a nuestra comunidad! 💕
                        </h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6; text-align: center;">
                            Estás a un paso de encontrar conexiones increíbles. Solo confirma tu cuenta para comenzar.
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.URL_FRONTEND}/confirmar/${token}"
                               style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ff4757); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px;">
                                ✨ Confirmar mi cuenta ✨
                            </a>
                        </div>
                        <div style="background: linear-gradient(135deg, #ffe0e6, #fff5f7); padding: 25px; border-radius: 15px; border-left: 5px solid #ff6b6b; margin: 20px 0;">
                            <p style="color: #ff4757; font-size: 16px; line-height: 1.6; margin: 0; text-align: center;">
                                <strong>El equipo de AmiKuna</strong> te da la más cordial bienvenida 💕
                            </p>
                        </div>
                    </div>
                    <div style="background: linear-gradient(135deg, #ff8e8e, #ffa8a8); padding: 20px; text-align: center;">
                        <p style="color: #fff; font-size: 14px; margin: 0;">
                            Con amor, el equipo de <strong>AmiKuna</strong> ❤️
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `
        })

        if (error) {
            console.error('Error al enviar email de registro:', error)
            throw new Error(error.message)
        }

        console.log('Email de registro enviado:', data.id)
    } catch (error) {
        console.error('Error en sendMailToRegister:', error)
        throw error
    }
}

const sendMailToRecoveryPassword = async (userMail, token) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'AmiKuna <onboarding@resend.dev>',
            to: userMail,
            subject: 'Reestablecer contraseña - AmiKuna ❤️',
            html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Recuperar Contraseña - AmiKuna</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);">
                    <div style="background: linear-gradient(135deg, #ff6b6b, #ff4757, #ff3838); padding: 40px 20px; text-align: center;">
                        <span style="font-size: 40px;">🔐</span>
                        <h1 style="color: white; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">
                            ❤️🔥 AmiKuna 🔥❤️
                        </h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">
                            Recuperación de contraseña
                        </p>
                    </div>
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #ff4757; font-size: 28px; text-align: center;">
                            ¿Olvidaste tu contraseña? 💭
                        </h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6; text-align: center;">
                            ¡No te preocupes! Haz clic abajo para crear una nueva contraseña.
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.URL_FRONTEND}/recuperarpassword/${token}"
                               style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ff4757); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px;">
                                🔑 Restablecer mi contraseña 🔑
                            </a>
                        </div>
                        <div style="background: linear-gradient(135deg, #fff0f2, #fff8f9); padding: 20px; border-radius: 15px; border-left: 5px solid #ff6b6b; margin: 25px 0;">
                            <p style="color: #ff4757; font-size: 14px; text-align: center; margin: 0;">
                                <strong>🛡️ Este enlace es válido por 24 horas.</strong><br><br>
                                Si no solicitaste este cambio, ignora este correo.
                            </p>
                        </div>
                    </div>
                    <div style="background: linear-gradient(135deg, #ff8e8e, #ffa8a8); padding: 20px; text-align: center;">
                        <p style="color: #fff; font-size: 14px; margin: 0;">
                            Con amor y seguridad, el equipo de <strong>AmiKuna</strong> ❤️
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `
        })

        if (error) {
            console.error('Error al enviar email de recuperación:', error)
            throw new Error(error.message)
        }

        console.log('Email de recuperación enviado:', data.id)
    } catch (error) {
        console.error('Error en sendMailToRecoveryPassword:', error)
        throw error
    }
}

export {
    sendMailToRegister,
    sendMailToRecoveryPassword
}