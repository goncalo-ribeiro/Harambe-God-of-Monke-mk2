//https://www.youtube.com/watch?v=sHksse4EUFU
const { Client, Events, GatewayIntentBits, Intents} = require('discord.js');
const { token, nvideaID, tarasManiasID, gandiniFunClubID } = require('./auth.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, entersState, demuxProbe, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const { exec } = require( 'youtube-dl-exec');
let guildId = nvideaID;

var heyClips = require('./heysoundClips.json');
var soundClips = require('./soundClips.json');

const player = setUpAudioPlayer();
let connection = null;

const client = new Client({ intents: 
    [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages] });

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

    let link = heyClips[userID].link;
    let volume = heyClips[userID].volume;
    const channel = voiceState.channel

    if (channel) {
        try {
            console.log('connecting to channel...')
            await connectToChannel(channel);
            console.log('subscribing player...')
            connection.subscribe(player);
            const stream = getYoutubeStream(link)
            console.log('Playing audio resource...')
            playAudioResource(stream)
        } catch (error) {
            console.log(error);
        }
    }       
}

async function playAudioResource(stream) {
    // console.log(stream)
    try {
        // const probe = await demuxProbe(stream)

        // const resource = createAudioResource(probe.stream, { inputType: probe.type });
        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        
        player.play(resource);
        return entersState(player, AudioPlayerStatus.Playing, 10e3);
    } catch (error) {
        console.log(error)
        // connection.destroy();
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

function getYoutubeStream(link){

    const process = exec(
        link,
        {
            output: '-',
            // quiet: true,
            format: 'ba',
            // audioFormat: 'mp3',
            verbose: true,
            // limitRate: '1M',
        }
        ,{ stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (!process.stdout) {
        console.log('no process.stdout')
        return;
    }

    return stream = process.stdout;
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
        console.error(`Error: ${error.message} with resource ${error.resource.metadata.title}`);
    });
    return player;

}