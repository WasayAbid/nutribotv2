"use client";

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
} from "@google/generative-ai";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { 
  Send, 
  ImageIcon, 
  AlertCircle, 
  Apple, 
  Carrot, 
  Beef, 
  Fish,
  Utensils,
  Dumbbell,
  Heart,
  Info,
  X
} from "lucide-react";
import { Montserrat, Poppins } from "next/font/google";
import Image from "next/image";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["700"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export default function ChatInterface() {
  const [messages, setMessages] = useState<
    {
      role: "user" | "model";
      content: string;
      imageUrl?: string;
      mimeType?: string;
    }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [streamMessageData, setStreamMessageData] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const systemPrompt = `You are a helpful nutritional specialist named NutriBot. Your main role is to provide nutritional guidance, answer questions about diet, food, and overall wellness,gym,exercise,workout and offer healthy eating and gym advice. You must not engage in topics that are not related to food,fast food, fruits ,nutrition, health, and wellness,gym,exercise. If asked an irrelevant question respond with "I am only here to assist with nutritional questions." in differnt ways. Keep your responses in medium lenght.`;

  useEffect(() => {
    // Check if API key is available
    if (!API_KEY || API_KEY === "your_api_key_here") {
      setApiKeyMissing(true);
      setMessages([
        {
          role: "model",
          content: "⚠️ API Key is missing. Please add your Google Gemini API key to the .env.local file to use NutriBot.",
        },
      ]);
      return;
    }

    // Add the initial message *only once* when the component mounts.
    if (!hasSentFirstMessage && messages.length === 0) {
      setMessages([
        {
          role: "model",
          content:
            "Hi there! I'm NutriBot. How can I help you with your nutrition today?",
        },
      ]);
    }

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, hasSentFirstMessage]);

  async function sendMessage(newMessage: string, image?: File | null) {
    if (apiKeyMissing) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", content: newMessage },
        {
          role: "model",
          content: "⚠️ API Key is missing. Please add your Google Gemini API key to the .env.local file to use NutriBot.",
        },
      ]);
      return;
    }

    if (!newMessage.trim() && !image) return;

    setShowWelcome(false);

    let messageText = newMessage;
    if (!newMessage.trim() && image) {
      messageText = "User uploaded an image:";
    }

    const userMessage: {
      role: "user";
      content: string;
      imageUrl?: string;
      mimeType?: string;
    } = {
      role: "user",
      content: messageText,
    };

    if (image && imagePreviewUrl) {
      userMessage.imageUrl = imagePreviewUrl;
      userMessage.mimeType = image.type;
    }
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setIsLoading(true);
    setStreamMessageData("");

    try {
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

      if (!hasSentFirstMessage) {
        // First message: Use generateContentStream
        const parts: Part[] = [{ text: messageText }];
        if (image) {
          const base64Image = await toBase64(image);
          parts.push({
            inlineData: {
              mimeType: image.type,
              data: base64Image.split(",")[1],
            },
          });
        }

        const result = await model.generateContentStream({
          contents: [{ role: "user", parts }], // contents takes an array of role/parts
          generationConfig,
          safetySettings,
        });

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
          { role: "model", content: text },
        ]);
        setHasSentFirstMessage(true); // Mark first message as sent.

      } else {
        // Subsequent messages: Use startChat
        const chatHistory = [
          {
            role: "user",
            parts: [{ text: systemPrompt }],
          },
           ...messages.slice(0,-1).map((msg) => { // Slice to exclude the *current* user message
            const messageParts: Part[] = [{ text: msg.content }];
            if (msg.imageUrl && msg.mimeType) {
              messageParts.push({
                inlineData: {
                  mimeType: msg.mimeType,
                  data: msg.imageUrl.split(",")[1],
                },
              });
            }
            return { role: msg.role, parts: messageParts };
          }),
        ];

        const currentUserParts: Part[] = [{ text: messageText }];
        if (image) {
          const base64Image = await toBase64(image);
          currentUserParts.push({
            inlineData: {
              mimeType: image.type,
              data: base64Image.split(",")[1],
            },
          });
        }
        chatHistory.push({ //Add the current message to the history
          role: "user",
          parts: currentUserParts
        });

        const chat = model.startChat({
          generationConfig,
          safetySettings,
          history: chatHistory,
        });

        const result = await chat.sendMessageStream(currentUserParts);

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
          { role: "model", content: text },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "model",
          content: "Sorry, I encountered an error. Please check your API key and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamMessageData("");
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

  const quickPrompts = [
    "What should I eat before a workout?",
    "How can I improve my diet?",
    "What are healthy snack options?",
    "How much protein do I need daily?",
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#dcfce7] animate-gradient relative overflow-hidden">
      {/* Floating Food Icons */}
      <div className="food-icon food-icon-1">
        <Apple size={80} className="text-emerald-500" />
      </div>
      <div className="food-icon food-icon-2">
        <Carrot size={80} className="text-emerald-500" />
      </div>
      <div className="food-icon food-icon-3">
        <Beef size={80} className="text-emerald-500" />
      </div>
      <div className="food-icon food-icon-4">
        <Fish size={80} className="text-emerald-500" />
      </div>

      {/* Header Section */}
      <header className="w-full max-w-4xl bg-white rounded-t-xl shadow-2xl p-6 flex justify-between items-center glass-effect">
        <div className="flex items-center">
          <div className="w-[100px] h-[100px] bg-emerald-100 rounded-full flex items-center justify-center mr-4 animate-pulse-slow shadow-lg overflow-hidden">
            <Image 
              src="/images/x.jpg" 
              alt="NutriBot" 
              width={100} 
              height={100}
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <h1
              className={`text-4xl text-[#34d399] ${montserrat.className} drop-shadow-md`}
            >
              NutriBot
            </h1>
            <p className={`text-sm text-[#6b7280] mt-1 ${poppins.className}`}>
              Your personal nutrition assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {apiKeyMissing && (
            <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertCircle className="mr-1" size={16} />
              <span className="text-xs">API Key Missing</span>
            </div>
          )}
          <button 
            onClick={() => setShowInfoModal(true)}
            className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
          >
            <Info size={20} className="text-gray-600" />
          </button>
        </div>
      </header>

      <div className="flex flex-col w-full max-w-4xl h-[70vh] bg-white rounded-b-xl shadow-2xl overflow-hidden relative glass-effect">
        {/* Welcome Screen */}
        {showWelcome && messages.length <= 1 && !apiKeyMissing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-95 z-10 p-8 fade-in">
            <div className="animate-float mb-8 w-32 h-32 rounded-full overflow-hidden">
              <Image 
                src="/images/x.jpg" 
                alt="NutriBot" 
                width={128} 
                height={128}
                className="object-cover"
              />
            </div>
            <h2 className={`text-2xl font-bold text-center mb-6 ${montserrat.className} text-emerald-600`}>
              Welcome to NutriBot!
            </h2>
            <p className={`text-center text-gray-600 max-w-md mb-8 ${poppins.className}`}>
              I'm your personal nutrition assistant. Ask me anything about food, diet, nutrition, exercise, and wellness.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-8">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInput(prompt);
                    sendMessage(prompt);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3 px-4 rounded-lg text-sm transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip intro
            </button>
          </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl font-bold ${montserrat.className}`}>About NutriBot</h3>
                <button 
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Utensils className="text-emerald-500 mr-3 mt-1" size={20} />
                  <p className="text-gray-700 text-sm">
                    NutriBot is your AI-powered nutrition assistant that provides personalized advice on diet, food, and wellness.
                  </p>
                </div>
                <div className="flex items-start">
                  <ImageIcon className="text-emerald-500 mr-3 mt-1" size={20} />
                  <p className="text-gray-700 text-sm">
                    Upload food images for analysis and get nutritional information about what you're eating.
                  </p>
                </div>
                <div className="flex items-start">
                  <Dumbbell className="text-emerald-500 mr-3 mt-1" size={20} />
                  <p className="text-gray-700 text-sm">
                    Get workout and exercise recommendations tailored to your nutritional goals.
                  </p>
                </div>
                <div className="flex items-start">
                  <Heart className="text-emerald-500 mr-3 mt-1" size={20} />
                  <p className="text-gray-700 text-sm">
                    Learn about healthy eating habits and how to maintain a balanced diet.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                  Powered by Google Gemini AI
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto px-6 pt-8 pb-24 rounded-t-lg"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              } ${message.role === "user" ? "message-out" : "message-in"}`}
            >
              {message.role === "model" && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden">
                  <Image 
                src="/images/x.jpg" 
                alt="NutriBot" 
                    width={32} 
                    height={32}
                    className="object-cover"
                  />
                </div>
              )}
              <div
                className={`max-w-sm p-4 rounded-2xl shadow-md text-sm ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    : "bg-white border border-gray-100 text-gray-700"
                }`}
              >
                <Markdown>{message.content}</Markdown>
                {message.imageUrl && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.imageUrl}
                      alt="uploaded image"
                      className="max-h-40 w-auto rounded-md shadow-md"
                    />
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center ml-2 flex-shrink-0">
                  <span className="text-white text-xs">You</span>
                </div>
              )}
            </div>
          ))}
          {isLoading && streamMessageData && (
            <div className="mb-4 mt-2 flex justify-start message-in">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden">
                <Image 
                src="/images/x.jpg" 
                alt="NutriBot" 
                  width={32} 
                  height={32}
                  className="object-cover"
                />
              </div>
              <div className="max-w-sm p-4 rounded-2xl shadow-md bg-white border border-gray-100 text-gray-700 text-sm">
                <Markdown>{streamMessageData}</Markdown>
              </div>
            </div>
          )}
          {isLoading && !streamMessageData && (
            <div className="text-left mb-4 flex items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2 overflow-hidden">
                <Image 
                src="/images/x.jpg" 
                alt="NutriBot" 
                  width={32} 
                  height={32}
                  className="object-cover"
                />
              </div>
              <div className="inline-block p-3 rounded-2xl bg-white border border-gray-100 text-gray-700">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "600ms" }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        {messages.length > 0 && !showWelcome && (
          <div className="absolute bottom-20 left-0 w-full px-6 overflow-x-auto pb-2">
            <div className="flex space-x-2">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInput(prompt);
                    sendMessage(prompt);
                  }}
                  disabled={isLoading}
                  className="whitespace-nowrap bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 px-3 rounded-full transition-colors flex-shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center border-t border-gray-100 pt-4 bg-white p-4 absolute bottom-0 left-0 w-full"
        >
          <label htmlFor="image-input" className="mr-2 cursor-pointer">
            <div className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <ImageIcon
                size={22}
                className="text-emerald-500"
              />
            </div>
          </label>
          <input
            type="file"
            id="image-input"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            ref={imageInputRef}
          />

          {imagePreviewUrl && (
            <div className="relative mr-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Preview"
                className="max-w-[50px] max-h-[50px] rounded-md shadow-md"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreviewUrl(null);
                  if (imageInputRef.current) {
                    imageInputRef.current.value = "";
                  }
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask about nutrition, diet, or wellness..."
            className={`flex-grow border rounded-full py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-700 bg-gray-50 shadow-sm text-sm ${poppins.className}`}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="ml-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shine-effect"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </div>

      <footer className="mt-6 text-center text-sm text-[#6b7280] max-w-4xl w-full px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="mb-2 md:mb-0">
            Made by Abdul Wasay Abid
          </p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Heart size={14} className="text-emerald-500 mr-1" />
              <span>Eat healthy, live better</span>
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
              Powered by Gemini AI
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}