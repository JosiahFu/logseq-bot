import 'dotenv/config';
import {
    Client,
    Events,
    IntentsBitField,
    REST,
    Routes,
    SlashCommandBuilder,
    ActivityType,
    GatewayIntentBits,
    PartialMessage,
    Message,
    TextChannel,
    Partials,
} from 'discord.js'
import os from 'os'
import path from 'path'
import fs from 'fs'

const { BOT_TOKEN, APPLICATION_ID, LOGSEQ_DIRECTORY, OUTPUT_CHANNEL_ID } = process.env;

const DELETE_DELAY = 15 * 1000

let outputChannel: TextChannel

const journalsDir = path.resolve(LOGSEQ_DIRECTORY.replace('~', os.homedir()), 'journals')

function currentJournal() {
    const today = new Date()
    return path.join(journalsDir, `${today.getFullYear().toString().padStart(4, '0')}_${(today.getMonth()+1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}.md`)
}

function discordToLogseq(text: string) {
    return text.split('\n').map(line => {
        const [_, indent, content] = line.match(/^( *(?:- )?)(.*)/) ?? ['', '', '']
        const indentWidth = Math.floor(indent.length / 2)
        const prefix = content.substring(0, 2) === '- ' ? '' : '- '
        return `\n${new Array(indentWidth).fill('\t').join('')}${prefix}${content}`
    }).join('')
}

async function sendTemporary(text: string) {
    const message = await outputChannel.send({
        content: text
    })
    setTimeout(() => message.delete(), DELETE_DELAY)
}

function addToJournal(text: string) {
    fs.writeFileSync(currentJournal(), text, {
        flag: 'a',
    })
}

function replaceInJournal(oldText: string, newText: string, actionForError = 'replace') {
    const current = currentJournal()
    const content = fs.readFileSync(current, 'utf-8')
    const newContent = content.replace(oldText, newText)
    console.log(content, newContent)
    if (content === newContent) {
        sendTemporary(`Could not find entry to ${actionForError}:\n>>> ${oldText.trim()}`)
    } else {
        fs.writeFileSync(current, newContent)
    }
}

function deleteInJournal(text: string) {
    replaceInJournal(text, '', 'delete')
}

function isValidMessage(message: Message<boolean> | PartialMessage) {
    if (message.channelId !== OUTPUT_CHANNEL_ID) return false
    if (message.author?.id === client.user?.id) return false

    const today = new Date()
    today.setHours(0)
    today.setMinutes(0)
    today.setSeconds(0)
    today.setMilliseconds(0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return today < message.createdAt && message.createdAt < tomorrow
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, ], partials: [Partials.Message] });

const onExit = async () => {
    console.log('Stopping bot');
    await client.destroy();
};

client.once(Events.ClientReady, () => {
    console.log('Bot is online!');
    outputChannel = client.channels.cache.get(OUTPUT_CHANNEL_ID) as TextChannel

    process.on('SIGINT', onExit);
    process.on('SIGTERM', onExit);
});

client.on(Events.MessageCreate, message => {
    if (isValidMessage(message)) {
        addToJournal(discordToLogseq(message.content))
    }
})

client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (isValidMessage(newMessage) && oldMessage.content !== null && newMessage.content !== null) {
        replaceInJournal(discordToLogseq(oldMessage.content), discordToLogseq(newMessage.content))
    }
})

client.on(Events.MessageDelete, (message) => {
    if (isValidMessage(message) && message.content !== null) {
        deleteInJournal(discordToLogseq(message.content))
    }
})

const rest = new REST().setToken(BOT_TOKEN);

// await rest.put(
//     Routes.applicationCommands(APPLICATION_ID),
//     {
//         body: Object.entries(commands).map(([name, {description, options}]) => {
//             const command = new SlashCommandBuilder()
//                 .setName(name)
//                 .setDescription(description);
            
//             if (options) {
//                 for (const option of options) {
//                     getOptionAdd(option)?.call(command, option)
//                 }
//             }

//             return command.toJSON();
//         })
//     }
// );

// client.on(Events.InteractionCreate, async interaction => {
//     if (!interaction.isChatInputCommand()) return;
    
//     const data = commands[interaction.commandName]
    
//     if (!data) {
//         console.error(
//             `No command matching ${interaction.commandName} was found.`
//         );
//         return;
//     }
    
//     await data.execute(interaction, interaction.options)
// });

client.login(BOT_TOKEN)
