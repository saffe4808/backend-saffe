/**
 * Servicio para envío de correos utilizando la API REST de Resend
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Sistema Facial <onboarding@resend.dev>";

export const enviarCodigoResend = async ({ email, codigo, nombre = "Usuario" }) => {
    const apiKey = (process.env.RESEND_API_KEY || "").trim();

    if (!apiKey) {
        throw new Error("RESEND_API_KEY no está configurada en el servidor.");
    }

    const remitente = (process.env.RESEND_FROM || DEFAULT_FROM).trim();
    const destinatario = email.trim();

    const plantillaHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <!-- Header institucional -->
            <tr>
                <td style="background-color: #1b2e1e; padding: 25px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 2px;">SAFFE</h1>
                    <p style="margin: 5px 0 0 0; color: #a3c2a8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Sistema de Control de Acceso - Ejército Nacional</p>
                </td>
            </tr>
            <!-- Contenido principal -->
            <tr>
                <td style="padding: 35px 30px;">
                    <h2 style="margin-top: 0; color: #1e293b; font-size: 20px;">Recuperación de Contraseña</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                        Hola <strong>${nombre}</strong>, hemos recibido una solicitud para restablecer la contraseña de tu cuenta en el sistema SAFFE.
                    </p>
                    <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                        Usa el siguiente código de verificación de 6 dígitos para continuar:
                    </p>
                    
                    <!-- Caja del código OTP -->
                    <div style="margin: 30px 0; text-align: center;">
                        <span style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #059669; border-radius: 8px; padding: 15px 30px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #065f46; font-family: monospace;">
                            ${codigo}
                        </span>
                    </div>

                    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                        ⏱️ Este código expirará en <strong>15 minutos</strong>.
                    </p>
                    <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                        Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña actual permanecerá segura.
                    </p>
                </td>
            </tr>
            <!-- Footer -->
            <tr>
                <td style="background-color: #f8fafc; padding: 15px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                        © ${new Date().getFullYear()} SAFFE - Seguridad y Control de Acceso.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    const respuesta = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: remitente,
            to: [destinatario],
            subject: "Código de recuperación de contraseña - SAFFE",
            html: plantillaHtml
        })
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
        console.error("Resend API error:", data);
        const mensajeError = data.message || (data.errors && data.errors[0]?.message) || "Error al enviar el correo a través de Resend.";
        throw new Error(mensajeError);
    }

    return data;
};
