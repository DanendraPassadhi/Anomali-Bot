const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const activeSessions = new Map(); // Untuk menyimpan sesi tanya jawab aktif
async function fileToGenerativePart(attachment) {
  const response = await fetch(attachment.url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return {
    inlineData: {
      data: base64,
      mimeType: attachment.contentType,
    },
  };
}

// Fungsi untuk mengekstrak metadata
async function extractMetadata(imagePart) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Analyze this image and provide metadata suitable for stock photo platforms like Shutterstock. 
    Provide response in valid JSON format with the following structure:
    {
        "title": "descriptive and engaging title (maximum 100 characters)",
        "description": "detailed image description (maximum 500 characters)",
        "keywords": ["keyword1", "keyword2", "keyword3", "etc"] (maximum 50 relevant and searchable keywords), 
        "category": "main category (People, Business, Technology, Nature, Food, Travel, Abstract, Animals, Architecture, Sports, Medical, Education, Holiday, Transportation, Arts, Fashion, Industrial, etc.)",
        "subcategory": "more specific subcategory",
        "quality_score": "quality score 1-10 based on composition, lighting, and clarity",
        "suggestions": "suggestions to improve photo marketability (in indonesian)"
    }
    
    Ensure:
    - Keywords minimum 10-15 relevant and searchable keywords
    - Title is engaging and SEO-friendly
    - Description is informative and clearly describes the image
    - All fields are filled appropriately
    - Response must be in valid JSON format
    `;

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid JSON response from Gemini");
    }
  } catch (error) {
    console.error("Error extracting metadata:", error);
    throw error;
  }
}

// Fungsi untuk OCR gambar
async function performOCR(imagePart) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Extract all text from this image. Please provide only the extracted text content without any additional formatting or explanations.
    If there are multiple text blocks, separate them with line breaks.
    If the text quality is poor, do your best to interpret it.
    Only return the actual text content found in the image.
  `;

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error performing OCR:", error);
    throw error;
  }
}

// Fungsi untuk chat bot
async function chatWithAI(message, conversationHistory = []) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const context =
      conversationHistory.length > 0
        ? `Previous conversation:\n${conversationHistory.join(
            "\n"
          )}\n\nCurrent message: ${message}`
        : message;

    const result = await model.generateContent(context);
    const response = await result.response;
    let reply = response.text();

    // Batasi output maksimal 2000 karakter (batas Discord)
    if (reply.length > 2000) {
      reply = reply.substring(0, 1997) + "...";
    }

    return reply;
  } catch (error) {
    console.error("Error in AI chat:", error);
    throw error;
  }
}

// Fungsi untuk membuat embed metadata
function createMetadataEmbed(metadata, imageUrl) {
  const embed = new EmbedBuilder()
    .setTitle("📸 Hasil Metadata")
    .setColor("#00ff00")
    .setImage(imageUrl)
    .setTimestamp();

  embed.addFields(
    { name: "🏷️ Title", value: metadata.title || "N/A", inline: false },
    {
      name: "📝 Description",
      value: metadata.description
        ? metadata.description.length > 1024
          ? metadata.description.substring(0, 1021) + "..."
          : metadata.description
        : "N/A",
      inline: false,
    },
    { name: "📂 Category", value: metadata.category || "N/A", inline: true },
    {
      name: "📁 Subcategory",
      value: metadata.subcategory || "N/A",
      inline: true,
    },
    {
      name: "⭐ Quality Score",
      value: metadata.quality_score?.toString() || "N/A",
      inline: true,
    }
  );

  if (metadata.keywords && metadata.keywords.length > 0) {
    const keywordsText = metadata.keywords.join(", ");
    embed.addFields({
      name: "🔍 Keywords",
      value:
        keywordsText.length > 1024
          ? keywordsText.substring(0, 1021) + "..."
          : keywordsText,
      inline: false,
    });
  }

  if (metadata.suggestions) {
    embed.addFields({
      name: "💡 Suggestions",
      value:
        metadata.suggestions.length > 1024
          ? metadata.suggestions.substring(0, 1021) + "..."
          : metadata.suggestions,
      inline: false,
    });
  }

  return embed;
}

