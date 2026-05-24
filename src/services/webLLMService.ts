export class WebLLMService {
  private isModelLoaded = true;

  async loadModel(onProgress?: (progress: number, message: string) => void): Promise<void> {
    // No local loading required, we will call an API
    if (onProgress) {
      onProgress(1, "Ready");
    }
    return Promise.resolve();
  }

  async generateStream(
    messages: { role: string; content: string }[],
    onUpdate: (content: string) => void,
    systemPrompt?: string,
    apiKey?: string | null,
    model?: string
  ) {
    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: "system", content: systemPrompt });
    }
    
    messages.forEach((msg) => {
      formattedMessages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    try {
      const payloadString = JSON.stringify({
        messages: formattedMessages,
        apiKey: apiKey,
        model: model
      });

      console.log(`Sending /api/generate-code payload: ${payloadString.length} bytes`);

      const response = await fetch("/api/generate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payloadString,
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const text = await response.text();
          try {
            errorData = JSON.parse(text);
          } catch (e) {
            errorData = { error: text || "Network error or invalid server response." };
          }
        } catch (e) {
          errorData = { error: "Failed to read error response." };
        }
        throw new Error(errorData.error || "Failed to connect to AI server");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      if (!reader) {
        throw new Error("Failed to get stream reader");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              buffer = "";
              break;
            }
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error("STREAM_API_ERROR: " + parsed.error);
              }
              if (parsed.content) {
                fullText += parsed.content;
                onUpdate(fullText);
              }
            } catch (e: any) {
              if (e.message && e.message.startsWith("STREAM_API_ERROR: ")) {
                throw new Error(e.message.replace("STREAM_API_ERROR: ", ""));
              }
              console.warn("Error parsing SSE data", e, data);
            }
          }
        }
      }

      return fullText;

    } catch (error: any) {
      console.error("AI Generation Error:", error);
      throw new Error(`Gagal menghubungi layanan AI: ${error.message || "Unknown Error"}`);
    }
  }

  getIsLoaded() {
    return this.isModelLoaded;
  }
}

export const webLLMService = new WebLLMService();
