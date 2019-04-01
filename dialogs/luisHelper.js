// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { LuisRecognizer } = require('botbuilder-ai');

class LuisHelper {
    /**
     * Returns an object with preformatted LUIS results for the bot's dialogs to consume.
     * @param {*} logger
     * @param {TurnContext} context
     */
    static async executeLuisQuery(logger, context) {
        const bookingDetails = {};

        try {
            const recognizer = new LuisRecognizer({
                applicationId: process.env.LuisAppId,
                endpointKey: process.env.LuisAPIKey,
                endpoint: `https://${ process.env.LuisAPIHostName }`
            }, {}, true);

            const recognizerResult = await recognizer.recognize(context);

            const intent = LuisRecognizer.topIntent(recognizerResult);

            bookingDetails.intent = intent;

            if (intent === 'Book_flight') {
                // We need to get the result from the LUIS JSON which at every level returns an array

                bookingDetails.destination = LuisHelper.parseCompositeEntity(recognizerResult, 'To', 'Airport');
                bookingDetails.origin = LuisHelper.parseCompositeEntity(recognizerResult, 'From', 'Airport');

                // This value will be a TIMEX. And we are only interested in a Date so grab the first result and drop the Time part.
                // TIMEX is a format that represents DateTime expressions that include some ambiguity. e.g. missing a Year.
                bookingDetails.travelDate = LuisHelper.parseDatetimeEntity(recognizerResult);
            }
            if(intent === 'Request_vacation'){
                // This value will be a TIMEX. And we are only interested in a Date so grab the first result and drop the Time part.
                // TIMEX is a format that represents DateTime expressions that include some ambiguity. e.g. missing a Year.
                // logger.log(recognizerResult);
                bookingDetails.vacationDate = LuisHelper.parseDatetimeEntity(recognizerResult, logger);
            }
        } catch (err) {
            logger.warn(`LUIS Exception: ${ err } Check your LUIS configuration`);
        }
        return bookingDetails;
    }

    static parseCompositeEntity(result, compositeName, entityName) {
        const compositeEntity = result.entities[compositeName];
        if (!compositeEntity || !compositeEntity[0]) return undefined;

        const entity = compositeEntity[0][entityName];
        if (!entity || !entity[0]) return undefined;

        const entityValue = entity[0][0];
        return entityValue;
    }

    static parseDatetimeEntity(result, logger) {
        const datetimeEntity = result.luisResult.entities[0];
        if (!datetimeEntity) return undefined;

        logger.log(datetimeEntity);
        // const timex = datetimeEntity[0]['timex'];
        // if (!timex || !timex[0]) return undefined;

        const resolutionValues = datetimeEntity.resolution.values;

        if(resolutionValues.length > 1){
            const dateValues = resolutionValues[1];
            return dateValues;

            // if(recognizerResult.luisResult.entities){
            //     recognizerResult.luisResult.entities.forEach(ent => {
            //         if(ent.resolution){
            //             if(ent.resolution.values.length > 1){
                            
            //             }
            //             ent.resolution.values.forEach(val =>{
            //                 logger.log(val);
            //             })
            //         }
            //     });
            // }
        }
        else{
            const dateValues = resolutionValues[0];
            return dateValues;
        }

        // const datetime = timex[0].split('T')[0];
        // return datetime;
    }
}

module.exports.LuisHelper = LuisHelper;
