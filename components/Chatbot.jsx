// components/Chatbot.jsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext'; // Access user UID
import { motion, AnimatePresence } from 'framer-motion'; // For animations
import toast from 'react-hot-toast'; // For notifications

// IMPORTANT: Replace with the actual URL of your deployed Google Cloud Function
const CLOUD_FUNCTION_URL = "https://us-central1-blackjack-8d304.cloudfunctions.net/ai-chatbot-proxy";

export default function Chatbot() {
  const { user, loading } = useAuth(); // Get authenticated user from context
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // To manage loading state for AI response
  const chatHistoryRef = useRef(null); // Ref for scrolling chat history

  // Initial bot message when component mounts or opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        sender: 'Bot',
        text: `Hello ${user?.email || 'there'}! I'm your Bar POS AI assistant. How can I help you with your active event today? You can ask about 'budget status', 'sales breakdown', or 'stock levels'.`
      }]);
    }
  }, [isOpen, messages.length, user]);

  // Scroll to bottom of chat history on new message
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  // Function to call the Google Cloud Function
  async function getAIResponse(query, userUid) {
    if (!CLOUD_FUNCTION_URL || CLOUD_FUNCTION_URL === "YOUR_GOOGLE_CLOUD_FUNCTION_URL") {
      console.error("Cloud Function URL is not set. Please update components/Chatbot.jsx");
      toast.error("AI service not configured. Please contact administrator.");
      return "AI service is not configured correctly.";
    }

    try {
      const payload = {
        userQuery: query,
        userUid: userUid
      };

      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // If your Cloud Function requires authentication, you might add a token here
          // 'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        return result.response; // Assuming your Cloud Function returns { "response": "AI text" }
      } else {
        console.error("Cloud Function error:", result.error || "Unknown error from function");
        toast.error(`AI service error: ${result.error || 'Please try again.'}`);
        return `Error from AI service: ${result.error || 'Please try again.'}`;
      }
    } catch (error) {
      console.error("Error calling Cloud Function:", error);
      toast.error("Could not reach AI service. Check network or function status.");
      return "I'm sorry, I couldn't reach the AI service at this moment.";
    }
  }

  const handleSendMessage = async () => {
    const messageText = userInput.trim();
    if (!messageText || isProcessing || loading) return; // Prevent sending empty messages or while processing

    setMessages(prev => [...prev, { sender: 'User', text: messageText }]);
    setUserInput('');
    setIsProcessing(true); // Start loading state

    try {
      if (!user || !user.uid) {
        // This case should ideally not happen if Chatbot is only shown to authenticated users
        toast.error("User not authenticated for AI queries.");
        setMessages(prev => [...prev, { sender: 'Bot', text: "I can't process your request. Please ensure you are logged in." }]);
        return;
      }

      const aiResponse = await getAIResponse(messageText, user.uid);
      setMessages(prev => [...prev, { sender: 'Bot', text: aiResponse }]);
    } catch (error) {
      console.error("Error in chatbot message processing:", error);
      setMessages(prev => [...prev, { sender: 'Bot', text: "An unexpected error occurred while processing your request." }]);
    } finally {
      setIsProcessing(false); // End loading state
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Bubble */}
      <motion.button
        className="fixed bottom-6 right-6 bg-primary-gold text-rich-black rounded-full p-4 shadow-lg hover:scale-110 transition-transform duration-200 z-50"
        onClick={() => setIsOpen(!isOpen)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      </motion.button>

      {/* Chatbot Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)} // Close when clicking outside
          >
            <motion.div
              className="bg-deep-navy rounded-lg shadow-2xl w-full max-w-lg h-[80vh] flex flex-col border border-primary-gold"
              initial={{ y: "100vh", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100vh", opacity: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-primary-gold flex justify-between items-center">
                <h2 className="text-xl font-bold text-cream-white">AI Assistant</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-cream-white hover:text-secondary-gold text-2xl"
                >
                  &times;
                </button>
              </div>

              {/* Chat History */}
              <div ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4 chat-history">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'User' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${msg.sender === 'User' ? 'bg-primary-gold text-rich-black' : 'bg-dark-charcoal text-cream-white'} p-3 rounded-lg max-w-[70%] shadow-md`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-dark-charcoal text-cream-white p-3 rounded-lg max-w-[70%] shadow-md animate-pulse">
                      Typing...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-primary-gold flex items-center space-x-3">
                <input
                  type="text"
                  className="flex-1 p-3 rounded-lg bg-dark-charcoal text-cream-white border border-dark-charcoal focus:outline-none focus:border-secondary-gold placeholder-cream-white/70"
                  placeholder="Type your message..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isProcessing || loading}
                />
                <button
                  onClick={handleSendMessage}
                  className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isProcessing || loading || !userInput.trim()}
                >
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
