import { getLiveGeminiClient } from "./client.ts";
import { GENIE_MODEL } from "../../../shared/models.ts";

export async function createGenieSession(): Promise<{
  interactionId: string;
  authToken: string;
}> {
  const genieAi = getLiveGeminiClient();
  const interaction = await genieAi.interactions.create({
    model: GENIE_MODEL,
    api_version: "v1beta",
  });
  const tokenResp = await genieAi.interactions.authTokens.create(
    interaction.id,
    { api_version: "v1beta" }
  );
  if (!tokenResp.auth_token) {
    throw new Error("Failed to mint ephemeral auth token for Genie 4.");
  }
  return {
    interactionId: interaction.id,
    authToken: tokenResp.auth_token,
  };
}
