import * as nodemailer from 'nodemailer'

const {EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD} = process.env

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT ? parseInt(EMAIL_PORT) : 587,
    requireTLS: true,
    auth: {
        user: EMAIL_HOST_USER,
        pass: EMAIL_HOST_PASSWORD
    }
})

export async function sendMail(options: nodemailer.SendMailOptions): Promise<any> {
    return new Promise((resolve, reject) => {
        transporter.sendMail(options, (err, info) => {
            if (err) return reject(err)
            else resolve(info)
        })
    })
}
