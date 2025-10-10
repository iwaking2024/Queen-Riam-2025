const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```¡Sólo para administradores de grupo!```' });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(prefix.length + 8).toLowerCase().trim().split(' ');
        const action = args[0];
        const status = args[1];

        const usage = `\`\`\`ANTILINK SETUP\n\nUsage:\n${prefix}antilink\n(to see current status)\n${prefix}antilink [kick|delete|warn] on\n${prefix}antilink [kick|delete|warn] off\n\`\`\``;

        if (!action) {
            const currentConfig = await getAntilink(chatId, 'on');
            const currentStatus = currentConfig && currentConfig.enabled ? 'ON' : 'OFF';
            const currentAction = currentConfig && currentConfig.action ? currentConfig.action : 'delete (default)';

            await sock.sendMessage(chatId, {
                text: `*_Antilink Configuration:_*` +
                    `\nStatus: *${currentStatus}*` +
                    `\nAction: *${currentAction}*\n\n` +
                    usage
            });
            return;
        }

        const validActions = ['kick', 'delete', 'warn'];
        if (!validActions.includes(action)) {
            await sock.sendMessage(chatId, { text: `*_Acción no válida. Utilice expulsar, eliminar o advertir._*` });
            return;
        }

        if (status === 'on') {
            const result = await setAntilink(chatId, 'on', action);
            if (result) {
                await sock.sendMessage(chatId, {
                    text: `*_Antilink se ha activado con la acción establecida en ${action}_*`
                });
            } else {
                await sock.sendMessage(chatId, {
                    text: '*_No se pudo activar Antilink_*'
                });
            }
        } else if (status === 'off') {
            await removeAntilink(chatId, 'on');
            await sock.sendMessage(chatId, { text: '*_Antilink ha sido desactivado*' });
        } else {
            await sock.sendMessage(chatId, { text: usage });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '*_Error al procesar el comando antilink_*' });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkSetting = await getAntilink(chatId, 'on');
    if (!antilinkSetting || !antilinkSetting.enabled) {
        return false; // No antilink enabled for this group
    }

    const action = antilinkSetting.action || 'delete'; // Default to delete if not set

    const linkPatterns = {
        whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
        whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
        telegram: /t\.me\/[A-Za-z0-9_]+/,
        allLinks: /https?:\/\/[^\s]+/,
    };

    let isLinkDetected = false;
    if (linkPatterns.allLinks.test(userMessage)) {
        isLinkDetected = true;
    }

    if (isLinkDetected) {
        console.log(`¡Se detectó un enlace! Acción: ${action}`);

        const mentionedJidList = [senderId];
        await sock.sendMessage(chatId, {
            text: `⚠️ Warning! @${senderId.split('@')[0]}, No se permite publicar enlaces.`,
            mentions: mentionedJidList
        });

        // The bot needs to be an admin to perform any action.
        const { isBotAdmin } = await isAdmin(sock, chatId, sock.user.id);
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: 'Necesito ser administrador para aplicar las reglas antienlace.' });
            return true;
        }

        switch (action) {
            case 'delete':
                try {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: message.key.id,
                            participant: senderId
                        }
                    });
                    console.log(`Message with ID ${message.key.id} Eliminado exitosamente.`);
                } catch (error) {
                    console.error('Failed to delete message:', error);
                }
                break;
            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    await sock.sendMessage(chatId, { text: `User @${senderId.split('@')[0]} Fue expulsado por publicar un enlace.`, mentions: mentionedJidList });
                    console.log(`User ${senderId} kicked successfully.`);
                } catch (error) {
                    console.error('Failed to kick user:', error);
                    await sock.sendMessage(chatId, { text: `Failed to kick @${senderId.split('@')[0]}. Es posible que no tenga los permisos necesarios.`, mentions: mentionedJidList });
                }
                break;
            case 'warn':
                await sock.sendMessage(chatId, { text: `@${senderId.split('@')[0]} Ha sido advertido por publicar un enlace.`, mentions: mentionedJidList });
                console.log(`User ${senderId} warned.`);
                break;
        }
        return true; // A link was detected and handled
    } else {
        console.log('No link detected.');
        return false; // No link was detected
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};
