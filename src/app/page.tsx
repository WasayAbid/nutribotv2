"use client";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { Send } from "lucide-react";
import { Montserrat } from "next/font/google"; // Import the Montserrat font

const montserrat = Montserrat({ subsets: ["latin"], weight: ["700"] }); // Load Montserrat font

const MODEL_NAME = "gemini-2.0-flash-exp";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export default function ChatInterface() {
  const [messages, setMessages] = useState([{ role: "user", content: "" }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [streamMessageData, setStreamMessageData] = useState("");
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [initialModelMessage, setInitialModelMessage] = useState<{
    role: "user" | "model";
    content: string;
  } | null>(null);

  useEffect(() => {
    if (messages.length === 1 && isFirstRender) {
      setTimeout(() => {
        setInitialModelMessage({
          role: "model",
          content: "Hi there! I'm NutriBot. What can I help you with today?",
        });
        setIsFirstRender(false);
      }, 500);
    }

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isFirstRender]);

  async function sendMessage(newMessage: string) {
    if (!newMessage.trim()) return;

    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", content: newMessage },
    ]);
    setInput("");
    setIsLoading(true);
    setStreamMessageData("");

    const genAI = new GoogleGenerativeAI(API_KEY as string);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.5,
      topK: 1,
      topP: 1,
      maxOutputTokens: 1000,
    };

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    try {
      const result = await chat.sendMessageStream(newMessage);
      let text = "";
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const streamingDelay = 20;

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        text += chunkText;
        await delay(streamingDelay);
        setStreamMessageData(text);
      }
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "model",
          content: text,
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "model",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamMessageData("");
      setInitialModelMessage(null);
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isLoading) {
      sendMessage(input);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoading) {
      sendMessage(input);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#dcfce7]">
      {/* Main Chat Container */}
      <div className="flex flex-col w-full max-w-3xl h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden relative">
        {/* Adjusted Header Section */}
        <div className="absolute top-0 left-4 p-4 z-10">
          <h1
            className={`text-4xl text-[#34d399] ${montserrat.className} drop-shadow-md`}
          >
            NutriBot
          </h1>
          <p className="text-sm text-[#6b7280] mt-2">
            Here to guide your nutrition journey.
          </p>
        </div>

        {/* Chat Messages Container */}
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto px-6 pt-24 pb-16 rounded-t-lg"
        >
          {initialModelMessage && (
            <div className="mb-3 flex justify-start mt-2">
              <div className="max-w-sm p-3 rounded-lg shadow-md bg-[#f1f5f9] text-gray-700 text-sm">
                <Markdown>{initialModelMessage.content}</Markdown>
              </div>
            </div>
          )}
          {messages.slice(1).map((message, index) => (
            <div
              key={index}
              className={`mb-3 flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-sm p-3 rounded-lg shadow-md text-sm ${
                  message.role === "user"
                    ? "bg-[#34d399] text-white"
                    : "bg-[#f1f5f9] text-gray-700"
                }`}
              >
                <Markdown>{message.content}</Markdown>
              </div>
            </div>
          ))}
          {isLoading && streamMessageData && (
            <div className="mb-3 mt-2 flex justify-start">
              <div className="max-w-sm p-3 rounded-lg shadow-md bg-[#f1f5f9] text-gray-700 text-sm">
                <Markdown>{streamMessageData}</Markdown>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="text-left mb-3">
              <div className="inline-block p-2 rounded-lg bg-[#f1f5f9] text-gray-700 animate-pulse text-sm">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center border-t-2 border-[#e2e8f0] pt-4 bg-white p-4 absolute bottom-0 left-0 w-full"
        >
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Type your message..."
            className="flex-grow border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#34d399] text-gray-700 bg-[#f8fafc] shadow-sm text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="ml-2 bg-[#34d399] hover:bg-[#22c55e] text-white font-semibold py-3 px-5 rounded-md focus:outline-none focus:shadow-outline shadow-lg disabled:bg-gray-500 text-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </div>

      {/* Attribution Block */}
      <div className="mt-4 text-center text-xs text-[#9ca3af]">
        Made by Abdul Wasay Abid
      </div>
    </main>
  );
}