// Fungsi generate prompt AI dari gambar
async function generateArtPrompt(imagePart) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `
    Analyze this image and generate a detailed, creative, and vivid English prompt suitable for AI art generators (such as Midjourney, DALL-E, or Stable Diffusion).
    The prompt should:
    - Describe the main subject, style, mood, colors, and any notable details
    - Be concise but evocative (max 300 characters)
    - Use English only
    - Do not mention "image" or "photo" or "picture"
    - Example: "A serene mountain landscape at sunrise, vibrant colors, misty valleys, cinematic lighting, ultra-realistic, 8k"
    Output only the prompt, nothing else.
  `;
  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating art prompt:", error);
    throw error;
  }
}

// Fungsi generate prompt AI dari teks
async function generateArtPromptFromText(description) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `
    Based on the following description, generate a detailed, creative, and vivid English prompt suitable for AI art generators (such as Midjourney, DALL-E, or Stable Diffusion).
    The prompt should:
    - Describe the main subject, style, mood, colors, and any notable details
    - Be concise but evocative (max 300 characters)
    - Use English only
    - Do not mention "image" or "photo" or "picture"
    - Example: "A serene mountain landscape at sunrise, vibrant colors, misty valleys, cinematic lighting, ultra-realistic, 8k"
    Output only the prompt, nothing else.
    Description: ${description}
  `;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating art prompt from text:", error);
    throw error;
  }
}

// Fungsi translate ke bahasa Indonesia
async function translateToIndonesian(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Translate the following text to Indonesian. Only output the translation, nothing else.\n\n${text}`;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error translating to Indonesian:", error);
    throw error;
  }
}

// Fungsi generate caption AI dari gambar
const CaptionLang = { ID: "id", EN: "en" };
async function generateCaption(imagePart, language = CaptionLang.ID) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  let prompt;
  if (language === CaptionLang.EN) {
    prompt = `\n      Analyze this image and create a catchy, creative, and relevant caption for Instagram, TikTok, or other social media.\n      Respond in valid JSON format with this structure:\n      {\n        "caption": "caption text (max 200 chars)",\n        "hashtags": ["hashtag1", "hashtag2", ...] (min 20, max 30, no # symbol),\n        "suggestions": "optional suggestions to improve engagement (in English)"\n      }\n      - Caption: casual, inspiring, or funny English, no mention of 'image' or 'photo'.\n      - Hashtags: minimum 20, maximum 30, only relevant, popular, and short.\n      - Suggestions: optional, can be empty.\n      - Output only valid JSON, no explanation.\n    `;
  } else {
    prompt = `\n      Analisa gambar ini dan buatkan caption yang menarik, kreatif, dan relevan untuk diposting di Instagram, TikTok, atau sosial media lainnya.\n      Jawab dalam format JSON valid dengan struktur:\n      {\n        "caption": "teks caption (maks 200 karakter)",\n        "hashtags": ["hashtag1", "hashtag2", ...] (minimal 20, maksimal 30, tanpa tanda #),\n        "suggestions": "opsional, saran untuk meningkatkan engagement (dalam bahasa Indonesia)"\n      }\n      - Caption: bahasa Indonesia santai, inspiratif/lucu, tidak menyebut kata 'gambar' atau 'foto'.\n      - Hashtag: minimal 20, maksimal 30, hanya yang relevan, populer, dan singkat.\n      - Suggestions: opsional, boleh kosong.\n      - Output hanya JSON valid, tanpa penjelasan.\n    `;
  }
  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid JSON response from Gemini");
    }
  } catch (error) {
    console.error("Error generating caption:", error);
    throw error;
  }
}

