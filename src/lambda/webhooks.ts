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

async function sendThankYouEmail(options: EmailOptions) {
    try {
        await sendMail({
            from: `Our World in Data <donate@ourworldindata.org>`,
            to: options.email,
            subject: "Thank you",
            text: `Thanks m8\n\n${JSON.stringify(options)}`
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
    return object && object.metadata
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
