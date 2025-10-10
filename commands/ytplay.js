const axios = require("axios");
const yts = require("yt-search");

async function ytplayCommand(sock, chatId, query, message) {
    if (!query) {
        return await sock.sendMessage(chatId, {
            text: "⚠️ Proporcione un enlace de YouTube o una consulta de búsqueda..\n\nEjemplo:\n```.ytplay another love```"
        });
    }

    try {
        let videoUrl = query;

        // Step 1: React while searching
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

        if (!query.includes("youtube.com") && !query.includes("youtu.be")) {
            const search = await yts(query);
            if (!search.videos || search.videos.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ No se encontraron resultados para: ${query}` });
            }
            videoUrl = search.videos[0].url;
        }

        // Step 2: React while fetching link
        await sock.sendMessage(chatId, { react: { text: "📥", key: message.key } });

        const apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });
        const data = response.data?.result;

        if (!data || !data.download_url) {
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { text: "❌ No se pudo obtener el audio. Prueba con otro link." });
        }

        // Step 3: React while sending audio
        await sock.sendMessage(chatId, { react: { text: "🎶", key: message.key } });

        await sock.sendMessage(chatId, {
            audio: { url: data.download_url },
            mimetype: "audio/mpeg",
            ptt: false,
            fileName: `${data.title || "yt-audio"}.mp3`,
            contextInfo: {
                externalAdReply: {
                    title: data.title || "YouTube Audio",
                    body: "🎶 Powered by YTPlay",
                    thumbnailUrl: data.thumbnail,
                    sourceUrl: videoUrl,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });

        // Final ✅ reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error("YTPlay Error:", error.message);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { text: "❌ Se produjo un error al procesar su solicitud." });
    }
}

module.exports = { ytplayCommand };