async function generateCaptionFromText(text, language = CaptionLang.ID) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  let prompt;
  if (language === CaptionLang.EN) {
    prompt = `\n      Based on the following description, create a catchy, creative, and relevant caption for Instagram, TikTok, or other social media.\n      Respond in valid JSON format with this structure:\n      {\n        "caption": "caption text (max 200 chars)",\n        "hashtags": ["hashtag1", "hashtag2", ...] (min 20, max 30, no # symbol),\n        "suggestions": "optional suggestions to improve engagement (in English)"\n      }\n      - Caption: casual, inspiring, or funny English, no mention of 'image' or 'photo'.\n      - Hashtags: minimum 20, maximum 30, only relevant, popular, and short.\n      - Suggestions: optional, can be empty.\n      - Output only valid JSON, no explanation.\n      Description: ${text}\n    `;
  } else {
    prompt = `\n      Berdasarkan deskripsi berikut, buatkan caption dan hashtag untuk Instagram/TikTok. Output hanya caption dan hashtag, tanpa penjelasan. Deskripsi: ${text}\n      Jawab dalam format JSON valid dengan struktur:\n      {\n        "caption": "teks caption (maks 200 karakter)",\n        "hashtags": ["hashtag1", "hashtag2", ...] (minimal 20, maksimal 30, tanpa tanda #),\n        "suggestions": "opsional, saran untuk meningkatkan engagement (dalam bahasa Indonesia)"\n      }\n      - Caption: bahasa Indonesia santai, inspiratif/lucu, tidak menyebut kata 'gambar' atau 'foto'.\n      - Hashtag: minimal 20, maksimal 30, hanya yang relevan, populer, dan singkat.\n      - Suggestions: opsional, boleh kosong.\n      - Output hanya JSON valid, tanpa penjelasan.\n    `;
  }
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid JSON response from Gemini");
    }
  } catch (error) {
    console.error("Error generating caption from text:", error);
    throw error;
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Mulai sesi tanya jawab dengan AI"),
  new SlashCommandBuilder()
    .setName("end")
    .setDescription("Akhiri sesi tanya jawab dengan AI"),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Tampilkan bantuan bot"),
  new SlashCommandBuilder().setName("ping").setDescription("Cek respons bot"),
  new SlashCommandBuilder()
    .setName("generate")
    .setDescription("Membuat prompt AI Art dari teks")
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Describe the scene, style, mood, etc.")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("caption")
    .setDescription("Buat caption sosial media dari deskripsi teks saja")
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription(
          "Deskripsi atau ide caption (dalam bahasa Indonesia/Inggris)"
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Pilih bahasa output caption")
        .addChoices(
          { name: "Indonesia", value: "id" },
          { name: "Inggris", value: "en" }
        )
        .setRequired(true)
    ),
];

