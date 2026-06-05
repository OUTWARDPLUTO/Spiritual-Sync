// razorpay.js — Razorpay payment integration for Spiritual Sync
require('dotenv').config();
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Subscription plan details
const PLANS = {
  trial: {
    name: 'Free Trial',
    price: 0,
    days: parseInt(process.env.PRICE_TRIAL_DAYS) || 7,
    description: '7-day free trial — Access to all scriptures',
  },
  monthly_all: {
    name: 'All-Scriptures Monthly',
    price: parseInt(process.env.PRICE_MONTHLY_ALL) || 9900, // in paise (₹99)
    days: 30,
    description: '₹99/month — Access Gita, Ramayan & Upanishads (rotating)',
  },
  yearly_all: {
    name: 'All-Scriptures Annual',
    price: parseInt(process.env.PRICE_YEARLY_ALL) || 79900, // in paise (₹799)
    days: 365,
    description: '₹799/year — Access all scriptures (Save ~33%)',
  },
  monthly_individual: {
    name: 'Single-Scripture Monthly',
    price: parseInt(process.env.PRICE_MONTHLY_INDIVIDUAL) || 4900, // in paise (₹49)
    days: 30,
    description: '₹49/month — Access to one specific scripture of your choice',
  },
  yearly_individual: {
    name: 'Single-Scripture Annual',
    price: parseInt(process.env.PRICE_YEARLY_INDIVIDUAL) || 39900, // in paise (₹399)
    days: 365,
    description: '₹399/year — Access to one specific scripture (Save ~33%)',
  },
};

/**
 * Create a Razorpay order for a given plan
 */
async function createOrder(plan, subscriberEmail, subscriberName) {
  if (!PLANS[plan]) throw new Error('Invalid plan: ' + plan);

  const planDetails = PLANS[plan];

  // Free trial — no payment needed
  if (planDetails.price === 0) {
    return { isFree: true, plan: planDetails };
  }

  const order = await razorpay.orders.create({
    amount: planDetails.price,
    currency: 'INR',
    receipt: `sync_${Date.now()}`,
    notes: {
      subscriber_email: subscriberEmail,
      subscriber_name: subscriberName,
      plan: plan,
    },
  });

  return { isFree: false, order, plan: planDetails };
}

/**
 * Verify Razorpay payment signature
 */
function verifyPayment(orderId, paymentId, signature) {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Calculate paid_until date from plan
 */
function calculatePaidUntil(plan) {
  const days = PLANS[plan]?.days || 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

module.exports = { createOrder, verifyPayment, calculatePaidUntil, PLANS, razorpay };
