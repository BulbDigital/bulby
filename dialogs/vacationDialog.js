// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { DateResolverDialog } = require('./dateResolverDialog');

const CONFIRM_PROMPT = 'confirmPrompt';
const START_DATE_RESOLVER_DIALOG = 'startDateResolverDialog';
const END_DATE_RESOLVER_DIALOG = 'endDateResolverDialog';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class VacationDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'vacationDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new DateResolverDialog(START_DATE_RESOLVER_DIALOG, "When would you like your vacation to start?"))
            .addDialog(new DateResolverDialog(END_DATE_RESOLVER_DIALOG, "When would you like your vacation to end? If it's just the one day, enter that day again."))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.startDateStep.bind(this),
                this.endDateStep.bind(this),
                // this.travelDateStep.bind(this),
                this.confirmStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If a start date has not been provided, prompt for one.
     */
    async startDateStep(stepContext) {
        const vacationDetails = stepContext.options;
        if (!vacationDetails.vacationDate) {
            return await stepContext.beginDialog(START_DATE_RESOLVER_DIALOG, { date: vacationDetails.vacationDate });
        } else if (vacationDetails.vacationDate.type === 'date') {
            vacationDetails.startDate = vacationDetails.vacationDate.value;
            return await stepContext.next(vacationDetails);
        }
        else if (vacationDetails.vacationDate.type === 'daterange') {
            vacationDetails.startDate = vacationDetails.vacationDate.start;
            vacationDetails.endDate = vacationDetails.vacationDate.end;
            return await stepContext.next(vacationDetails);
        }
    }

    /**
     * If an end date has not been provided, prompt for one.
     */
    async endDateStep(stepContext) {
        const vacationDetails = stepContext.options;

        // Capture the response to the previous step's prompt
        // vacationDetails.startDate = stepContext.result;
        if (!vacationDetails.endDate) {
            return await stepContext.beginDialog(END_DATE_RESOLVER_DIALOG, { date: vacationDetails.endDate });
        } else {
            return await stepContext.next(vacationDetails.endDate);
        }
    }

    /**
     * If a travel date has not been provided, prompt for one.
     * This will use the DATE_RESOLVER_DIALOG.
     */
    async travelDateStep(stepContext) {
        const bookingDetails = stepContext.options;

        // Capture the results of the previous step
        bookingDetails.origin = stepContext.result;
        if (!bookingDetails.travelDate || this.isAmbiguous(bookingDetails.travelDate)) {
            return await stepContext.beginDialog(DATE_RESOLVER_DIALOG, { date: bookingDetails.travelDate });
        } else {
            return await stepContext.next(bookingDetails.travelDate);
        }
    }

    /**
     * Confirm the information the user has provided.
     */
    async confirmStep(stepContext) {
        const vacationDetails = stepContext.options;

        // Capture the results of the previous step
        vacationDetails.endDate = stepContext.result;

        let msg = '';
        if (vacationDetails.startDate === vacationDetails.endDate) {
            msg = `Please confirm, I have you requesting vacation for: ${vacationDetails.startDate}.`;
        }
        else {
            msg = `Please confirm, I have you requesting vacation from: ${vacationDetails.startDate} to: ${vacationDetails.endDate}.`;
        }

        let tmp = {
            "text": msg,
            "attachments": [
                {
                    "title": "Choose a game to play",
                    "fallback": "You are unable to choose a game",
                    "callback_id": "wopr_game",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            "name": "game",
                            "text": "Chess",
                            "type": "button",
                            "value": "chess"
                        },
                        {
                            "name": "game",
                            "text": "Falken's Maze",
                            "type": "button",
                            "value": "maze"
                        },
                        {
                            "name": "game",
                            "text": "Thermonuclear War",
                            "style": "danger",
                            "type": "button",
                            "value": "war",
                            "confirm": {
                                "title": "Are you sure?",
                                "text": "Wouldn't you prefer a good game of chess?",
                                "ok_text": "Yes",
                                "dismiss_text": "No"
                            }
                        }
                    ]
                }
            ],
            "channelData": {
                "text": "Now back in stock! :tada:",
                "attachments": [
                     {
                         "title": "The Further Adventures of Slackbot",
                         "author_name": "Stanford S. Strickland",
                         "author_icon": "https://api.slack.com/img/api/homepage_custom_integrations-2x.png",
                         "image_url": "http://i.imgur.com/OJkaVOI.jpg?1"
                     },
                     {
                         "fields": [
                             {
                                 "title": "Volume",
                                 "value": "1",
                                 "short": true
                             },
                             {
                                 "title": "Issue",
                                 "value": "3",
                                 "short": true
                             }
                         ]
                     },
                     {
                         "title": "Synopsis",
                         "text": "After @episod pushed exciting changes to a devious new branch back in Issue 1, Slackbot notifies @don about an unexpected deploy..."
                     },
                     {
                         "fallback": "Would you recommend it to customers?",
                         "title": "Would you recommend it to customers?",
                         "callback_id": "comic_1234_xyz",
                         "color": "#3AA3E3",
                         "attachment_type": "default",
                         "actions": [
                             {
                                 "name": "recommend",
                                 "text": "Recommend",
                                 "type": "button",
                                 "value": "recommend"
                             },
                             {
                                 "name": "no",
                                 "text": "No",
                                 "type": "button",
                                 "value": "bad"
                             }
                         ]
                     }
                 ]
             }
        };

        // return await stepContext.context.sendActivity(tmp);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(TEXT_PROMPT, { prompt: tmp });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true || stepContext.result.toLowerCase() === "yes") {
            const vacationDetails = stepContext.options;

            return await stepContext.endDialog(vacationDetails);
        } else {
            return await stepContext.endDialog();
        }
    }

    isAmbiguous(timex) {
        const timexPropery = new TimexProperty(timex);
        return !timexPropery.types.has('definite');
    }
}

module.exports.VacationDialog = VacationDialog;
