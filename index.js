//https://www.youtube.com/watch?v=sHksse4EUFU
const { Client, Events, GatewayIntentBits, Intents} = require('discord.js');
const { token, nvideaID, tarasManiasID, gandiniFunClubID } = require('./auth.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, entersState, demuxProbe, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
// const { exec } = require( 'youtube-dl-exec');
const ytdl = require('ytdl-core');
const https = require('https');

var heyClips = require('./heysoundClips.json');
var soundClips = require('./soundClips.json');

const player = setUpAudioPlayer();
let connection = null;

let streamaux
https.get('https://cdn.discordapp.com/attachments/434883051085103105/1069420247746101268/wassup_baby.mp3', res => streamaux=res);

// const stream1 = createReadStream("https://cdn.discordapp.com/attachments/434883051085103105/1069420247746101268/wassup_baby.mp3")
// console.log(stream1)
// const resource1 = createAudioResource(stream1)
// console.log(resource1)
// const stream2 = createReadStream("heys\wassup_baby.mp3")
// console.log(stream2)
// const resource2 = createAudioResource(stream2)
// console.log(resource2)

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
    client.user.setPresence({ activity: { name: 'over Monke Heaven', type:"WATCHING" }, status: 'online' })

    //#region Slash command manipulation section
    /* Get SlashCommands
    client.api.applications(client.user.id).guilds(guildId).commands.get().then(data => {
        console.log(data)
    });
    */

   /* Get Info
    client.api.applications(client.user.id).guilds(guildId).commands.resolve('902190034873098261').then(data => {
       console.log(data)
    });
    */

    /* Delete Slash Command
    //client.api.applications(client.user.id).guilds(guildId).commands('902190034873098261').delete()
    */
   //#endregion

    //UNCOMMENT
    //registerSlashCommands();
});

client.on('messageCreate', async (message) => {
    console.log(streamaux)
    // console.log(message)
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
            const stream = regexResult ? ytdl(link, { filter : 'audioonly' }) : await getStreamFromURL(link)
            console.log('Playing audio resource...')
            playAudioResource(player, stream, volume)
        } catch (error) {
            console.log(error);
        }
    }       
}

async function getStreamFromURL(link){
    console.log('creating Read Stream From URL:', link)
    return new Promise((resolve, reject) => {
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
    });
}

async function playAudioResource(player, stream, volume) {
    // console.log(stream)
    try {
        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
        resource.volume.setVolume(volume)
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