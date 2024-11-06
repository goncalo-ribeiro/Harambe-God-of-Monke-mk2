//https://www.youtube.com/watch?v=sHksse4EUFU
const { Client, Events, GatewayIntentBits, Intents, REST, Routes, SlashCommandBuilder} = require('discord.js');
const { token, nvideaID, tarasManiasID, gandiniFunClubID, clientId } = require('./auth.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, entersState, demuxProbe, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
//const ytdl = require('ytdl-core');
const ytdl = require("@distube/ytdl-core");
const https = require('https');
const fs = require('fs')
const got = require('got');

var heyClips = require('./heysoundClips.json');
var soundClips = require('./soundClips.json');
const guildId = gandiniFunClubID
const rest = new REST().setToken(token);


const player = setUpAudioPlayer();
let connection = null;


const client = new Client({ intents: 
    [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });

// Log in to Discord with your client's token
client.login(token);

// We use 'c' for the event parameter to keep it separate from the already defined 'client'    
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});    

client.on('ready', function (evt) {
    //#region Slash command manipulation section
    // deleteSlashCommands(nvideaID)
   //#endregion

    //UNCOMMENT
    //registerSlashCommands();
});

client.on('messageCreate', async (message) => {
	console.log(`${message.author} in #${message.channel.name} sent: ${message.content}`);
	if (!message.guild) return;

	if (message.content.substring(0, 4) === '-hey') {
        // message.react('🐵');
		const voiceState = message.member?.voice;

        const args = message.content.substring(4).split(' ');
        console.log(args)

		if (voiceState && heyClips[args[1]]) {
			try {
				// message.reply('Playing '+ heyClips[args[1]].memberName +' user\'s /hey');
                console.log('Playing '+ heyClips[args[1]].memberName +' user\'s /hey');
				playHeyClip(args[1], voiceState);
			} catch (error) {
				console.error(error);
			}
		} else {
            if(!voiceState){
                message.reply('Join a voice channel then try again!');
            }else{
                message.reply('Please select a valid user ID!');
            }
		}
	}
    /*
    if (message.content.substring(0, 5) === '-play') {
        const voiceState = message.member?.voice;

        const args = message.content.substring(4).split(' ');
        console.log(args)

		if (voiceState && args[1]) {
			try {
                console.log('Playing '+ args[1]);
                message.reply('Playing '+ args[1]);
				playYoutubeSong(args[1], voiceState);
			} catch (error) {
				console.error(error);
			}
		} else {
            if(!voiceState){
                message.reply('Join a voice channel then try again!');
            }else{
                message.reply('Please input a valid URL!');
            }
		}
    }*/
});

client.on('voiceStateUpdate', (oldState, newState) =>{
    let userID = oldState.id;
    
    if(heyClips.hasOwnProperty(userID) && oldState.channelId === null && newState.channelId != null){
        if(heyClips[userID].enabled){
            console.log('playing ' + heyClips[userID].memberName + '\'s hey clip')
            playHeyClip(userID, newState);
        }   
    }  
} )

async function playYoutubeSong(youtubeURL, voiceState){   
    console.log('playYoutubeSong start', youtubeURL)

    const link = youtubeURL;
    const channel = voiceState.channel
    
    const youtubeRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
    const regexResult = link.match(youtubeRegex)

    if (channel && regexResult) {
        try {
            console.log('connecting to channel...')
            await connectToChannel(channel);
            console.log('subscribing player...')
            connection.subscribe(player);
            const stream = ytdl(link, { filter : 'audioonly' })
            console.log('Playing audio resource...')
            playAudioResource(player, stream, null)
        } catch (error) {
            console.log(error);
            connection.destroy();
        }
    }       
}


async function playHeyClip(userID, voiceState){   
    console.log('playHeyClip start', userID)

    const link = heyClips[userID].link;
    const volume = heyClips[userID].volume;
    const channel = voiceState.channel
    
    const youtubeRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
    const regexResult = link.match(youtubeRegex)

    if (channel) {
        try {
            console.log('connecting to channel...')
            await connectToChannel(channel);
            console.log('subscribing player...')
            connection.subscribe(player);
            const stream = regexResult ? ytdl(link, { filter : 'audioonly' }) : got.stream(link)
            console.log('Playing audio resource...')
            playAudioResource(player, stream, volume)
        } catch (error) {
            console.log(error);
            connection.destroy();
        }
    }       
}

async function getStreamFromURL(link){
    console.log('creating Read Stream From URL:', link)
    return new Promise((resolve, reject) => {
        try {
            const req = https.request(link, (res) => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error('statusCode=' + res.statusCode));
                }
                var body = [];
                res.on('data', function(chunk) {
                    body.push(chunk);
                });
                res.on('end', function() {
                    resolve(body);
                });
            });
            req.on('error', (e) => {
                reject(e.message);
            });
            // send the request
            req.end();    
        } catch (error) {
            console.log('youtube stream error')
            console.log(error)
        }
        
    });
}

async function playAudioResource(player, stream, volume) {
    try {
        const resource = createAudioResource(stream, {inputType: StreamType.Arbitrary, inlineVolume: true });
        if(volume){
            resource.volume.setVolume(volume)
        }
        // console.log(resource)

        player.play(resource);
        return entersState(player, AudioPlayerStatus.Playing, 10e3);
    } catch (error) {
        console.log(error)
        connection.destroy();
        throw error;
    }
}

