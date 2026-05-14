// js/data/inquiries.js

export const CHAT_CUSTOMERS = [
  { id: "cute_1" },
  { id: "cute_2" },
  { id: "cute_3" },
  { id: "cute_4" },
  { id: "cute_5" }
];

export const INQUIRY_LIBRARY = [
  {
    prompt: "Hi bestie, is {product} actually good or am I getting scammed?",
    acceptableKeywords: ["yes", "good", "quality", "popular", "real", "worth"]
  },
  {
    prompt: "Can I get {product} for {cheapPrice} coins? I am on a budget.",
    acceptableKeywords: ["price", "discount", "cheap", "deal", "coins", "yes", "budget"]
  },
  {
    prompt: "If I buy 1 {product} can you give me a discount pretty please?",
  acceptableKeywords: ["discount", "deal", "price", "yes", "coupons", "maybe"]
  },
  {
    prompt: "Be honest, would I look good with this {product}?",
    acceptableKeywords: ["yes", "pretty", "suits", "good", "popular", "looks", "style", "nice"]
  },
  {
    prompt: "Does {product} look expensive? I want to give rich boss energy.",
    acceptableKeywords: ["expensive", "price", "looks", "quality", "affordable", "yes"]
  },
  {
    prompt: "If I buy {product}, will my friends think I have taste?",
    acceptableKeywords: ["yes", "taste", "friends", "stylish", "good"]
  },
  {
    prompt: "I feel like {product} might change my life… is it worth it?",
  acceptableKeywords: ["yes", "will", "good", "worth", "life-changing"]
  },
  {
    prompt: "Why is {product} {price} coins? Can you convince me to buy?",
    acceptableKeywords: ["quality", "price", "worth", "popular", "good"]
  },
  {
    prompt: "How long does {product} last before it dies on me?",
  acceptableKeywords: ["durable", "long", "quality", "long-lasting", "strong"]
  },
  {
    prompt: "My brain says no but my heart says buy your {product}… what do you say?",
  acceptableKeywords: ["yes", "buy", "good", "heart"]
  }
];