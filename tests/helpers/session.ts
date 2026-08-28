/**
 * A stand-in for the message + component collector that runSession drives.
 * `press()` delivers a click the way discord.js would.
 */

import {EventEmitter} from "node:events";
import type {RepliableInteraction} from "discord.js";


export interface PressOptions {
    userId?: string;
    /** Present for a select menu; its absence makes the stub a button. */
    values?: string[];
}

export interface SessionHarness {
    interaction: RepliableInteraction;
    /** Every payload a viewer would have seen, from editReply or update. */
    shown: Array<Record<string, unknown>>;
    /** Returns anything the component replied with, e.g. an ownership refusal. */
    press(action: string, options?: PressOptions): Promise<Array<Record<string, unknown>>>;
    end(): Promise<void>;
}


export function sessionHarness(ownerId = "owner"): SessionHarness {
    const collector = Object.assign(new EventEmitter(), {
        // runSession calls stop() on its error path.
        stop: () => {collector.emit("end");}
    });
    const shown: Array<Record<string, unknown>> = [];

    const interaction = {
        deferred: true,
        replied: false,
        user: {id: ownerId},
        deferReply: () => Promise.resolve(),
        editReply: (payload: Record<string, unknown>) => {
            shown.push(payload);
            return Promise.resolve({createMessageComponentCollector: () => collector});
        }
    };

    const settle = () => new Promise(resolve => setImmediate(resolve));

    /**
     * runSession attaches its collector after two awaits, so a press issued
     * immediately after starting the session would otherwise be emitted into
     * the void.
     */
    async function whenListening() {
        for (let attempt = 0; attempt < 100 && collector.listenerCount("collect") === 0; attempt++) await settle();
        if (collector.listenerCount("collect") === 0) throw new Error("session never attached a collector");
    }

    return {
        interaction: interaction as unknown as RepliableInteraction,
        shown,

        async press(action, {userId = ownerId, values}: PressOptions = {}) {
            await whenListening();
            const refusals: Array<Record<string, unknown>> = [];
            const isSelect = values !== undefined;
            const component = {
                customId: `~${action}`,
                user: {id: userId},
                values: values ?? [],
                replied: false,
                deferred: false,

                isButton: () => !isSelect,
                isStringSelectMenu: () => isSelect,
                isRoleSelectMenu: () => false,
                isUserSelectMenu: () => false,
                isChannelSelectMenu: () => false,
                isMentionableSelectMenu: () => false,

                reply: (payload: Record<string, unknown>) => {refusals.push(payload); return Promise.resolve();},
                update: (payload: Record<string, unknown>) => {shown.push(payload); return Promise.resolve();},
                deferUpdate: () => Promise.resolve()
            };
            collector.emit("collect", component);
            await settle();
            return refusals;
        },

        async end() {
            await whenListening();
            collector.emit("end");
            await settle();
        }
    };
}