async function connectToChannel(channel) {
	connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
	});
    console.log('entersState')
	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
	} catch (error) {
        if(connection){
            connection.destroy();
        }
		throw error;
	}
}

function setUpAudioPlayer(){
    let player = createAudioPlayer();

    player.on(AudioPlayerStatus.Playing, () => {
        console.log('/hey is now playing!');
    });

    player.on(AudioPlayerStatus.Idle, () => {
        console.log('hey has finished playing!');
        connection.disconnect();
    });

    // Always remember to handle errors appropriately!
    player.on('error', error => {
        console.error(`Error: ${error.message} with resource ${error.resource}`);
    });
    return player;

}

async function caburro(interaction){
    return('https://cdn.discordapp.com/attachments/434883051085103105/865593595548139550/caburro720p.mp4')
}

async function hey(interaction){   

    let memberId = interaction.member.user.id;
    let memberName = interaction.member.user.username;
    let volume = 1.0;
    let enabled = true;
    let link  = (Math.random() < 0.5) ? 'https://www.youtube.com/watch?v=u42au1R71yw' : 'https://www.youtube.com/watch?v=1JBMTcyp3hM' ;
    //let userWhoseClipIsGonnaBePlayed = memberId;
    let regexResult = 0;

    let linkSet = false;
    let saveToFile = false;
    

    console.log('hey start', memberId, memberName)

    if(heyClips[memberId] == null){
        heyClips[memberId] = {}
        heyClips[memberId].memberName = memberName
        heyClips[memberId].enabled = enabled
        heyClips[memberId].link = link
        heyClips[memberId].volume = volume
        saveToFile = true;
    }
    
    //console.log(interaction.data.options)
    if (interaction.options != undefined){
        saveToFile = true;

        // Interaction options extractor
        const interactionLink = interaction.options.getString('link');
        const interactionVolume = interaction.options.getInteger('volume');
        const interactionEnabled = interaction.options.getBoolean('enabled');
        console.log(interactionLink, interactionVolume, interactionEnabled)

        //link processor
        if(interactionLink){
            console.log('link = ', interactionLink)

            let urlRegExp = /^(ftp|http|https):\/\/[^ "]+$/
            regexResult = interactionLink.match(urlRegExp);
            if(regexResult){
                link = interactionLink;
                heyClips[memberId].link = link
                linkSet = true;
            }else{
                return('please specify a valid url');
            }
        }

        //volume processor
        if(interactionVolume){
            console.log('volume = ', interactionVolume)

            if((interactionVolume >= 10) && (interactionVolume <= 200)){
                volume = interactionVolume / 100;
                heyClips[memberId].volume = volume
            }else{
                return('please specify a valid volume [10-200]');
            }
        }
            
            //enabled processor
        if(interactionEnabled !== null){
            console.log('enabled = ', interactionEnabled)

            enabled = interactionEnabled
            heyClips[memberId].enabled = enabled
        }
    }
    if(saveToFile){
        console.log("write to file")
        console.log(heyClips)
        await fs.writeFile('heysoundClips.json', JSON.stringify(heyClips, null, 4), (err) => {});
    }
    let response = (linkSet) ? "Hey sound clip successfully set 👌" : 'Hey sound clip changes were saved 👌'
    return response;
}

//#region manage slash commands
function registerSlashCommands(){
    const commands = [
        new SlashCommandBuilder()
        .setName('hey')
        .setDescription('create your own customized sound clip')
        .addStringOption(option =>
			option
				.setName('link')
				.setDescription('specify your custom sound clip which will play whenever you enter voice channel'))
        .addIntegerOption(option =>
			option
				.setName('volume')
				.setDescription('specify your custom sound clip volume [10 - 200]% (default 100%)'))
        .addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription('enable or disable the sound clip from playing (default: TRUE)')),

        new SlashCommandBuilder()
        .setName('caburro')
        .setDescription('para quando alguem está a ser burro')
    ].map(command => command.toJSON());
    

    const rest = new REST().setToken(token);

    // and deploy your commands!
    (async () => {
        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);

            // The put method is used to fully refresh all commands in the guild with the current set
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );

            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            // And of course, make sure you catch and log any errors!
            console.error(error);
        }
    })();
}

function deleteSlashCommands(guildId){
    rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
	.then(() => console.log('Successfully deleted all guild commands.'))
	.catch(console.error);
}
//#endregion

//#region process slash commands
client.on('interactionCreate', async interaction => {
    console.log('on INTERACTION_CREATE');
    //console.log(interaction)

    if (interaction.commandName === 'hey'){
        //console.log(interaction)
        hey(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta)
        })
        return;
    }

    if (interaction.commandName === 'caburro'){
        //console.log(interaction)
        caburro(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta)
        })
        return;
    }


    else{
        client.api.interactions(interaction.id, interaction.token).callback.post({data: {
            type: 4,
            data: {
              content: 'slash command ainda não (re)implementado'
            }
        }})
    }
})
//#endregion

function getUploadClipDescription(soundClipsChoices){
    return 'upload a custom soundclip (' + (25 - soundClipsChoices.length) + ' slots free)'
}
