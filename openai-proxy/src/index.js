/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import OpenAI from "openai";

export default {


	async fetch(request, env) {
	  const openai = new OpenAI({
		apiKey: env.OPENAI_API_KEY,
		baseURL:
		  "https://gateway.ai.cloudflare.com/v1/4c6978cc2955d7ac74d9de5b674f23c3/openai-proxy/openai" // paste your AI Gateway endpoint here
	  });
	  console.log(openai)

	  try {
		// Parse the request body
		const requestData = await request.json();
		const prompt = requestData.prompt;
		
		if (!prompt) {
		  return new Response(JSON.stringify({ error: "Prompt is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		  });
		}


		const chatCompletion = await openai.chat.completions.create({
		  model: "gpt-4o-mini",
		  messages: prompt,
		  max_tokens: 500,
		  echo: false,
		});
  
		const response = chatCompletion.choices[0].message;
  
		return new Response(JSON.stringify(response));
	  } catch (error) {
		return new Response(error);
	  }
	},
  };
