/**
 * Ephemeral, single-invocation UI.
 *
 * The other half of the interaction story. Registered components (registry.ts)
 * are for UI that must survive a restart, so their state lives in the custom id.
 * A session is for UI that belongs to one invocation by one user and dies with
 * the interaction token, so its state lives in a closure.
 *
 * Written once so that the ownership check, the timeout, the disable-on-end and
 * the error path are identical everywhere.
 */

import {
    MessageFlags,
    type AwaitModalSubmitOptions, type InteractionEditReplyOptions,
    type MessageComponentInteraction, type ModalComponentData, type ModalSubmitInteraction,
    type RepliableInteraction
} from "discord.js";
import {msInMinute} from "../util/time";


const SESSION_PREFIX = "~";

/**
 * Session-owned custom ids carry a prefix that can never be a registered
 * namespace, so the global dispatcher knows to leave them to this collector.
 */
export const sessionId = (action: string): string => `${SESSION_PREFIX}${action}`;
export const isSessionId = (customId: string): boolean => customId.startsWith(SESSION_PREFIX);
const actionOf = (customId: string): string => customId.slice(SESSION_PREFIX.length);


export interface SessionOptions<S> {
    interaction: RepliableInteraction;
    initial: S;
    /** Pure: state in, message out. Called again after every accepted action. */
    render: (state: S, options: {ended: boolean;}) => InteractionEditReplyOptions;
    /**
     * Return the next state, or `undefined` to acknowledge without re-rendering.
     * `action` is whatever was passed to `sessionId()`.
     */
    reduce: (action: string, state: S, interaction: MessageComponentInteraction) => S | undefined | Promise<S | undefined>;
    timeout?: number;
    /** Who may use the controls. Defaults to whoever ran the command. */
    audience?: "invoker" | "anyone";
}


/** Resolves with the final state once the collector ends. */
export async function runSession<S>(options: SessionOptions<S>): Promise<S> {
    const {interaction, render, reduce, timeout = msInMinute * 2, audience = "invoker"} = options;
    let state = options.initial;

    // Always defer/editReply. Ephemerality is decided by how the caller defers,
    // which is the only point at which Discord lets it be decided anyway.
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
    const message = await interaction.editReply(render(state, {ended: false}));

    const collector = message.createMessageComponentCollector({time: timeout});

    return await new Promise<S>(resolve => {
        collector.on("collect", async componentInteraction => {
            // The guard comes first. Nothing is captured before it passes.
            if (audience === "invoker" && componentInteraction.user.id !== interaction.user.id) {
                await componentInteraction.reply({
                    content: "This menu belongs to someone else. Run the command yourself to get your own.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            try {
                const next = await reduce(actionOf(componentInteraction.customId), state, componentInteraction);
                if (next === undefined) {
                    if (!componentInteraction.replied && !componentInteraction.deferred) await componentInteraction.deferUpdate();
                    return;
                }
                state = next;
                await componentInteraction.update(render(state, {ended: false}));
            }
            catch (error) {
                console.error("session action failed", error);
                collector.stop("error");
            }
        });

        collector.on("end", async () => {
            try {
                // The single place that disables the controls.
                await interaction.editReply(render(state, {ended: true}));
            }
            catch (error) {
                console.error("could not finalise session", error);
            }
            resolve(state);
        });
    });
}


/**
 * Show a modal and wait for it, with the fields already pulled out.
 * Returns `null` on timeout so it cannot be confused with a real failure.
 */
export async function awaitModal<F extends string>(
    interaction: RepliableInteraction,
    modal: ModalComponentData,
    fields: readonly F[],
    options: AwaitModalSubmitOptions<ModalSubmitInteraction> = {time: msInMinute * 5}
): Promise<{submission: ModalSubmitInteraction; values: Record<F, string>;} | null> {
    if (!interaction.isChatInputCommand() && !interaction.isMessageComponent()) return null;
    await interaction.showModal(modal);

    try {
        const submission = await interaction.awaitModalSubmit(options);
        const values = Object.fromEntries(fields.map(field => [field, submission.fields.getTextInputValue(field)])) as Record<F, string>;
        return {submission, values};
    }
    catch {
        return null;
    }
}
