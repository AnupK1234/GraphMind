import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { format } from "date-fns";
import "./App.css";
import { FaComments, FaProjectDiagram, FaPaperPlane } from "react-icons/fa";
import GraphView from "./GraphView";
import RecommendationsPanel from "./RecommendationsPanel";

function App() {
  const [userId] = useState(`user_${Math.random().toString(36).substr(2, 9)}`);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [showGraph, setShowGraph] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);

  useEffect(() => {
    // Load chat history
    const loadHistory = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/history/${userId}`
        );
        setMessages(response.data.history || []);
      } catch (error) {
        console.error("Error loading history:", error);
      }
    };

    loadHistory();
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchGraphData = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/graph/${userId}`
      );
      setGraphData(response.data);
    } catch (error) {
      console.error("Error fetching graph data:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = {
      text: message,
      isUser: true,
      timestamp: new Date(),
      id: `msg_${Date.now()}`,
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/chat`,
        {
          userId,
          message,
        }
      );

      const aiMessage = {
        text: response.data.response,
        isUser: false,
        timestamp: new Date(),
        id: `msg_${Date.now()}`,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setLastMessageId(userMessage.id);

      // Mark previous message as answered
      if (lastMessageId) {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/mark-answered`, {
          messageId: lastMessageId,
        });
      }

      // Extract topics from AI response
      await axios.post(`${import.meta.env.VITE_API_URL}/api/extract-topics`, {
        messageId: aiMessage.id,
        text: aiMessage.text,
      });

      // Refresh graph data
      await fetchGraphData();
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        text: "Sorry, I couldn't process your request.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNodeClick = (node) => {
    if (node.type === "topic") {
      setMessage(`Tell me more about ${node.label}`);
    } else if (node.type === "userMessage" || node.type === "aiMessage") {
      alert(
        `Full message: ${node.name}\nTimestamp: ${new Date(
          node.timestamp
        ).toLocaleString()}`
      );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Bar */}
      <header className="bg-white shadow-md py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="mr-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                GraphMind
              </h1>
              <p className="text-sm text-gray-500">
                User ID: <span className="font-mono font-medium">{userId}</span>
              </p>
            </div>
          </div>

          {/* View Toggle Buttons */}
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => setShowGraph(false)}
              className={`px-5 py-2.5 flex items-center justify-center rounded-l-lg border border-gray-300 text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 transition-all ${
                !showGraph
                  ? "bg-indigo-600 text-white border-indigo-600 focus:ring-indigo-400"
                  : "bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-300"
              }`}
            >
              <FaComments className="mr-2" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => {
                setShowGraph(true);
                fetchGraphData();
              }}
              className={`px-5 py-2.5 flex items-center justify-center rounded-r-lg border border-gray-300 text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 transition-all ${
                showGraph
                  ? "bg-indigo-600 text-white border-indigo-600 focus:ring-indigo-400"
                  : "bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-300"
              }`}
            >
              <FaProjectDiagram className="mr-2" />
              <span>Knowledge Graph</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <div className="max-w-7xl mx-auto h-full">
          {showGraph ? (
            <div className="h-full bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              {graphData ? (
                <GraphView data={graphData} onNodeClick={handleNodeClick} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-lg font-medium text-gray-700">
                      Loading knowledge graph...
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                      <FaComments className="text-indigo-400 text-2xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      Welcome to GraphMind
                    </h3>
                    <p className="text-gray-500 max-w-md">
                      Start a conversation with the AI assistant. Your
                      interactions will be visualized in the knowledge graph.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          msg.isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-md px-4 py-3 rounded-2xl ${
                            msg.isUser
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <div className="text-sm md:text-base">{msg.text}</div>
                          <div
                            className={`text-xs mt-1 ${
                              msg.isUser ? "text-indigo-200" : "text-gray-500"
                            }`}
                          >
                            {format(new Date(msg.timestamp), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {showRecommendations && (
                <div className="border-t border-gray-200 bg-white">
                  <RecommendationsPanel
                    userId={userId}
                    onSelect={(rec) => {
                      setMessage(rec);
                      setShowRecommendations(false);
                    }}
                  />
                </div>
              )}

              {/* Message Input Form */}
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <form onSubmit={handleSubmit} className="flex space-x-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors duration-200"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !message.trim()}
                    className={`rounded-lg px-5 flex items-center justify-center font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all ${
                      isLoading || !message.trim()
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg"
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        <span>Sending</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span>Send</span>
                        <FaPaperPlane className="ml-2 text-sm" />
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRecommendations(!showRecommendations)}
                    className={`rounded-lg px-3 flex items-center justify-center border focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all ${
                      showRecommendations
                        ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                    title="Show recommendations"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