client.once("ready", async () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
  );

  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;

  switch (commandName) {
    case "start":
      const sessionKey = `${guildId}-${interaction.user.id}`;
      if (activeSessions.has(sessionKey)) {
        await interaction.reply(
          "⚠️ Anda sudah memiliki sesi aktif. Gunakan `/end` untuk mengakhiri sesi sebelumnya."
        );
        return;
      }

      activeSessions.set(sessionKey, {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        history: [],
        startTime: Date.now(),
      });

      await interaction.reply(
        "🤖 Sesi tanya jawab dimulai! Sekarang Anda bisa bertanya apa saja. Gunakan `/end` untuk mengakhiri sesi."
      );
      break;

    case "end":
      const endSessionKey = `${guildId}-${interaction.user.id}`;
      if (!activeSessions.has(endSessionKey)) {
        await interaction.reply("❌ Anda tidak memiliki sesi aktif.");
        return;
      }

      const session = activeSessions.get(endSessionKey);
      const duration = Math.floor((Date.now() - session.startTime) / 1000);
      activeSessions.delete(endSessionKey);

      await interaction.reply(
        `✅ Sesi tanya jawab berakhir. Durasi: ${duration} detik. Total pesan: ${session.history.length}`
      );
      break;

    case "help":
      const helpEmbed = new EmbedBuilder()
        .setTitle("🤖 Anomali Bot")
        .setDescription(
          "Bot ini memiliki berbagai fitur AI yang dapat membantu Anda."
        )
        .setColor("#0099ff")
        .addFields(
          {
            name: "💬 AI Chat Commands",
            value:
              "• `/start` - Mulai sesi tanya jawab\n• `/end` - Akhiri sesi tanya jawab\n• Kirim pesan biasa saat sesi aktif",
            inline: false,
          },
          {
            name: "📸 Image Processing",
            value:
              "• `.metadata` + upload gambar - Extract metadata untuk stock photos\n• `.ocr` + upload gambar - Extract teks dari gambar\n• `.generate` + upload gambar - Extract gambar menjadi prompt",
            inline: false,
          },
          {
            name: "📱 Auto Caption",
            value:
              "• `/caption` - Buat caption dari deskripsi teks (bisa pilih output Indonesia/Inggris)\n• `.caption` + upload gambar - Buat caption sosial media dari gambar (tambahkan 'id' atau 'en' untuk bahasa)",
            inline: false,
          },
          {
            name: "📃 Generate Prompt",
            value:
              "• `/generate` - Membuat prompt sesuai deskripsi\n• `.generate` + upload gambar - Extract gambar menjadi prompt",
            inline: false,
          },
          {
            name: "🔧 Cara Penggunaan",
            value:
              "• **Metadata**: Ketik `.metadata` lalu upload gambar\n• **OCR**: Ketik `.ocr` lalu upload gambar\n• **AI Chat**: Gunakan `/start` untuk memulai percakapan\n• **Generate Prompt**: Gunakan `/generate` atau `.generate` untuk membuat prompt",
            inline: false,
          },
          {
            name: "📋 Format Gambar",
            value: "Mendukung: JPG, PNG, GIF, WebP, dan format gambar lainnya",
            inline: false,
          }
        )
        .setFooter({ text: "Powered by Gemini AI 2.5-Flash" })
        .setTimestamp();

      await interaction.reply({ embeds: [helpEmbed] });
      break;

    case "ping": {
      const sent = await interaction.reply({
        content: "🏓 Pong!",
        fetchReply: true,
      });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply(`🏓 Pong! \n\nLatency: ${latency}ms`);
      break;
    }

    case "generate": {
      const description = interaction.options.getString("description");
      await interaction.reply(
        "🎨 Generating AI Art prompt from your description..."
      );
      try {
        const artPrompt = await generateArtPromptFromText(description);
        const translation = await translateToIndonesian(artPrompt);
        const formatted = `🖼️ **AI Art Prompt**\n\n\`\`\`${artPrompt}\`\`\`\n**Terjemahan Bahasa Indonesia:**\n\`\`\`${translation}\`\`\``;
        await interaction.editReply(formatted);
      } catch (error) {
        await interaction.editReply(
          "❌ Failed to generate AI Art prompt. Please try again."
        );
      }
      break;
    }

    case "caption": {
      const description = interaction.options.getString("description");
      const lang = interaction.options.getString("language") || CaptionLang.ID;
      await interaction.reply("✍️ Membuat caption dari deskripsi Anda...");
      try {
        let captionData;
        let rawText = null;
        try {
          captionData = await generateCaptionFromText(description, lang);
        } catch (err) {
          if (err.message && err.message.includes("Invalid JSON response")) {
            const model = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
            });
            const prompt =
              lang === CaptionLang.EN
                ? `Based on the following description, create a catchy, creative, and relevant caption for Instagram, TikTok, or other social media. Output only the caption and hashtags, no explanation. Description: ${description}`
                : `Berdasarkan deskripsi berikut, buatkan caption dan hashtag untuk Instagram/TikTok. Output hanya caption dan hashtag, tanpa penjelasan. Deskripsi: ${description}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            rawText = response.text();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                captionData = JSON.parse(jsonMatch[0]);
              } catch (e) {

              }
            }
          } else {
            throw err;
          }
        }
        if (captionData) {
          let output = `✍️ *Caption:*
\`\`\`
${captionData.caption || "-"}
\`\`\``;
          if (captionData.hashtags && captionData.hashtags.length > 0) {
            output += `\n\n#️⃣ *Hashtags:*
\`\`\`
${captionData.hashtags.map((h) => `#${h}`).join(" ")}
\`\`\``;
          }
          if (captionData.suggestions) {
            output += `\n\n💡 *Saran:*
\`\`\`
${captionData.suggestions}
\`\`\``;
          }
          let fallbackMsg = rawText
            ? `\n\n⚠️ Hasil mentah AI:\n\`\`\`${rawText}\`\`\``
            : "";
          await interaction.editReply({ content: output + fallbackMsg });
        } else if (rawText) {
          const lines = rawText.split(/\r?\n/).filter((l) => l.trim() !== "");
          let caption = lines[0] || "";
          let hashtags = [];
          for (let i = 1; i < lines.length; i++) {
            hashtags.push(
              ...lines[i].split(/\s+/).filter((w) => w.startsWith("#"))
            );
          }
          if (hashtags.length === 0) {
            hashtags = rawText.match(/#\w+/g) || [];
          }
          let output = `✍️ *Caption:*
${caption}`;
          if (hashtags.length > 0) {
            output += `\n\n#️⃣ *Hashtags:*
${hashtags.join(" ")}`;
          }
          await interaction.editReply({
            content: `⚠️ Gagal parsing JSON dari AI. Berikut hasil fallback:\n\n${output}\n\n\`\`\`${rawText}\`\`\``,
          });
        } else {
          await interaction.editReply(
            "❌ Gagal membuat caption. Silakan coba lagi."
          );
        }
      } catch (error) {
        await interaction.editReply(
          "❌ Gagal membuat caption. Silakan coba lagi."
        );
      }
      break;
    }
  }
});

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  const guildId = message.guild?.id;
  if (!guildId) return;

  const content = message.content.toLowerCase().trim();

  const sessionKey = `${guildId}-${message.author.id}`;
  const session = activeSessions.get(sessionKey);

  if (
    session &&
    !content.startsWith(".metadata") &&
    !content.startsWith(".ocr") &&
    !content.startsWith(".generate") &&
    !content.startsWith(".caption")
  ) {
    try {
      const loadingMessage = await message.reply("🤔 Sedang berpikir...");

      const aiResponse = await chatWithAI(message.content, session.history);
      session.history.push(`User: ${message.content}`);
      session.history.push(`AI: ${aiResponse}`);

      if (session.history.length > 20) {
        session.history = session.history.slice(-20);
      }

      const maxLength = 2000;
      const truncatedResponse =
        aiResponse.length > maxLength
          ? aiResponse.substring(0, maxLength) +
            "...\n\n*[Response truncated due to length]*"
          : aiResponse;

      await loadingMessage.edit(truncatedResponse);
    } catch (error) {
      console.error("Error in AI chat:", error);
      await message.reply(
        "❌ Terjadi kesalahan saat berkomunikasi dengan AI. Coba lagi nanti."
      );
    }
    return;
  }

  if (content.startsWith(".metadata")) {
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();

      if (
        attachment.contentType &&
        attachment.contentType.startsWith("image/")
      ) {
        try {
          const loadingMessage = await message.reply(
            "🔄 Sedang menganalisis gambar, mohon tunggu sebentar..."
          );

          const imagePart = await fileToGenerativePart(attachment);
          const metadata = await extractMetadata(imagePart);
          const embed = createMetadataEmbed(metadata, attachment.url);

          await loadingMessage.edit({ content: "", embeds: [embed] });
        } catch (error) {
          console.error("Error processing metadata:", error);
          await message.reply(
            "❌ Terjadi kesalahan saat memproses metadata. Pastikan gambar valid dan coba lagi."
          );
        }
      } else {
        await message.reply(
          "⚠️ Silakan upload file gambar (JPG, PNG, GIF, WebP, etc.) untuk dianalisis metadata."
        );
      }
    } else {
      await message.reply(
        "⚠️ Silakan upload gambar bersama dengan command `.metadata`"
      );
    }
    return;
  }

  if (content.startsWith(".ocr")) {
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();

      if (
        attachment.contentType &&
        attachment.contentType.startsWith("image/")
      ) {
        try {
          const loadingMessage = await message.reply(
            "🔄 Mengekstrak teks dari gambar... Mohon tunggu sebentar."
          );

          const imagePart = await fileToGenerativePart(attachment);
          const ocrResult = await performOCR(imagePart);

          const formattedResult = `🔍 **OCR Text Extraction**\n\n\`\`\`\n${ocrResult}\n\`\`\``;

          const maxLength = 2000;
          const finalResult =
            formattedResult.length > maxLength
              ? `🔍 **OCR Text Extraction**\n\n\
${ocrResult.substring(0, maxLength - 100)}\n\
\`\`\`\n\n*[Text truncated due to length]*`
              : formattedResult;

          await loadingMessage.edit(finalResult);
        } catch (error) {
          console.error("Error processing OCR:", error);
          await message.reply(
            "❌ Terjadi kesalahan saat melakukan OCR. Coba lagi nanti."
          );
        }
      } else {
        await message.reply(
          "⚠️ Silakan upload file gambar (JPG, PNG, GIF, WebP, etc.) untuk melakukan OCR."
        );
      }
    } else {
      await message.reply(
        "⚠️ Silakan upload gambar bersama dengan command `.ocr`"
      );
    }
    return;
  }

  if (content.startsWith(".generate")) {
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (
        attachment.contentType &&
        attachment.contentType.startsWith("image/")
      ) {
        try {
          const loadingMessage = await message.reply("🎨 Generating prompt...");
          const imagePart = await fileToGenerativePart(attachment);
          const artPrompt = await generateArtPrompt(imagePart);
          const translation = await translateToIndonesian(artPrompt);

          const formatted = `🖼️ **AI Art Prompt**\n\n\`\`\`${artPrompt}\`\`\`\n**Terjemahan Bahasa Indonesia:**\n\`\`\`${translation}\`\`\``;
          await loadingMessage.edit(formatted);
        } catch (error) {
          console.error("Error generating art prompt:", error);
          await message.reply(
            "❌ Failed to generate AI Art prompt. Please try again with a valid image."
          );
        }
      } else {
        await message.reply(
          "⚠️ Please upload an image file (JPG, PNG, GIF, WebP, etc.) with the .generate command."
        );
      }
    } else {
      await message.reply(
        "⚠️ Please upload an image together with the .generate command."
      );
    }
    return;
  }

  function createCaptionEmbed(captionData, imageUrl) {
    const embed = new EmbedBuilder()
      .setTitle("📱 Auto Caption")
      .setColor("#ffb347")
      .setImage(imageUrl)
      .setTimestamp();

    embed.addFields(
      {
        name: "✍️ Caption",
        value: captionData.caption || "N/A",
        inline: false,
      },
      {
        name: "#️⃣ Hashtags",
        value:
          captionData.hashtags && captionData.hashtags.length > 0
            ? captionData.hashtags.map((h) => `#${h}`).join(" ")
            : "N/A",
        inline: false,
      }
    );
    if (captionData.suggestions) {
      embed.addFields({
        name: "💡 Saran",
        value: captionData.suggestions,
        inline: false,
      });
    }
    return embed;
  }

  if (content.startsWith(".caption")) {

    let lang = CaptionLang.ID;
    if (content.startsWith(".caption en")) lang = CaptionLang.EN;
    if (content.startsWith(".caption id")) lang = CaptionLang.ID;
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (
        attachment.contentType &&
        attachment.contentType.startsWith("image/")
      ) {
        try {
          const loadingMessage = await message.reply(
            "✍️ Membuat caption dari gambar..."
          );
          const imagePart = await fileToGenerativePart(attachment);
          const captionData = await generateCaption(imagePart, lang);
          const embed = createCaptionEmbed(captionData, attachment.url);
          await loadingMessage.edit({ content: "", embeds: [embed] });
        } catch (error) {
          console.error("Error generating caption:", error);
          await message.reply(
            "❌ Gagal membuat caption. Silakan coba lagi dengan gambar yang valid."
          );
        }
      } else {
        await message.reply(
          "⚠️ Silakan upload file gambar (JPG, PNG, GIF, WebP, dll) bersama perintah .caption."
        );
      }
    } else {
      await message.reply(
        "⚠️ Silakan upload gambar bersama dengan command .caption"
      );
    }
    return;
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
