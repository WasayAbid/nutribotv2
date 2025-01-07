"use client";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
} from "@google/generative-ai";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { Send, ImageIcon } from "lucide-react";
import { Montserrat } from "next/font/google";
import Image from "next/image";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["700"] });

const MODEL_NAME = "gemini-2.0-flash-exp";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export default function ChatInterface() {
  const [messages, setMessages] = useState<
    {
      role: "user" | "model";
      content: string;
      imageUrl?: string;
    }[]
  >([{ role: "user", content: "" }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [streamMessageData, setStreamMessageData] = useState("");
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [initialModelMessage, setInitialModelMessage] = useState<{
    role: "user" | "model";
    content: string;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

  const systemPrompt = `You are a helpful nutritional specialist named NutriBot. Your main role is to provide nutritional guidance, answer questions about diet, food, and overall wellness,gym,exercise,workout and offer healthy eating and gym advice. You must not engage in topics that are not related to nutrition, health, and wellness,gym,exercise. If asked an irrelevant question respond with "I am only here to assist with nutritional questions." in differnt ways. Keep your responses concise and helpful.`;

  useEffect(() => {
    if (messages.length === 1 && isFirstRender) {
      setTimeout(() => {
        setInitialModelMessage({
          role: "model",
          content:
            "Hi there! I'm NutriBot. How can I help you with your nutrition today?",
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

  async function sendMessage(newMessage: string, image?: File | null) {
    if (!newMessage.trim() && !image) return;

    const userMessage: {
      role: "user";
      content: string;
      imageUrl?: string;
    } = {
      role: "user",
      content: newMessage,
    };
    if (image && imagePreviewUrl) {
      userMessage.imageUrl = imagePreviewUrl;
    }

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    // Clear input after send
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
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
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        ...messages.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
      ],
    });
    try {
      const parts: Part[] = [{ text: newMessage }];

      if (image) {
        const base64Image = await toBase64(image);
        parts.push({
          inlineData: {
            mimeType: image.type,
            data: base64Image.split(",")[1],
          },
        });
      }
      const result = await chat.sendMessageStream(parts);
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImage(null);
      setImagePreviewUrl(null);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isLoading) {
      sendMessage(input, selectedImage);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoading) {
      sendMessage(input, selectedImage);
    }
  };

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#dcfce7]">
      {/* Header Section */}
      <header className="w-full max-w-3xl bg-white rounded-t-xl shadow-2xl p-4 flex justify-between items-center">
        <div className="flex items-center">
          <Image
            src="/images/x.jpg" // Path to your icon
            alt="Website Icon"
            width={100} // Adjust as needed
            height={100} // Adjust as needed
            className="mr-2" // Add some spacing
          />
          <div className="flex flex-col">
            <h1
              className={`text-3xl text-[#34d399] ${montserrat.className} drop-shadow-md`}
            >
              NutriBot
            </h1>
            <p className="text-sm text-[#6b7280] mt-1">
              Here to guide your nutrition journey.
            </p>
          </div>
        </div>
      </header>
      {/* Chat Interface */}
      <div className="flex flex-col w-full max-w-3xl h-[80vh] bg-white rounded-b-xl shadow-2xl overflow-hidden relative">
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto px-6 pt-8 pb-16 rounded-t-lg"
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
                {message.imageUrl && (
                  <div className="mt-2">
                    {
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.imageUrl}
                        alt="uploaded image"
                        className="max-h-40 w-auto rounded-md shadow-md"
                      />
                    }
                  </div>
                )}
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
        <form
          onSubmit={handleSubmit}
          className="flex items-center border-t-2 border-[#e2e8f0] pt-4 bg-white p-4 absolute bottom-0 left-0 w-full"
        >
          <label htmlFor="image-input" className="mr-2 cursor-pointer">
            <ImageIcon
              size={24}
              className="text-gray-500 hover:text-gray-700 transition"
            />
          </label>
          <input
            type="file"
            id="image-input"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            ref={imageInputRef} // added the ref
          />

          {imagePreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreviewUrl}
              alt="Preview"
              className="max-w-[50px] max-h-[50px] rounded-md mr-2 shadow-md"
            />
          )}

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
      <footer className="mt-4 text-center text-xs text-[#9ca3af]">
        Made by Abdul Wasay Abid
      </footer>
    </main>
  );
}
