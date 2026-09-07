import {describe, expect, test} from "bun:test";
import {ButtonStyle, ComponentType, MessageFlags} from "discord.js";
import {row} from "../src/framework";
import * as notices from "../src/util/notices";
import {modLogMessage} from "../src/util/modlog";
import {Accents} from "../src/util/colors";
import {tagContainer, updateTagModal} from "../src/components/tags";


const CONTAINER = 17;
const SECTION = 9;
const TEXT_DISPLAY = 10;
const THUMBNAIL = 11;

interface Container {
    type: number;
    accentColor?: number;
    components: Array<{type: number; content?: string; components?: Array<{content: string}>; accessory?: unknown}>;
}
const containerOf = (message: {components: unknown[]}) => message.components[0] as Container;


describe("notices", () => {
    test.each(["success", "info", "warn", "error", "danger"] as const)("%s renders one accented container", kind => {
        const message = notices.notice(kind, "hello");
        const container = containerOf(message);
        expect(container.type).toBe(CONTAINER);
        expect(container.accentColor).toBe(Accents[`${kind[0].toUpperCase()}${kind.slice(1)}` as keyof typeof Accents]);
        expect(container.components[0]?.content).toContain("hello");
    });

    test("always sets IsComponentsV2", () => {
        expect(notices.info("x").flags & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
    });

    test("ephemeral adds the Ephemeral flag without dropping V2", () => {
        const flags = notices.error("x", {ephemeral: true}).flags;
        expect(flags & MessageFlags.Ephemeral).toBe(MessageFlags.Ephemeral);
        expect(flags & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
    });

    // V2 puts action rows inside the container, not alongside it.
    test("action rows are nested inside the container", () => {
        const actions = row({type: ComponentType.Button, customId: "a", label: "A", style: ButtonStyle.Primary});
        const container = containerOf(notices.info("pick", {components: [actions]}));
        expect(container.components.map(c => c.type)).toEqual([TEXT_DISPLAY, 1]);
    });

    test("each kind carries its own icon", () => {
        expect(String(containerOf(notices.success("x")).components[0]?.content)).toContain(":white_check_mark:");
        expect(String(containerOf(notices.error("x")).components[0]?.content)).toContain(":no_entry:");
    });
});


describe("moderation log entries", () => {
    const entry = {
        heading: "spammer",
        body: "Message sent by spammer in #general",
        reason: "Fake Discord Link",
        userId: "123456789012345678",
        at: 1_750_000_000_000
    };

    test("with an avatar, the heading/body/reason sit in a thumbnailed section", () => {
        const container = containerOf(modLogMessage({...entry, iconUrl: "https://cdn/avatar.png"}));
        const section = container.components[0];
        expect(section?.type).toBe(SECTION);
        expect(section?.accessory).toMatchObject({type: THUMBNAIL});
        expect(section?.components?.map(c => c.content)).toEqual([
            "### spammer",
            "Message sent by spammer in #general",
            "**Reason:** Fake Discord Link"
        ]);
    });

    test("without an avatar, the lines are flat with no section", () => {
        const container = containerOf(modLogMessage(entry));
        expect(container.components.every(c => c.type === TEXT_DISPLAY)).toBe(true);
    });

    test("the footer carries the user id and a Discord timestamp", () => {
        const container = containerOf(modLogMessage(entry));
        expect(container.components.at(-1)?.content).toBe("-# ID: 123456789012345678 • <t:1750000000:f>");
    });

    test("an empty body does not produce an empty text display", () => {
        const container = containerOf(modLogMessage({...entry, body: ""}));
        expect(container.components[1]?.content).not.toBe("");
    });
});


describe("tag rendering", () => {
    test("title becomes a heading above the content", () => {
        const container = tagContainer({name: "t", title: "Hello", content: "Body"}) as unknown as Container;
        expect(container.components.map(c => c.content)).toEqual(["# Hello", "Body"]);
    });

    test("no title means no heading", () => {
        const container = tagContainer({name: "t", content: "Body"}) as unknown as Container;
        expect(container.components.map(c => c.content)).toEqual(["Body"]);
    });

    test("a thumbnail wraps the text in a section", () => {
        const container = tagContainer({name: "t", content: "Body", thumbnailUrl: "https://x/y.png"}) as unknown as Container;
        expect(container.components[0]?.type).toBe(SECTION);
        expect(container.components[0]?.accessory).toMatchObject({type: THUMBNAIL});
    });

    test("the modal has the three expected fields and titles itself by intent", () => {
        expect(updateTagModal({name: "t"}).title).toBe("Create Tag: t");
        expect(updateTagModal({name: "t", content: "c"}).title).toBe("Update Tag: t");
        expect(updateTagModal({name: "t"}).components).toHaveLength(3);
    });
});
