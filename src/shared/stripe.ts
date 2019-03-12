import Stripe from 'stripe'

export { Stripe }

const { STRIPE_SECRET_KEY } = process.env

if (!STRIPE_SECRET_KEY) {
    throw new Error("Please set the STRIPE_SECRET_KEY environment variable")
}

export const STRIPE_API_VERSION = "2019-02-19"
export const stripe = new Stripe(STRIPE_SECRET_KEY)

stripe.setApiVersion(STRIPE_API_VERSION)
