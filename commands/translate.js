const fetch = require('node-fetch');

const languageCodes = {
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi"
};

module.exports = async function translateCommand(sock, chatId, message, match) {
    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        let textToTranslate = '';
        let lang = '';

        // Case 1: If it's a reply
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            textToTranslate =
                quotedMessage.conversation ||
                quotedMessage.extendedTextMessage?.text ||
                quotedMessage.imageMessage?.caption ||
                quotedMessage.videoMessage?.caption ||
                '';

            lang = match.trim();
        } 
        // Case 2: Direct input
        else {
            const args = match.trim().split(' ');
            if (args.length < 2) {
                const available = Object.entries(languageCodes)
                    .map(([code, name]) => `▫️ ${code} = ${name}`)
                    .join("\n");

                return sock.sendMessage(chatId, {
                    text: `*TRANSLATOR*\n\nUsage:\n1. Responder a un mensaje con: .translate <lang>\n2. O escriba: .translate <text> <lang>\n\nEjemplo:\n.translate Hola fr\n.trt Hola es\n\n📋 Códigos disponibles:\n${available}`,
                    quoted: message
                });
            }

            lang = args.pop(); // last word is language code
            textToTranslate = args.join(' '); // rest is text
        }

        if (!textToTranslate) {
            return sock.sendMessage(chatId, {
                text: '❌ No se ha encontrado ningún texto para traducir. Por favor, introduzca texto o responda a un mensaje.',
                quoted: message
            });
        }

        // Try multiple translation APIs
        let translatedText = null;

        // API 1 - Google Translate
        try {
            const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(textToTranslate)}`);
            if (res.ok) {
                const data = await res.json();
                if (data?.[0]?.[0]?.[0]) translatedText = data[0][0][0];
            }
        } catch {}

        // API 2 - MyMemory
        if (!translatedText) {
            try {
                const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${lang}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.responseData?.translatedText) translatedText = data.responseData.translatedText;
                }
            } catch {}
        }

        // API 3 - Backup API
        if (!translatedText) {
            try {
                const res = await fetch(`https://api.dreaded.site/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${lang}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.translated) translatedText = data.translated;
                }
            } catch {}
        }

        if (!translatedText) {
            throw new Error('All translation APIs failed');
        }

        // Send translation result
        await sock.sendMessage(chatId, {
            text: `🌐 *Traducido (${lang})*\n\n${translatedText}`,
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in translate command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ No se ha podido traducir el texto. Inténtalo de nuevo más tarde.\n\nUsage:\n1. Responder a un mensaje con: .translate <lang>\n2. O escriba: .translate <text> <lang>',
            quoted: message
        });
    }
};
