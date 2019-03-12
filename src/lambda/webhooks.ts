import { Handler, Context, Callback, APIGatewayEvent } from 'aws-lambda'

import { stripe, Stripe } from '../shared/stripe'
import { sendMail } from '../shared/email'
import { StripeMetadata } from '../shared/types'

const { STRIPE_WEBHOOK_SECRET } = process.env

interface EmailOptions {
    email: string,
    name: string,
    showOnList: boolean,
    isMonthly: boolean
}

function constructMessage(options: EmailOptions): string {
    console.log("constructMessage", options)
    return [
        `Dear ${options.name ? options.name : "Sir/Madam"},`,
        "Thank you for your donation to support Global Change Data Lab – the non-profit organization that helps produce the website Our World in Data.",
        options.isMonthly && "You will receive monthly receipts of your payment. If you wish to cancel your recurring donation at any point, just email us at donate@ourworldindata.org.",
        "Your generosity offers vital support in expanding our efforts to build an independent and free online publication on global development. Your donation will support the expansion of the online publication in close collaboration with our research colleagues at the University of Oxford and around the world.",
        "Given your interest in our work, we hope you will continue to follow our progress via our newsletter – if you have not done so, we’d like to invite you to join: https://OurWorldInData.org/subscribe.",
        `Reader donations are essential to our work, providing us with the stability and independence we need, so we can focus on research and the development of our site. ${options.showOnList ? "In recognition of your support we will be delighted to include your name as part of our List of Supporters: OurWorldInData.org/supporters. We will add your name the next time we update the list and the sum of your donation will not be disclosed." : ""}`,
        "Thank you again for your support for Our World in Data, we look forward to taking the project to the next level and we hope that you will remain interested in our work.",
        "Kind regards,\nThe Our World in Data Team"
    ].filter(Boolean)
    .join("\n\n")
}

async function sendThankYouEmail(options: EmailOptions): Promise<void> {
    try {
        await sendMail({
            from: `Our World in Data <donate@ourworldindata.org>`,
            to: options.name ? `${options.name} <${options.email}>` : options.email,
            subject: "Thank you",
            text: constructMessage(options)
        })
        console.log("Message sent")
    } catch (error) {
        console.error(error)
    }
}

function hasMetadata(object: any) {
    return object && object.metadata && object.metadata.hasOwnProperty('showOnList')
}

function getMetadata(object: any): StripeMetadata {
    const metadata = (object && object.metadata) || {}
    return {
        name: metadata.name,
        showOnList: metadata.name && (metadata.showOnList === "true" || metadata.showOnList === true)
    }
}

const handler: Handler = async (event: APIGatewayEvent, context: Context, callback: Callback) => {
    if (event.httpMethod === "POST") {
        let stripeEvent: Stripe.events.IEvent

        try {
            stripeEvent = stripe.webhooks.constructEvent(event.body, event.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            return {
                statusCode: 400,
                body: "Invalid signature"
            }
        }

        if (stripeEvent.type === "charge.succeeded") {
            const charge: Stripe.charges.ICharge = stripeEvent.data.object as Stripe.charges.ICharge
            // if a charge has an invoice, it is the 2nd+ payment in a subscription
            if (!charge.invoice && hasMetadata(charge)) {
                const metadata = getMetadata(charge)
                const customer = await stripe.customers.retrieve(charge.customer as string)
                await sendThankYouEmail({
                    email: customer.email,
                    isMonthly: false,
                    name: metadata.name,
                    showOnList: metadata.showOnList
                })
            }
        } else if (stripeEvent.type === "customer.subscription.created") {
            const subscription: Stripe.subscriptions.ISubscription = stripeEvent.data.object as Stripe.subscriptions.ISubscription
            if (hasMetadata(subscription)) {
                const metadata = getMetadata(subscription)
                const customer = await stripe.customers.retrieve(subscription.customer as string)
                await sendThankYouEmail({
                    email: customer.email,
                    isMonthly: true,
                    name: metadata.name,
                    showOnList: metadata.showOnList
                })
            }
        }
    }

    return {
        statusCode: 200,
        body: "success"
    }
};

export { handler }
