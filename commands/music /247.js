const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { reply } = require("../../utils/commandRunner");
const embeds = require("../../utils/embeds");
const emoji = require("../../emojis/musicemoji");
const { fromConnection: TwentyFourSeven } = require("../../models/TwentyFourSeven");

module.exports = {
  name: "247",
  description: "Toggle 24/7 mode (Admin only).",
  category: "music",
  aliases: ["tf", "twentyfourseven"],
  usage: "",
  cooldown: 3,
  ownerOnly: false,
  devOnly: false,
  requiresDatabase: true,
  slash: true,

  slashData: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Toggle 24/7 mode — bot stays in VC all day. (Admin only)")
    .toJSON(),

  async execute(client, ctx) {
    const guild = ctx.type === "prefix" ? ctx.message.guild : ctx.interaction.guild;
    const member = ctx.type === "prefix" ? ctx.message.member : ctx.interaction.member;
    const channel = ctx.type === "prefix" ? ctx.message.channel : ctx.interaction.channel;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply(ctx, {
        embeds: [embeds.error("Only server **Administrators** can toggle 24/7 mode.")]
      });
    }

    const guildDb = await client.db.getGuildDb(guild.id);
    if (!guildDb || guildDb.isDown) {
      return reply(ctx, {
        embeds: [embeds.clusterDown(guildDb?.clusterName)]
      });
    }

    const TFModel = TwentyFourSeven(guildDb.connection);
    const current = await TFModel.findOne({ guildId: guild.id });
    const newState = !(current?.enabled ?? false);

    await TFModel.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          enabled: newState,
          channelId: member.voice.channel?.id ?? current?.channelId ?? null,
        },
      },
      { upsert: true }
    );

    // دخول البوت تلقائياً عند التفعيل
    if (newState) {
      if (!member.voice.channel) {
        return reply(ctx, {
          embeds: [embeds.error("You must join a voice channel first.")]
        });
      }

      try {
        client.riffy.createConnection({
          guildId: guild.id,
          voiceChannel: member.voice.channel.id,
          textChannel: channel.id,
          deaf: true,
        });
      } catch (err) {
        console.error(err);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x4A3F5F)
      .setTitle(`${emoji.tf} 24/7 Mode`)
      .setDescription(
        newState
          ? "24/7 mode **enabled**. I joined your voice channel and will stay connected."
          : "24/7 mode **disabled**."
      )
      .setTimestamp();

    return reply(ctx, { embeds: [embed] });
  },
};
