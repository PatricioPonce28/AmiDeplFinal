import nodemailer from "nodemailer"
import dotenv from 'dotenv'
dotenv.config()


let transporter = nodemailer.createTransport({
    host:'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASSWORD  
    },
    tls: {
        rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
});

const sendMailToRegister = (userMail, token) => {     
    let mailOptions = {        
        from: 'admin@epn.edu.ec',        
        to: userMail,        
        subject: " ❤️🔥 AmiKuna 🔥 ❤️",        
        html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bienvenido a AmiKuna</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #ff6b6b, #ff8e8e, #ffa8a8, #white);">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);">
                
                <!-- Header con gradiente romántico -->
                <div style="background: linear-gradient(135deg, #ff6b6b, #ff4757, #ff3838); padding: 40px 20px; text-align: center; position: relative;">
                    <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 40px;">❤️</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                        🔥 AmiKuna 🔥
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 18px;">
                        ¡Conoce y comparte con la comunidad!
                    </p>
                </div>
                
                <!-- Contenido principal -->
                <div style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: #ff4757; font-size: 28px; margin: 0 0 15px 0; font-weight: bold;">
                            ¡Bienvenido a nuestra comunidad! 💕
                        </h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                            Estás a un paso de encontrar conexiones increíbles. Solo necesitas confirmar tu cuenta para comenzar tu aventura .
                        </p>
                    </div>
                    
                    <!-- Botón de confirmación -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.URL_FRONTEND}/confirmar/${token}" 
                           style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ff4757); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; box-shadow: 0 8px 20px rgba(255, 71, 87, 0.4); transition: all 0.3s ease; border: 3px solid transparent;">
                            ✨ Confirmar mi cuenta ✨
                        </a>
                    </div>
                    
                    <!-- Decoración con corazones -->
                    <div style="text-align: center; margin: 30px 0; font-size: 24px; opacity: 0.6;">
                        💖 💝 💕 💘 💗
                    </div>
                    
                    <!-- Mensaje de bienvenida -->
                    <div style="background: linear-gradient(135deg, #ffe0e6, #fff5f7); padding: 25px; border-radius: 15px; border-left: 5px solid #ff6b6b; margin: 20px 0;">
                        <p style="color: #ff4757; font-size: 16px; line-height: 1.6; margin: 0; text-align: center; font-weight: 500;">
                            <strong>El equipo de AmiKuna</strong> te da la más cordial bienvenida a esta increíble aventura del amor. 
                            <br><br>
                            💕 ¡Prepárate para conocer personas extraordinarias! 💕
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background: linear-gradient(135deg, #ff8e8e, #ffa8a8); padding: 20px; text-align: center;">
                    <p style="color: #fff; font-size: 14px; margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);">
                        Con amor, el equipo de <strong>AmiKuna</strong> ❤️
                    </p>
                    <div style="margin-top: 10px; font-size: 20px;">
                        💌 💕 💖 💕 💌
                    </div>
                </div>
            </div>
        </body>
        </html>
        `    
    }     
    
    transporter.sendMail(mailOptions, function(error, info){        
        if (error) {            
            console.log(error);        
        } else {            
            console.log("Mensaje enviado satisfactoriamente: ", info.messageId);        
        }    
    }) 
} 

const sendMailToRecoveryPassword = async(userMail,token)=>{    
    let info = await transporter.sendMail({    
        from: 'admin@epn.edu.ec',    
        to: userMail,    
        subject: "Reestablecer contraseña - AmiKuna ❤️",    
        html: `    
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recuperar Contraseña - AmiKuna</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #ff9999, #ffb3b3, #ffcccc, #white);">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ff6b6b, #ff4757, #ff3838); padding: 40px 20px; text-align: center; position: relative;">
                    <div style="background: rgba(255, 255, 255, 0.15); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 40px;">🔐</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                        ❤️🔥 AmiKuna 🔥❤️
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 18px;">
                        Recuperación de contraseña
                    </p>
                </div>
                
                <!-- Contenido principal -->
                <div style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: #ff4757; font-size: 28px; margin: 0 0 15px 0; font-weight: bold;">
                            ¿Olvidaste tu contraseña? 💭
                        </h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                            ¡No te preocupes! Estas cosas pasan. Haz clic en el botón de abajo para crear una nueva contraseña y seguir conectando con personas especiales.
                        </p>
                    </div>
                    
                    <!-- Icono de seguridad -->
                    <div style="text-align: center; margin: 20px 0; font-size: 48px; opacity: 0.7;">
                        🔒💕
                    </div>
                    
                    <!-- Botón de recuperación -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.URL_FRONTEND}/recuperarpassword/${token}"
                                  style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ff4757); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; box-shadow: 0 8px 20px rgba(255, 71, 87, 0.4); transition: all 0.3s ease; border: 3px solid transparent;">
                            🔑 Restablecer mi contraseña 🔑
                        </a>
                    </div>
                    
                    <!-- Información de seguridad -->
                    <div style="background: linear-gradient(135deg, #fff0f2, #fff8f9); padding: 20px; border-radius: 15px; border-left: 5px solid #ff6b6b; margin: 25px 0;">
                        <p style="color: #ff4757; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
                            <strong>🛡️ Información de seguridad:</strong>
                            <br><br>
                            Este enlace es válido por 24 horas por tu seguridad. Si no solicitaste este cambio, puedes ignorar este correo.
                        </p>
                    </div>
                    
                    <!-- Decoración -->
                    <div style="text-align: center; margin: 30px 0; font-size: 24px; opacity: 0.6;">
                        🔐 💝 🔑 💕 🔐
                    </div>
                    
                    <!-- Mensaje del equipo -->
                    <div style="background: linear-gradient(135deg, #ffe0e6, #fff5f7); padding: 25px; border-radius: 15px; border-left: 5px solid #ff6b6b; margin: 20px 0;">
                        <p style="color: #ff4757; font-size: 16px; line-height: 1.6; margin: 0; text-align: center; font-weight: 500;">
                            <strong>El equipo de AmiKuna</strong> está aquí para ayudarte siempre.
                            <br><br>
                            💕 ¡Tu seguridad es nuestra prioridad! 💕
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background: linear-gradient(135deg, #ff8e8e, #ffa8a8); padding: 20px; text-align: center;">
                    <p style="color: #fff; font-size: 14px; margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);">
                        Con amor y seguridad, el equipo de <strong>AmiKuna</strong> ❤️
                    </p>
                    <div style="margin-top: 10px; font-size: 20px;">
                        🔐 💌 💕 💌 🔐
                    </div>
                </div>
            </div>
        </body>
        </html>
        `    
    });    
    
    console.log("Mensaje enviado satisfactoriamente: ", info.messageId);
}

export {
    sendMailToRegister,
    sendMailToRecoveryPassword,
}