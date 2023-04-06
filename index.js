//https://www.youtube.com/watch?v=sHksse4EUFU
const { Client, Events, GatewayIntentBits, Intents} = require('discord.js');
const { token, nvideaID, tarasManiasID, gandiniFunClubID } = require('./auth.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, entersState, demuxProbe, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const https = require('https');
const fs = require('fs')

var heyClips = require('./heysoundClips.json');
var soundClips = require('./soundClips.json');
const guildId = nvideaID

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
    // registerSlashCommands();
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
            // console.log(stream)
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
    if (interaction.data.options != undefined){
        saveToFile = true;

        for (let i = 0; i < interaction.data.options.length; i++) {
            const option = interaction.data.options[i];
            if(option.name === 'link'){
                console.log('link = ', link)
                let urlRegExp = /^(ftp|http|https):\/\/[^ "]+$/
                regexResult = option.value.match(urlRegExp);
                if(regexResult){
                    link = option.value;
                    heyClips[memberId].link = link
                    linkSet = true;
                }else{
                    return('please specify a valid url');
                }
            }if(option.name === 'volume'){
                console.log('volume = ', volume)
                if((option.value >= 10) && (option.value <= 200)){
                    volume = option.value / 100;
                    heyClips[memberId].volume = volume
                }else{
                    return('please specify a valid volume [10-200]');
                }
            }
            if(option.name === 'enabled'){
                enabled = option.value
                heyClips[memberId].enabled = enabled
            }
        }
    }
    if(saveToFile){
        console.log("write to file")
        await fs.writeFile('heysoundClips.json', JSON.stringify(heyClips, null, 4), (err) => {});
    }
    let response = (linkSet) ? "Hey sound clip successfully set 👌" : 'Hey sound clip changes were saved 👌'
    return response;
}

//#region register slash commands
function registerSlashCommands(){
    //manual
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'bless',
        description: 'surround thyself in holy light and transcend thy mortal state'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'caburro',
        description: 'para quando alguem está a ser burro'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'coco',
        description: 'para quando te apetece carapaus à espanhola'
    }})  
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'commando',
        description: 'witness the might of the ugandan commandos'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'dc',
        description: 'break in case of emergency'
    }})
    /*
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'finishheroff',
        description: 'sponsored by Marcode'
    }})
    */
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'kekeres',
        description: 'kekeres crl?'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'monke',
        description: 'reject humanity, embrace monke'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'passbanana',
        description: 'spread the love within your server'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'marcode',
        description: 'comandos sponsored pelo progamationer do server',
        options: [
            {
                "name": "comando",
                "description": "comando altes besta",
                "type": 3,
                "required": true,
                "choices": [
                    {
                        "name": "finishheroff",
                        "value": "finishheroff"
                    },
                    {
                        "name": "praisethelord",
                        "value": "praisethelord"
                    },
                ]
            }
        ]
    }})

    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'toy',
        description: 'um programa de culto...'
    }})

    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'lixo',
        description: 'TSF in a nutshell'
    }})

    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'coffin',
        description: '🕺🏿🕺🏿⚰️🕺🏿🕺🏿'
    }})

    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'herewego',
        description: '✌⭐'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'leona',
        description: 'Bust in case of Leona'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'wazzaa',
        description: 'wassup my ninja?'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'emocionado',
        description: 'ouvi as palavras sábias do nuno melo'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'espetaculo',
        description: 'ESHBETÁAAAAAAAAAAAACULO!'
    }})
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'conspiracy',
        description: 'ask Harambe his opinion about conspiracy theories'
    }})


    
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'hey',
        description: 'create your own customized sound clip',
        options: [
            {
                "name": "link",
                "description": "specify your custom sound clip which will play whenever you enter voice channel",
                "type": 3,
            },
            {
                "name": "volume",
                "description": "specify your custom sound clip volume [10 - 200]% (default 100%)",
                "type": 4,
            },
            {
                "name": "enabled",
                "description": "enable or disable the sound clip from playing (default: TRUE)",
                "type": 5,
            },
        ],
    }})

    registerSoundClipCommands()

    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'rift',
        description: 'The Rift yearns for its tribute',
        options: [
            {
                "name": "aram",
                "value": "aram",
                "description": "Fight over the Murder Bridge? (DEFAULT: FALSE)",
                "type": 5,
            },
            {
                "name": "toxicbros",
                "value": "toxicbros",
                "description": "Summon only the Toxic Bros? (DEFAULT: FALSE)",
                "type": 5,
            },
        ],
    }})

    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'gameofthrows',
        description: 'Break in case of throw'
    }})
    /*
    client.api.applications(client.user.id).guilds(guildId).commands.post({data: {
        name: 'bet',
        description: 'welcome to the Nvidea Highstakes Casino Extravaganza',
        options: [
            {
                "name": "yes",
                "value": "yes",
                "description": "bet that the desired unit will be pulled",
                "type": 1,
                "options": [
                    {
                        "name": "credits",
                        "description": "specify the ammount of credits to bet (type \"all in\" to bet all of your remaining credits)",
                        "type": 3, 
                        "required": true,
                    },
                ]
            },
            {
                "name": "no",
                "value": "no",
                "description": "bet that the desired unit will not be pulled",
                "type": 1,
                "options": [
                    {
                        "name": "credits",
                        "description": "specify the ammount of credits to bet (type \"all in\" to bet all of your remaining credits)",
                        "type": 3, 
                        "required": true,
                    },
                ]
            },
            {
                "name": "cancel",
                "value": "cancel",
                "description": "cancel your current bet",
                "type": 1
            },
            {
                "name": "odds",
                "value": "odds",
                "description": "check the bettings odds",
                "type": 1
            },
            {
                "name": "status",
                "value": "status",
                "description": "show the status of the current pull",
                "type": 1
            },
            {
                "name": "ranking",
                "value": "ranking",
                "description": "list the credits of all the users",
                "type": 1
            },
            {
                "name": "end",
                "value": "end",
                "description": "use this to crown the winner",
                "type": 1
            },
            {
                "name": "result",
                "description": "set whether or not the desired unit was pulled or not",
                "type": 1, 
                "options": [
                    {
                        "name": "pulled",
                        "description": "was the desired unit pulled?",
                        "type": 5, 
                        "required": true,
                    },
                    {
                        "name": "70pity",
                        "description": "was the pull made with 70+ pity (defaults to False)",
                        "type": 5,
                    },
                    {
                        "name": "pulltype",
                        "description": "10 pull or single pull (defaults to 10 pull)",
                        "type": 3,
                        "choices": [
                            {
                                "name": "10 pull",
                                "value": "10 pull"
                            },
                            {
                                "name": "single pull",
                                "value": "single pull"
                            },
                        ] 
                    },
                    {
                        "name": "undo",
                        "description": "use this to undo the latest \"/bet result\" command",
                        "type": 5,
                    },
                ],/*
                
                "choices": [
                    {
                        "name": "yes",
                        "value": "yes"
                    },
                    {
                        "name": "no",
                        "value": "no"
                    },
                ]
            }
        ]
    }})*/
}
//#endregion

