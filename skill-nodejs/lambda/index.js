/*
 * Main program to handle intents from Alexa for the mindstorms dealer
*/

const Alexa = require('ask-sdk-core');
const Util = require('./util');
const Common = require('./common');

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

const jokes = [
'How do you make a card stand? <break time="2s"/> Take away its chair',
'Why don\'t pirates like playing cards? <break time="2s"/> There\'s always someone walking across the deck',
'What type of animal is the worst to play cards with? <break time="2s"/> A cheetah.',
'Which company NEVER loses at blackjack? <break time="2s"/> Forever 21.',
'Where do you get a degree in professional card games? <break time="2s"/> The Uno versity.'
]

const gameHelp = [
    {
        game: "blackjack",
        instructions: "Blackjack is a really fun game. At the beginning of the game each player will receive 10 chips. Then the players will bet some of their chips by placing them in the middle. Each player will then receive 2 cards. The value of the cards are the same as the number written on the card where the king, queen, and jack cards are worth 10. The ace card is ether worth 1 or 11, where the player can decide the value. Each player will take turns saying hit or stand. Hit means get a card from the dealer and stand means its next player's turn. If a player’s cards have a value of over 21 they say bust which means they are out. If the player’s cards have a value of 21 then they say blackjack which means they win. Each player will get 2 turns to play in each round. The player with the highest points or the first to get blackjack wins the round and takes the chips from the middle. Hope you enjoy the game."
    },  
    {
        game: "uno",
        instructions: "TBD"
    }  
]

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle: async function(handlerInput) {

        let request = handlerInput.requestEnvelope;
        let { apiEndpoint, apiAccessToken } = request.context.System;
        let apiResponse = await Util.getConnectedEndpoints(apiEndpoint, apiAccessToken);
        if ((apiResponse.endpoints || []).length === 0) {
            return handlerInput.responseBuilder
            .speak(`I couldn't find an EV3 Brick connected to this Echo device. Please check to make sure your EV3 Brick is connected, and try again.`)
            .getResponse();
        }

        // Store the gadget endpointId to be used in this skill session
        let endpointId = apiResponse.endpoints[0].endpointId || [];
        Util.putSessionAttribute(handlerInput, 'endpointId', endpointId);

        return handlerInput.responseBuilder
            .speak("Welcome, which card game will you like to play? You can say Blackjack or Uno.")
            .reprompt("You can say the name of the game you will like to play like Blackjack or Uno")
            .getResponse();
    }
};

// Add the selected game value to the session attribute.
const GameSelectionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GameSelectionIntent';
    },
    handle: function (handlerInput) {
        let game = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Game');
        Util.putSessionAttribute(handlerInput, 'game', game);

        return handlerInput.responseBuilder
            .speak(`How many players are playing ${game}.`)
            .reprompt(`Let me know many players are playing ${game}.`)
            .getResponse();
    }
};

// Say the instructions associated to the game type intent for help.
const GameHelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GameHelpIntent';
    },
    handle: function (handlerInput) {
        let gameName = Alexa.getSlotValue(handlerInput.requestEnvelope, 'GameName');
        Util.putSessionAttribute(handlerInput, 'game', gameName);

        var message = ""
        gameHelp.forEach(function(help){
            if(help.game === gameName){
                message = help.instructions
            }
        });
        if(message === ""){
            message = "Sorry I don't know how to play this game"   
        }

        return handlerInput.responseBuilder
            .speak(message)
            .reprompt(`You can say the name of the game you will like to play like Blackjack or Uno`)
            .withShouldEndSession(false)
            .getResponse();
    }
};

// Add the player count value to the session attribute.
// Construct and send a custom directive to the connected gadget to deal the cards.
const PlayerCountIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PlayerCountIntent';
    },
    handle: function (handlerInput) {
        let playerCount = Alexa.getSlotValue(handlerInput.requestEnvelope, 'PlayerCount');
        Util.putSessionAttribute(handlerInput, 'playerCount', playerCount);
        
        // Get data from session attribute
        const attributesManager = handlerInput.attributesManager;
        const endpointId = attributesManager.getSessionAttributes().endpointId || [];
        const game = attributesManager.getSessionAttributes().game;

        var playerTurn = 1
        var playersInGame = []
        Util.putSessionAttribute(handlerInput, 'playerTurn', playerTurn);
        for(var i=1;i<=playerCount;i++){
            playersInGame.push(i)
        }
        Util.putSessionAttribute(handlerInput, 'playersInGame', playersInGame);

        var message = 'Dealing Cards now. This will take a few seconds. <break time="1s"/>';
        let jokeIndex = randomInteger(0, jokes.length-1)
        message = message + 'Here is a joke for you meantime. <break time="1s"/>' + jokes[jokeIndex] + '<break time="2s"/> ';
        
        var repromptMessage = ""
        if(game.toLowerCase() === "blackjack"){
            message = message + 'Mindstorms Dealer is almost done dealing the cards. <break time="5s"/>';
            message = message + 'The cards are dealt, everyone please put chips in the middle. <break time="5s"/>';
            message = message + `Player ${playerTurn}, hit or stand.`;
            repromptMessage = `Player ${playerTurn}, please say hit or stand.`;
        }else if(game.toLowerCase() === "uno"){
            message = message + 'Mindstorms Dealer is almost done dealing the cards. <break time="5s"/>';
            message = message + 'The cards are dealt. Lets play UNO. <break time="7s"/>';
            repromptMessage = `Player ${playerTurn}, please start. <break time="7s"/>`;
        }
        
        // Construct the directive with the payload containing the move parameters
        const directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
        {
            type: 'deal-initial',
            game: game.toLowerCase(),
            playerCount: playerCount,
            playerTurn: playerTurn
        });

        return handlerInput.responseBuilder
            .speak(message)
            .reprompt(repromptMessage)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with
