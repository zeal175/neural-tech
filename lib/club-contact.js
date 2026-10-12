const WHATSAPP_NUMBER = "919150401402";
const WHATSAPP_TEXT = "Hi, I’m interested in Neural Tech.";

export function whatsappUrl(text = WHATSAPP_TEXT) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const WHATSAPP_URL = whatsappUrl();
