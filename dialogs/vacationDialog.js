// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { DateResolverDialog } = require('./dateResolverDialog');

const axios = require('axios');

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
            return await stepContext.next(vacationDetails.startDate);
        }
        else if (vacationDetails.vacationDate.type === 'daterange') {
            vacationDetails.startDate = vacationDetails.vacationDate.start;
            vacationDetails.endDate = vacationDetails.vacationDate.end;
            return await stepContext.next(vacationDetails.startDate);
        }
    }

    /**
     * If an end date has not been provided, prompt for one.
     */
    async endDateStep(stepContext) {
        const vacationDetails = stepContext.options;

        // Capture the response to the previous step's prompt
        vacationDetails.startDate = stepContext.result;
        if (!vacationDetails.endDate) {
            return await stepContext.beginDialog(END_DATE_RESOLVER_DIALOG, { date: vacationDetails.endDate });
        } else {
            return await stepContext.next(vacationDetails.endDate);
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

        let slackMessage = {
            "text": "",
            "channelData": {
                "text": "",
                "attachments": [
                    {
                        "title": msg,
                        "fallback": "You are unable to confirm your vacation request",
                        "callback_id": "bd_vacation_request",
                        "color": "#F7D032",
                        "attachment_type": "default",
                        "actions": [
                            {
                                "name": "confirm",
                                "text": "Yes",
                                "type": "button",
                                "value": "yes",
                                "style": "primary"
                            },
                            {
                                "name": "confirm",
                                "text": "No",
                                "style": "danger",
                                "type": "button",
                                "value": "no"
                            }
                        ]
                    }
                ],
            }
        };

        // return await stepContext.context.sendActivity(tmp);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(TEXT_PROMPT, { prompt: slackMessage });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        // console.log(stepContext);
        let userId = "";
        console.log("*******************************************************************");
        // console.log(stepContext.context._activity);
        if (stepContext.context._activity.channelData) {
            if(stepContext.context._activity.channelId === "emulator"){
                userId = process.env.SlackUserId;
            }
            // console.log(stepContext.context._activity.channelData);
            let payload = stepContext.context._activity.channelData.Payload;
            // console.log("actions");
            // console.log(payload.actions);
            if (stepContext.context._activity.channelId === "slack") {
                userId = payload.user.id;
                let url = payload.response_url;

                let postText = "";
                payload.actions.forEach(action => {
                    if (action.value === 'yes') {
                        postText = ":white_check_mark: Send me away";
                    }
                    else {
                        postText = ":x: Oops wrong date";
                    }
                });

                let slackPost = {
                    "attachments": [
                        {
                            "title": postText,
                            "fallback": "Request confirmed",
                            "callback_id": "bd_vacation_request_confirmed",
                            "color": "#F7D032",
                            "attachment_type": "default"
                        }
                    ], replace_original: true
                };



                axios.post(url, slackPost)
                    .then(response => {
                        console.log(response);
                    })
                    .catch(error => {
                        console.log(error);
                    });
            }
        }
        if (stepContext.result === true || stepContext.result.toLowerCase() === "yes") {
            const vacationDetails = stepContext.options;
            // axios.post("", {startDate})
            let userGetParams = { token: process.env.SlackOAuthToken, user: userId, pretty: true};
            console.log(userGetParams);
            axios.get("https://slack.com/api/users.info", {params:userGetParams}).then(res =>{
                //create approval
                console.log("got user");
                console.log(res);

                if(res.data.ok){
                    let email = res.data.user.profile.email;
                    let approvalPost = { "user": email, "startDate": stepContext.options.startDate, "endDate": stepContext.options.endDate }
                    axios.post(process.env.VacationApprovalFlowUrl, approvalPost).then(flowRes =>{
                        console.log(flowRes);
                    });
                }
            })
            .catch(err =>{
                console.log(err);
            })
            return await stepContext.endDialog(vacationDetails);
        } else {
            const vacationDetails = stepContext.options;
            vacationDetails.startDate = null;
            vacationDetails.endDate = null;
            return await stepContext.replaceDialog('vacationDialog');
        }
    }

    isAmbiguous(timex) {
        const timexPropery = new TimexProperty(timex);
        return !timexPropery.types.has('definite');
    }
}

module.exports.VacationDialog = VacationDialog;
