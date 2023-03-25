const { Client, Events, GatewayIntentBits, Intents } = require('discord.js');
const { token, nvideaID, tarasManiasID, gandiniFunClubID } = require('./auth.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
let guildId = nvideaID;

var heyClips = require('./heysoundClips.json');
var soundClips = require('./soundClips.json');

// const client = new Client({ intents: ['GuildVoiceStates', 'GuildMessages', 'Guilds'] });
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
    
    console.log(0)
    // console.log(heyClips.hasOwnProperty(userID))
    // console.log(oldState.id, oldState.channelID)
    // console.log(newState.id, newState.channelID)
    if(heyClips.hasOwnProperty(userID) && oldState.channelId === null && newState.channelId != null){
        console.log(1)
        if(heyClips[userID].enabled){
            console.log(2)
            console.log('playing ' + heyClips[userID].memberName + '\'s hey clip')
            playHeyClip(userID, newState);
        }   
    }  
} )

async function playHeyClip(userID, voiceState){   
    console.log('playHeyClip start', userID)

    let youtubeRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
        link = heyClips[userID].link;
        volume = heyClips[userID].volume;
        regexResult = link.match(youtubeRegex)
        console.log(regexResult)

        try {
            
            var voiceChannel = voiceState.channel
            if (voiceChannel) {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });

                //const streamOptions = { seek: 0, volume: volume };
                let stream;

                stream = (regexResult) ?  ytdl(link, { filter : 'audioonly' }) : link;
                console.log(stream)
                // dispatcher = connection.play(stream, streamOptions);
                const player = createAudioPlayer();
                const resource = createAudioResource(stream, { inlineVolume: true });
                resource.volume.setVolume(volume);

                player.play(resource);
                connection.subscribe(player)
                
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
                    player.play(getNextResource());
                });
                return('now playing ' + heyClips[userID].memberName + '\'s custom clip at ' + heyClips[userID].volume*100 + '% volume');
            } 
            return('you must be in a voice chat to play your sound clip');
        } catch (error) {
            console.log(error);
            return('chamem o rick crl, nao era suposto chegar aqui');
        }
}