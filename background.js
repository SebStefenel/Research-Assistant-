chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === "summarize") {
    const { url, query } = request;
    console.log("Received summarize request for:", url, "with query:", query);

    fetch(url)
      .then(res => {
        console.log("Fetch response status:", res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.text();
      })
      .then(html => {
        console.log("HTML fetched, length:", html.length);
        const text = html.replace(/<[^>]*>?/gm, "").slice(0, 4000);
        console.log("Text extracted, length:", text.length);
        return summarizeWithTogether(text, query);
      })
      .then(summary => {
        console.log("Summary generated:", summary.substring(0, 100) + "...");
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "displaySummary",
            summary: summary,
            url: url
          });
        } else {
          console.error("Sender tab is undefined.");
        }
      })
      .catch(err => {
        console.error("Summarization failed", err);
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "displaySummary",
            summary: "Error: Failed to summarize. Please try again.",
            url: url
          });
        }
      });
  }
});

async function summarizeWithTogether(text, query) {
  const TOGETHER_API_KEY = "e338fa9f9a17065ad19317716e44a1d73d4a2e0283a13cfece8b7f037e92c7c8";

  const prompt = `Query: "${query}". Article: """${text}"""\n\n in 3 sentances Summarize the article and explain how it answers the query.`;

  const body = {
    model: "deepseek-ai/DeepSeek-V3",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };

  try {
    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOGETHER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("Invalid API response structure");
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}
