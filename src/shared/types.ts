export type Interval = "once" | "monthly"

export interface DonationRequest {
    name: string,
    showOnList: boolean,
    amount: number,
    interval: Interval,
    successUrl: string,
    cancelUrl: string,
    captchaToken: string
}

export interface StripeMetadata {
    name: string,
    showOnList: boolean
}
