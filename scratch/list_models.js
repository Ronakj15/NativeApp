const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  try {
    const result = await genAI.listModels();
    console.log("Available models:");
    result.models.forEach((m) => {
      console.log(`- ${m.name} (${m.displayName})`);
    });
  } catch (err) {
    console.error("Error listing models:", err.message);
  }
}

listModels();
