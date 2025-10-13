const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

// Resolve short TikTok URLs (vm.tiktok.com, vt.tiktok.com, etc.)
async function resolveTikTokUrl(url) {
    try {
        const response = await axios.get(url, { maxRedirects: 0, validateStatus: null });
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            return response.headers.location;
        }
    } catch (e) {
        console.error("URL resolution failed:", e.message);
    }
    return url; // fallback to original if resolution fails
}

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) {
            return;
        }

        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        // ✅ Step 1: Check direct message text (command args)
        const directText = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = directText.trim().split(" ").slice(1).join(" "); // remove command itself
        let url = args.trim();

        // ✅ Step 2: If no args, check quoted/replied message
        if (!url) {
            const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedText =
                quotedMessage?.conversation ||
                quotedMessage?.extendedTextMessage?.text ||
                quotedMessage?.imageMessage?.caption ||
                quotedMessage?.videoMessage?.caption ||
                "";

            url = quotedText.trim();
        }

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Por favor, proporcione un link de TikTok para el vídeo."
            });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Ese no es un link válido de TikTok. Por favor, proporcione un link válido a un vídeo de TikTok."
            });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        try {
            // ✅ Resolve short TikTok URLs before API call
            let finalUrl = await resolveTikTokUrl(url);

            // Use API for download
            const apiUrl = `https://adiza-tiktok-downloader.matrixzat99.workers.dev/?url=${encodeURIComponent(finalUrl)}`;
            const apiResponse = await axios.get(apiUrl);
            
            if (apiResponse.data && apiResponse.data.success && apiResponse.data.download) {
                const videoUrl = apiResponse.data.download.video_hd || apiResponse.data.download.video_sd;
                const caption = `〽️ Descargado por *Shimba*\n\n*Title:* ${apiResponse.data.tiktok_info.title || 'N/A'}\n*Author:* ${apiResponse.data.tiktok_info.author || 'N/A'}\n\n🔗 ${finalUrl}`;

                if (videoUrl) {
                    await sock.sendMessage(chatId, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption
                    }, { quoted: message });

                    await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
                    return;
                }
            }

            await sock.sendMessage(chatId, { 
                text: "No se ha podido descargar el vídeo de TikTok. Inténtalo de nuevo con otro enlace."
            });

        } catch (error) {
            console.error('Error in TikTok download:', error);
            await sock.sendMessage(chatId, { 
                text: "No se ha podido descargar el vídeo de TikTok. Se ha producido un error."
            });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { 
            text: "Se ha producido un error al procesar la solicitud. Inténtalo de nuevo más tarde."
        });
    }
}

module.exports = tiktokCommand;
