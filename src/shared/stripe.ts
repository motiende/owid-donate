import Stripe from 'stripe'

export { Stripe }

const { STRIPE_SECRET_KEY } = process.env

if (!STRIPE_SECRET_KEY) {
    throw new Error("Please set the STRIPE_SECRET_KEY environment variable")
}

const STRIPE_API_VERSION = "2019-05-16"

export const stripe = new Stripe(STRIPE_SECRET_KEY)

stripe.setApiVersion(STRIPE_API_VERSION)
