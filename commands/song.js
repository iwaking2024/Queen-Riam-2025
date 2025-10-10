const yts = require('yt-search');
const axios = require('axios');

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            await sock.sendMessage(chatId, { 
                text: "❌ Por favor proporcione un nombre de canción!\nEjemplo: `.play Lilly Alan Walker`"
            }, { quoted: message });

            // React ❌ when no query
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key }});
            return;
        }

        // React 🔎 while searching
        await sock.sendMessage(chatId, { react: { text: "🔎", key: message.key }});

        // Search YouTube
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await sock.sendMessage(chatId, { 
                text: "⚠️ No se encontraron resultados para su consulta!"
            }, { quoted: message });

            // React ⚠️ when no results
            await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key }});
            return;
        }

        // Use first video
        const video = videos[0];
        const videoUrl = video.url;

        // Send video info before download
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 *${video.title}*\n\n Descargando... 🎶\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ shimba`
        }, { quoted: message });

        // React ⏳ while downloading
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key }});

        // Call the new API with ?url= style
        const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data?.status) {
            await sock.sendMessage(chatId, {
                text: "🚫 No se pudo obtener la información del nuevo punto final. Inténtelo más tarde."
            }, { quoted: message });

            // React 🚫 if API fails
            await sock.sendMessage(chatId, { react: { text: "🚫", key: message.key }});
            return;
        }

        const audioUrl = data.audio;
        const title = data.title || video.title;

        if (!audioUrl) {
            await sock.sendMessage(chatId, {
                text: "🚫 No hay URL de audio en la respuesta. No se puede enviar el audio."
            }, { quoted: message });

            // React ❌ if audio not found
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key }});
            return;
        }

        // Send the audio file
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

        // React ✅ on success
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key }});

    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, {
            text: "❌ Descarga fallida. Inténtalo de nuevo más tarde."
        }, { quoted: message });

        // React ❌ on error
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key }});
    }
}

module.exports = songCommand;