// to move to the next turn
const GameTurnCommandIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GameTurnCommandIntent';
    },
    handle: function (handlerInput) {
        const request = handlerInput.requestEnvelope;
        const gameTurnCommand = Alexa.getSlotValue(request, 'GameTurnCommand');
        
        // Get data from session attribute
        const attributesManager = handlerInput.attributesManager;
        const endpointId = attributesManager.getSessionAttributes().endpointId || [];
        const game = attributesManager.getSessionAttributes().game;
        const playerCount = attributesManager.getSessionAttributes().playerCount;
        const playersInGame = attributesManager.getSessionAttributes().playersInGame || [];
        var playerTurn = attributesManager.getSessionAttributes().playerTurn || 1;

        var speechOutput = "";
        var nextPlayerTurn = playerTurn;
        for(var k in playersInGame){
            var i = playersInGame.indexOf(playerTurn)
            if(i+1>=playersInGame.length){
                nextPlayerTurn = playersInGame[0]
            }else{
                nextPlayerTurn = playersInGame[i+1]
            }
        }

        var shouldEndSession = false
        var repromptMessage = "";
        var gameCommand = ""
        if(game === "blackjack"){
            if(gameTurnCommand === "hit"){
                speechOutput = `Here is another card for you player ${playerTurn}. <break time="3s"/> Say hit or stand?`
                repromptMessage = `Player ${playerTurn}, please say hit or stand.`;
                gameCommand = "hit"
            }else if(gameTurnCommand === "stand"){
                speechOutput = `Player ${nextPlayerTurn} its your turn now, good luck. <break time="1s"/> Say hit or stand?`
                playerTurn = nextPlayerTurn
                repromptMessage = `Player ${playerTurn}, please say hit or stand.`;
            }else if(gameTurnCommand === "bust"){
                speechOutput = `You are out but good luck next time. Player ${nextPlayerTurn}, say hit or stand?`
                playersInGame.splice( playersInGame.indexOf(playerTurn), 1 );
                playerTurn = nextPlayerTurn
                repromptMessage = `Player ${playerTurn}, please say hit or stand.`;
            }else if(gameTurnCommand === "blackjack"){
                speechOutput = `Congratulations! player ${playerTurn}, you are the winner of this round. You can take the chips from the middle.`
                shouldEndSession = true
            }else{
                speechOutput = "Unable to understand, please say what you will like to do."
            }
        }else if(game === "uno"){
            if(gameTurnCommand === "deal once" || gameTurnCommand === "deal twice"){
                speechOutput = `Here are some cards for you. <break time="5s"/>`
                repromptMessage = `Please let me know if you want to deal once or deal twice`;
                gameCommand = gameTurnCommand
            }
        }

        Util.putSessionAttribute(handlerInput, 'playerTurn', playerTurn);
        Util.putSessionAttribute(handlerInput, 'playersInGame', playersInGame);

        // Construct the directive with the payload containing the move parameters
        const directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
        {
            type: 'deal-turn',
            game: game.toLowerCase(),
            playerCount: playerCount,
            playerTurn: playerTurn,
            gameCommand: gameCommand
        });


        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(repromptMessage)
            .addDirective(directive)
            .withShouldEndSession(shouldEndSession)
            .getResponse();
    }
};

// Shuffle Cards
const ShuffleCardIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ShuffleCardIntent';
    },
    handle: function (handlerInput) {
        // Get data from session attribute
        const attributesManager = handlerInput.attributesManager;
        const endpointId = attributesManager.getSessionAttributes().endpointId || [];
        
        var message = 'Shuffling cards now.';
        
        // Construct the directive with the payload containing the move parameters
        const directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
        {
            type: 'deal-initial',
            game: 'shuffle-cards',
            playerCount: 0,
            playerTurn: 0
        });

        return handlerInput.responseBuilder
            .speak(message)
            .reprompt(message)
            .addDirective(directive)
            .getResponse();
    }
};

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GameSelectionIntentHandler,
        PlayerCountIntentHandler,
        GameTurnCommandIntent,
        ShuffleCardIntentHandler,
        GameHelpIntentHandler,
        Common.HelpIntentHandler,
        Common.CancelAndStopIntentHandler,
        Common.SessionEndedRequestHandler,
        Common.IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addRequestInterceptors(Common.RequestInterceptor)
    .addErrorHandlers(
        Common.ErrorHandler,
    )
    .lambda();