import { Handler, Context, Callback, APIGatewayEvent } from 'aws-lambda'
import Stripe from 'stripe'

const {STRIPE_SECRET_KEY, SUCCESS_URL, CANCEL_URL, CURRENCY, STRIPE_MONTHLY_PLAN_ID} = process.env

const stripe = new Stripe(STRIPE_SECRET_KEY)

const DEFAULT_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Access-Control-Allow-Headers, X-Requested-With"
}

type Interval = "once" | "monthly"

interface DonationRequest {
    name: string,
    hide: boolean,
    amount: number,
    interval: Interval
}

stripe.setApiVersion('2019-02-11; checkout_sessions_beta=v4')

async function createSession(donation: DonationRequest) {
    if (donation.amount == null) throw { status: 400, message: "Please specify an amount" }
    if (donation.interval !== "monthly" && donation.interval !== "once") throw { status: 400, message: "Please specify an interval" }

    const { name, hide, interval } = donation;
    const amount = Math.floor(donation.amount)

    if (amount < 50 || amount > 10000000) {
        throw { status: 400, message: "You can only donate between $0.50 and $100,000 USD" }
    }

    const metadata = { name, hide }

    const options: any = {
        success_url: SUCCESS_URL,
        cancel_url: CANCEL_URL,
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
            name: "One-off donation",
            quantity: 1
        }]
        options.payment_intent_data = {
            metadata: metadata
        }
    }

    try {
        return await stripe.checkout.sessions.create(options)
    } catch (error) {
        throw { message: `Error from our payments processor: ${error.message}` }
    }
}

const handler: Handler = async (event: APIGatewayEvent, context: Context, callback: Callback) => {
    if (event.httpMethod === "POST") {
        const data: DonationRequest = JSON.parse(event.body)
        try {
            const session = await createSession(data)
            callback(null, {
                headers: DEFAULT_HEADERS,
                statusCode: 200,
                body: JSON.stringify(session)
            })
            return
        } catch (error) {
            callback(null, {
                headers: DEFAULT_HEADERS,
                statusCode: +error.status || 500,
                body: JSON.stringify({ message: error.message })
            })
            return
        }
    }

    // Handle OPTIONS method
    callback(null, {
        headers: DEFAULT_HEADERS,
        statusCode: 200
    })
};

export { handler }