import { URLSearchParams } from 'url'
import { Handler, Context, APIGatewayEvent } from 'aws-lambda'
import fetch from 'node-fetch'
import Stripe from 'stripe'

const {STRIPE_SECRET_KEY, RECAPTCHA_SECRET_KEY, CURRENCY, STRIPE_MONTHLY_PLAN_ID} = process.env

const stripe = new Stripe(STRIPE_SECRET_KEY)

const STRIPE_API_VERSION = "2019-02-19"

stripe.setApiVersion(STRIPE_API_VERSION)

const DEFAULT_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Access-Control-Allow-Headers, X-Requested-With"
}

type Interval = "once" | "monthly"

interface DonationRequest {
    name: string,
    showOnList: boolean,
    amount: number,
    interval: Interval,
    successUrl: string,
    cancelUrl: string,
    captchaToken: string
}

async function createSession(donation: DonationRequest) {
    if (donation.amount == null) throw { status: 400, message: "Please specify an amount" }
    if (donation.interval !== "monthly" && donation.interval !== "once") throw { status: 400, message: "Please specify an interval" }
    if (donation.successUrl == null || donation.cancelUrl == null) throw { status: 400, message: "Please specify a successUrl and cancelUrl" }

    const { name, showOnList, interval, successUrl, cancelUrl } = donation;
    const amount = Math.floor(donation.amount)

    if (amount < 100 || amount > 10000000) {
        throw { status: 400, message: "You can only donate between $1 and $100,000 USD" }
    }

    const metadata = { name, showOnList }

    const options: any = {
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ["card"]
    }

    if (interval === "monthly") {
        options.subscription_data = {
            items: [{
                plan: STRIPE_MONTHLY_PLAN_ID,
                quantity: amount
            }],
            metadata: metadata
        }
    } else if (interval === "once") {
        options.line_items = [{
            amount: amount,
            currency: CURRENCY,
            name: "One-time donation",
            quantity: 1
        }]
        options.payment_intent_data = {
            metadata: metadata
        }
    }

    try {
        return await stripe.checkout.sessions.create(options, { stripe_version: `${STRIPE_API_VERSION}; checkout_sessions_beta=v1` })
    } catch (error) {
        throw { message: `Error from our payments processor: ${error.message}` }
    }
}

async function validCaptcha(token: string) {
    const body = new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token
    })
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "post",
        body: body
    })
    const json = await response.json()
    return json.success
}

const handler: Handler = async (event: APIGatewayEvent, context: Context) => {
    if (event.httpMethod === "POST") {
        try {
            const data: DonationRequest = JSON.parse(event.body)
            if (!await validCaptcha(data.captchaToken)) {
                throw { status: 400, message: "The CAPTCHA challenge failed, please try submitting the form again." }
            }
            const session = await createSession(data)
            return {
                headers: DEFAULT_HEADERS,
                statusCode: 200,
                body: JSON.stringify(session)
            }
        } catch (error) {
            console.error(error)
            return {
                headers: DEFAULT_HEADERS,
                statusCode: +error.status || 500,
                body: JSON.stringify({ message: "An unexpected error occurred. " + (error && error.message) })
            }
        }
    }

    // Handle OPTIONS method
    return {
        headers: DEFAULT_HEADERS,
        statusCode: 200
    }
};

export { handler }