//#region process slash commands
client.on('interactionCreate', async interaction => {
    console.log('on INTERACTION_CREATE');
    //console.log(interaction)
   /*
    if (interaction.data.name === 'kekeres'){
        let interactionUserId = interaction.member.user.id;
        kekeres(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)
    
            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'dc'){
        dc().then( (resposta) => {
            console.log('resposta', resposta)
            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'bless'){
        let interactionUserId = interaction.member.user.id;
        bless(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'commando'){
        let interactionUserId = interaction.member.user.id;
        commando(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'passbanana'){
        passbanana().then( (resposta) => {
            console.log('resposta', resposta)
            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'caburro'){
        let interactionUserId = interaction.member.user.id;
        caburro(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'coco'){
        let interactionUserId = interaction.member.user.id;
        coco(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'monke'){
        let interactionUserId = interaction.member.user.id;
        monke(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'marcode'){
        console.log(interaction.data.options[0])
        if(interaction.data.options[0].value === 'finishheroff'){
            let interactionUserId = interaction.member.user.id;
            finishheroff(interactionUserId).then( (resposta) => {
                console.log('resposta', resposta)
    
                client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                    type: 4,
                    data: {
                      content: resposta
                    }
                }})
            })
            return;
        }
        if (interaction.data.options[0].value === 'praisethelord'){
            let interactionUserId = interaction.member.user.id;
            praisethelord(interactionUserId).then( (resposta) => {
                console.log('resposta', resposta)
    
                client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                    type: 4,
                    data: {
                      content: resposta
                    }
                }})
            })
            return;
        }

    }

    if (interaction.data.name === 'toy'){
        let interactionUserId = interaction.member.user.id;
        toy(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'lixo'){
        let interactionUserId = interaction.member.user.id;
        lixo(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'coffin'){
        let interactionUserId = interaction.member.user.id;
        coffin(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'herewego'){
        let interactionUserId = interaction.member.user.id;
        herewego(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'wazzaa'){
        let interactionUserId = interaction.member.user.id;
        wazzaa(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'leona'){
        let interactionUserId = interaction.member.user.id;
        leona(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'rift'){
        console.log(interaction)
        //let interactionUserId = interaction.member.user.id;
        rift(interaction).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'emocionado'){
        console.log(interaction)
        let interactionUserId = interaction.member.user.id;
        emocionado(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'espetaculo'){
        console.log(interaction)
        let interactionUserId = interaction.member.user.id;
        espetaculo(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'conspiracy'){
        console.log(interaction)
        let interactionUserId = interaction.member.user.id;
        conspiracy(interactionUserId).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }
*/

    if (interaction.commandName === 'hey'){
        //console.log(interaction)
        hey(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta)

            // client.api.interactions(interaction.id, interaction.token).callback.post({data: {
            //     type: 4,
            //     data: {
            //       content: resposta
            //     }
            // }})
        })
        return;
    }

    /*
    if (interaction.data.name === 'clip'){
        //console.log(interaction)
        clip(interaction).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }

    if (interaction.data.name === 'soundclip'){
        console.log('********************************************************************')
        console.log(interaction.data.options)

        if(interaction.data.options[0].name === 'upload'){
            soundclipUpload(interaction).then( (resposta) => {
                console.log('resposta', resposta)
    
                client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                    type: 4,
                    data: {
                      content: resposta
                    }
                }})
            })
        }else{
            if(interaction.data.options[0].name === 'delete'){
                soundclipDelete(interaction).then( (resposta) => {
                    console.log('resposta', resposta)
        
                    client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                        type: 4,
                        data: {
                          content: resposta
                        }
                    }})
                })
            }else{
                if(interaction.data.options[0].name === 'volume'){
                    soundclipEditVolume(interaction).then( (resposta) => {
                        console.log('resposta', resposta)
            
                        client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                            type: 4,
                            data: {
                              content: resposta
                            }
                        }})
                    })
                }
            }
        }

        return;
    }

    if (interaction.data.name === 'gameofthrows'){
        console.log(interaction)
        //let interactionUserId = interaction.member.user.id;
        gameOfThrows(interaction).then( (resposta) => {
            console.log('resposta', resposta)

            client.api.interactions(interaction.id, interaction.token).callback.post({data: {
                type: 4,
                data: {
                  content: resposta
                }
            }})
        })
        return;
    }*/

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
