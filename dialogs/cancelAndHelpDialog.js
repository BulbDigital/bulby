// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ComponentDialog, DialogTurnStatus } = require('botbuilder-dialogs');

/**
 * This base class watches for common phrases like "help" and "cancel" and takes action on them
 * BEFORE they reach the normal bot logic.
 */
class CancelAndHelpDialog extends ComponentDialog {
    constructor(id) {
        super(id);
    }

    async onBeginDialog(innerDc, options) {
        const result = await this.interrupt(innerDc);
        if (result) {
            return result;
        }
        return await super.onBeginDialog(innerDc, options);
    }

    async onContinueDialog(innerDc) {
        const result = await this.interrupt(innerDc);
        if (result) {
            return result;
        }
        return await super.onContinueDialog(innerDc);
    }

    async interrupt(innerDc) {
        const text = innerDc.context.activity.text.toLowerCase();

        switch (text) {
            case 'help':
            case '?':
                await innerDc.context.sendActivity('I support the following actions: Request Vacation Time');
                return { status: DialogTurnStatus.waiting };
            case 'cancel':
            case 'quit':
                await innerDc.context.sendActivity('Cancelling');
                return await innerDc.cancelAllDialogs();
        }

        return;
    }
}

module.exports.CancelAndHelpDialog = CancelAndHelpDialog;
